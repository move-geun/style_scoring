import React, { useState, useEffect, useCallback } from "react";
import type {
  StyleMaster,
  Coordinate,
  GenusAttractionData,
  StyleSetType,
  RankGroup,
  AttractionPoint,
} from "./types.ts";
import {
  loadMasterStyles,
  saveGenusData,
  loadGenusData,
  createEmptyGenusData,
  upsertPoint,
  deletePoint,
} from "./dataLoader";
import {
  keyOf,
  recommendStyles,
  calculateRankBasedNormalization,
  denormalizeRankBased,
  type RankMap,
} from "./utils";
import { StyleGraph } from "./components/StyleGraph";
import {
  RecommendedStylesPanel,
  type RecommendedStylesPanelRef,
} from "./components/RecommendedStylesPanel";
import { ScoreInputPanel } from "./components/ScoreInputPanel";
import { SavedPointsList } from "./components/SavedPointsList";
import "./App.css";

const GENUS_OPTIONS = Array.from(
  { length: 18 },
  (_, i) => `genus_${String(i + 1).padStart(2, "0")}`
);

function App() {
  const [masterStyles, setMasterStyles] = useState<StyleMaster[]>([]);
  const [genus, setGenus] = useState<string>(GENUS_OPTIONS[0]);
  const [heatingScoreMin, setHeatingScoreMin] = useState<number | null>(680);
  const [heatingScoreMax, setHeatingScoreMax] = useState<number | null>(null);
  const [styleSet, setStyleSet] = useState<StyleSetType>("A");
  const [genusDataMap, setGenusDataMap] = useState<Map<string, GenusAttractionData>>(() => {
    const initialMap = new Map<string, GenusAttractionData>();
    GENUS_OPTIONS.forEach(g => {
      initialMap.set(g, createEmptyGenusData(g));
    });
    return initialMap;
  });

  // Helper to get current genus data
  const genusData = genusDataMap.get(genus) || createEmptyGenusData(genus);

  // Helper to update current genus data in the map
  const updateGenusData = useCallback((updater: GenusAttractionData | ((prev: GenusAttractionData) => GenusAttractionData)) => {
    setGenusDataMap(prevMap => {
      const newMap = new Map(prevMap);
      const currentData = newMap.get(genus) || createEmptyGenusData(genus);
      const newData = typeof updater === 'function' ? updater(currentData) : updater;
      newMap.set(genus, newData);
      return newMap;
    });
  }, [genus]);

  const [selectedCoord, setSelectedCoord] = useState<Coordinate | null>(null);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [currentNote, setCurrentNote] = useState<string>("");
  const [rankGroups, setRankGroups] = useState<RankGroup[]>([]);
  const [hoveredRankGroup, setHoveredRankGroup] = useState<RankGroup | null>(
    null
  );
  const recommendedPanelRef = React.useRef<RecommendedStylesPanelRef>(null);

  // Normalization state: rankMap and normalized styles
  const [rankMap, setRankMap] = useState<RankMap | null>(null);
  const [normalizedStyles, setNormalizedStyles] = useState<StyleMaster[]>([]);
  const [selectedNormCoord, setSelectedNormCoord] = useState<Coordinate | null>(
    null
  );
  const [hoveredPointCoord, setHoveredPointCoord] = useState<Coordinate | null>(
    null
  );
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [isScoreViewMode, setIsScoreViewMode] = useState<boolean>(false);
  const [filteredStyles, setFilteredStyles] = useState<StyleMaster[]>([]);

  // 마스터 스타일 로드
  useEffect(() => {
    loadMasterStyles()
      .then((styles) => {
        setMasterStyles(styles);
      })
      .catch((error) => {
        console.error("Failed to load master styles:", error);
        alert(
          "마스터 스타일 파일을 불러올 수 없습니다. style_master.json 파일이 public 폴더에 있는지 확인하세요."
        );
      });
  }, []);

  // Compute rank-based normalization whenever masterStyles or styleSet changes
  useEffect(() => {
    if (masterStyles.length > 0) {
      const { normalizedStyles: normalized, rankMap: computedRankMap } =
        calculateRankBasedNormalization(masterStyles, styleSet);
      setRankMap(computedRankMap);
      setNormalizedStyles(normalized);
    }
  }, [masterStyles, styleSet]);

  // Filter styles by heating score range
  useEffect(() => {
    if (normalizedStyles.length > 0) {
      const filtered = normalizedStyles.filter((style) => {
        const score = style.heating_score ?? 0;
        // If both are null, show all styles
        if (heatingScoreMin === null && heatingScoreMax === null) return true;
        // If only min is set
        if (heatingScoreMin !== null && heatingScoreMax === null) return score >= heatingScoreMin;
        // If only max is set
        if (heatingScoreMin === null && heatingScoreMax !== null) return score <= heatingScoreMax;
        // If both are set (both are guaranteed to be non-null here)
        if (heatingScoreMin !== null && heatingScoreMax !== null) {
          return score >= heatingScoreMin && score <= heatingScoreMax;
        }
        return true;
      });
      setFilteredStyles(filtered);
    } else {
      setFilteredStyles([]);
    }
  }, [normalizedStyles, heatingScoreMin, heatingScoreMax]);

  // 지누스 변경 시 데이터 초기화 useEffect 제거
  // 대신 handleGenusChange에서 처리함

  // 스타일 세트 변경 시 해당 세트의 Heating Score 불러오기 및 선택 초기화
  useEffect(() => {
    // genusData가 초기화된 상태인지 확인
    if (genusData.style_sets && genusData.style_sets[styleSet]) {
      const currentSetData = genusData.style_sets[styleSet];
      setHeatingScoreMin(currentSetData.heatingScoreMin ?? null);
      setHeatingScoreMax(currentSetData.heatingScoreMax ?? null);
    }

    setSelectedCoord(null);
    setSelectedNormCoord(null);
    setSelectedPointIndex(null);
    setRankGroups([]);
  }, [styleSet]); // genusData 변경 시에는 실행하지 않음 (값 동기화는 별도로 처리)

  // 좌표 클릭 핸들러 - receives normalized coord from graph (0-1)
  const handleCoordinateClick = useCallback(
    (normCoord: Coordinate, originalCoord?: Coordinate, index?: number) => {
      if (!rankMap) return;

      // Denormalize the clicked coordinate back to original range (approximate)
      // If originalCoord is provided (from saved point click), use it.
      const coord = originalCoord || denormalizeRankBased(normCoord, rankMap, styleSet);
      setSelectedCoord(coord);
      setSelectedNormCoord(normCoord); // Store exact clicked position for rendering

      let point: AttractionPoint | undefined;
      let foundIndex: number | null = null;

      // 1. If index is provided, find by index (most robust)
      if (index !== undefined && index >= 0 && index < genusData.style_sets[styleSet].points.length) {
        point = genusData.style_sets[styleSet].points[index];
        foundIndex = index;
      }

      // 2. If not found by index, try originalCoord (fallback for backward compatibility or other calls)
      if (!point && originalCoord) {
        const key = keyOf(originalCoord);
        foundIndex = genusData.style_sets[styleSet].points.findIndex(
          (p) => keyOf(p.coord) === key
        );
        if (foundIndex !== -1) {
          point = genusData.style_sets[styleSet].points[foundIndex];
        } else {
          foundIndex = null;
        }
      }

      // 3. Fallback: try with denormalized coord (approximate match)
      if (!point) {
        const coordKey = keyOf(coord);
        // We need index for state, so using findIndex
        foundIndex = genusData.style_sets[styleSet].points.findIndex(
          (p) => keyOf(p.coord) === coordKey
        );
        if (foundIndex !== -1) {
          point = genusData.style_sets[styleSet].points[foundIndex];
        } else {
          foundIndex = null;
        }
      }

      setSelectedPointIndex(foundIndex);

      if (point) {
        setCurrentScore(point.score);
        setCurrentNote(point.note || "");
      } else {
        setCurrentScore(0);
        setCurrentNote("");
      }

      // Scroll recommended panel to top
      if (recommendedPanelRef.current) {
        recommendedPanelRef.current.scrollToTop();
      }

      // Recommend styles using normalized coordinates
      const recommended = recommendStyles(
        normCoord,
        filteredStyles,
        styleSet,
        5
      );
      setRankGroups(recommended);
    },
    [genusData.style_sets, styleSet, rankMap, filteredStyles]
  );

  // 점수 저장
  const handleSaveScore = useCallback(() => {
    if (!selectedCoord) return;

    const newData = { ...genusData };

    // Get product_ids from rank 1 styles
    const rank1Group = rankGroups.find(g => g.rank === 1);
    const product_ids = rank1Group && rank1Group.styles.length > 0
      ? rank1Group.styles.map(s => s.style_id)
      : undefined;

    if (selectedPointIndex !== null && selectedPointIndex >= 0 && selectedPointIndex < newData.style_sets[styleSet].points.length) {
      // Update existing point by index (robust)
      newData.style_sets[styleSet].points[selectedPointIndex] = {
        ...newData.style_sets[styleSet].points[selectedPointIndex],
        score: currentScore,
        note: currentNote,
        product_ids: product_ids,
        // Preserve coord and normCoord
      };
      newData.updated_at = new Date().toISOString();
    } else {
      // New point or fallback
      upsertPoint(newData, styleSet, selectedCoord, currentScore, currentNote, product_ids);

      // Find the index of the newly added point to switch to edit mode
      const key = keyOf(selectedCoord);
      const newIndex = newData.style_sets[styleSet].points.findIndex(
        (p) => keyOf(p.coord) === key
      );
      if (newIndex !== -1) {
        setSelectedPointIndex(newIndex);
      }
    }

    newData.style_sets[styleSet].heatingScoreMin = heatingScoreMin;
    newData.style_sets[styleSet].heatingScoreMax = heatingScoreMax;
    updateGenusData(newData);
  }, [
    selectedCoord,
    selectedPointIndex,
    currentScore,
    currentNote,
    genusData,
    styleSet,
    heatingScoreMin,
    heatingScoreMax,
    rankGroups,
  ]);

  // 스타일 선택 토글

  const handleSave = useCallback(() => {

    if (!rankMap) {
      console.warn("RankMap not available, saving without normCoord");
      const dataToSave = { ...genusData };
      dataToSave.updated_at = new Date().toISOString();
      saveGenusData(dataToSave, styleSet);
      return;
    }

    // Helper to calculate rank for saving
    const getRank = (val: number, arr: number[]) => {
      let low = 0,
        high = arr.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (arr[mid] < val) low = mid + 1;
        else high = mid;
      }
      return low / (arr.length > 0 ? arr.length : 1);
    };

    const dataToSave = { ...genusData };
    dataToSave.style_sets.A.points = dataToSave.style_sets.A.points.map(
      (p) => {
        const nx = getRank(p.coord.x, rankMap.x);
        const ny =
          p.coord.y !== undefined ? getRank(p.coord.y, rankMap.y) : undefined;
        const nc: Coordinate = { x: nx };
        if (ny !== undefined) nc.y = ny;
        const updated = { ...p, normCoord: nc };
        return updated;
      }
    );


    dataToSave.style_sets.B.points = dataToSave.style_sets.B.points.map(
      (p) => {
        const nx = getRank(p.coord.x, rankMap.x);
        const nz =
          p.coord.z !== undefined ? getRank(p.coord.z, rankMap.z) : undefined;
        const nc: Coordinate = { x: nx };
        if (nz !== undefined) nc.z = nz;
        const updated = { ...p, normCoord: nc };
        return updated;
      }
    );

    dataToSave.updated_at = new Date().toISOString();
    saveGenusData(dataToSave, styleSet);

  }, [genusData, rankMap, styleSet]);

  // 포인트 삭제 핸들러
  const handleDeletePoint = useCallback(() => {
    if (!selectedCoord) return;

    if (confirm("정말 삭제하시겠습니까?")) {
      const newData = { ...genusData };
      deletePoint(newData, styleSet, selectedCoord);
      updateGenusData(newData);

      // 선택 초기화
      setSelectedCoord(null);
      setSelectedNormCoord(null);
      setSelectedPointIndex(null);
    }
  }, [genusData, selectedCoord, styleSet]);

  // 불러오기
  // 불러오기
  const handleLoad = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          const loadedData = JSON.parse(text);

          let targetStyleSet = styleSet;

          // Check if it's the new simplified format and has styleSet
          if (loadedData.styleSet && (loadedData.styleSet === "A" || loadedData.styleSet === "B")) {
            targetStyleSet = loadedData.styleSet;
            setStyleSet(targetStyleSet);
          }

          // We can use loadGenusData but we already parsed the file. 
          // Let's just use loadGenusData for consistency or reuse the parsed data.
          // Since loadGenusData takes a File object, we can just call it.
          // Or better, refactor loadGenusData to accept parsed object? 
          // For now, calling loadGenusData is fine, it will parse again but it's cheap.

          const data = await loadGenusData(file, genusData, targetStyleSet);

          // User request: Keep current genus, do not switch to file's genus
          data.genus = genus;

          updateGenusData(data);
          // setGenus(data.genus); // Removed to prevent genus switching

          setHeatingScoreMin(data.style_sets[targetStyleSet].heatingScoreMin ?? null);
          setHeatingScoreMax(data.style_sets[targetStyleSet].heatingScoreMax ?? null);
          alert(`데이터를 불러왔습니다. (${targetStyleSet} 세트)`);

        } catch (error) {
          console.error("Load error:", error);
          alert("파일을 불러오는 중 오류가 발생했습니다.");
        }
      };
      reader.readAsText(file);
      // Allow loading the same file again
      e.target.value = '';
    },
    [styleSet, genusData]
  );

  // Point hover handler
  const handlePointHover = useCallback(
    (coord: Coordinate | null) => {
      if (!coord || !rankMap) {
        setHoveredPointCoord(null);
        return;
      }

      // Calculate normCoord from coord for hovering
      const getRank = (val: number, arr: number[]) => {
        let low = 0,
          high = arr.length;
        while (low < high) {
          const mid = (low + high) >>> 1;
          if (arr[mid] < val) low = mid + 1;
          else high = mid;
        }
        return low / (arr.length > 0 ? arr.length : 1);
      };

      const nx = getRank(coord.x, rankMap.x);
      const ny =
        styleSet === "A" && coord.y !== undefined
          ? getRank(coord.y, rankMap.y)
          : undefined;
      const nz =
        styleSet === "B" && coord.z !== undefined
          ? getRank(coord.z, rankMap.z)
          : undefined;
      const nc: Coordinate = { x: nx };
      if (ny !== undefined) nc.y = ny;
      if (nz !== undefined) nc.z = nz;

      setHoveredPointCoord(nc);
    },
    [rankMap, styleSet]
  );

  // Point select handler (from SavedPointsList)
  const handlePointSelect = useCallback(
    (coord: Coordinate, normCoord: Coordinate | undefined, index?: number) => {
      // If index is provided, use it directly with normCoord or coord
      if (index !== undefined) {
        // Use normCoord if available, otherwise calculate it
        if (normCoord) {
          handleCoordinateClick(normCoord, coord, index);
        } else if (rankMap) {
          // Calculate normCoord from coord
          const getRank = (val: number, arr: number[]) => {
            let low = 0,
              high = arr.length;
            while (low < high) {
              const mid = (low + high) >>> 1;
              if (arr[mid] < val) low = mid + 1;
              else high = mid;
            }
            return low / (arr.length > 0 ? arr.length : 1);
          };

          const nx = getRank(coord.x, rankMap.x);
          const ny =
            styleSet === "A" && coord.y !== undefined
              ? getRank(coord.y, rankMap.y)
              : undefined;
          const nz =
            styleSet === "B" && coord.z !== undefined
              ? getRank(coord.z, rankMap.z)
              : undefined;
          const nc: Coordinate = { x: nx };
          if (ny !== undefined) nc.y = ny;
          if (nz !== undefined) nc.z = nz;

          handleCoordinateClick(nc, coord, index);
        }
      } else {
        // Fallback to old logic if index is not provided
        if (normCoord) {
          handleCoordinateClick(normCoord, coord);
        } else if (rankMap) {
          const getRank = (val: number, arr: number[]) => {
            let low = 0,
              high = arr.length;
            while (low < high) {
              const mid = (low + high) >>> 1;
              if (arr[mid] < val) low = mid + 1;
              else high = mid;
            }
            return low / (arr.length > 0 ? arr.length : 1);
          };

          const nx = getRank(coord.x, rankMap.x);
          const ny =
            styleSet === "A" && coord.y !== undefined
              ? getRank(coord.y, rankMap.y)
              : undefined;
          const nz =
            styleSet === "B" && coord.z !== undefined
              ? getRank(coord.z, rankMap.z)
              : undefined;
          const nc: Coordinate = { x: nx };
          if (ny !== undefined) nc.y = ny;
          if (nz !== undefined) nc.z = nz;

          handleCoordinateClick(nc, coord);
        }
      }
    },
    [handleCoordinateClick, rankMap, styleSet]
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">Style Attraction Scoring</h1>
          <p className="app-subtitle">스타일 매력도 점수 평가 도구</p>
        </div>
        <div className="controls">
          <div className="control-group">
            <label className="control-label">지누스</label>
            <select
              value={genus}
              onChange={(e) => {
                const newGenus = e.target.value;
                setGenus(newGenus);
                // Update genus in genusData without resetting points
                const updatedData = { ...genusData, genus: newGenus };
                updateGenusData(updatedData);
              }}
              className="control-select"
            >
              {GENUS_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label className="control-label">Heating Score 최소</label>
            <input
              type="number"
              value={heatingScoreMin ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                setHeatingScoreMin(val);
                updateGenusData(prev => ({
                  ...prev,
                  style_sets: {
                    ...prev.style_sets,
                    [styleSet]: {
                      ...prev.style_sets[styleSet],
                      heatingScoreMin: val
                    }
                  }
                }));
              }}
              placeholder="최소값 (선택)"
              className="control-input"
            />
          </div>
          <div className="control-group">
            <label className="control-label">Heating Score 최대</label>
            <input
              type="number"
              value={heatingScoreMax ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                setHeatingScoreMax(val);
                updateGenusData(prev => ({
                  ...prev,
                  style_sets: {
                    ...prev.style_sets,
                    [styleSet]: {
                      ...prev.style_sets[styleSet],
                      heatingScoreMax: val
                    }
                  }
                }));
              }}
              placeholder="최대값 (선택)"
              className="control-input"
            />
          </div>
          <div className="control-group">
            <label className="control-label">스타일 세트</label>
            <select
              value={styleSet}
              onChange={(e) => setStyleSet(e.target.value as StyleSetType)}
              className="control-select"
            >
              <option value="A">A (X-Y)</option>
              <option value="B">B (X-Z)</option>
            </select>
          </div>
          <div className="control-group button-group">
            <button onClick={handleSave} className="btn btn-primary">
              <span>💾</span> 저장
            </button>
            <label className="btn btn-secondary">
              <span>📁</span> 불러오기
              <input
                type="file"
                accept=".json"
                onChange={handleLoad}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>
      </header>

      <div className="app-body">
        <div className="graph-container">
          {(() => {
            const getRank = (val: number, arr: number[]) => {
              let low = 0,
                high = arr.length;
              while (low < high) {
                const mid = (low + high) >>> 1;
                if (arr[mid] < val) low = mid + 1;
                else high = mid;
              }
              return low / (arr.length > 0 ? arr.length : 1);
            };

            // Use stored selectedNormCoord if available
            const normSelectedCoord =
              selectedNormCoord ||
              (selectedCoord && rankMap
                ? (() => {
                  const nx = getRank(selectedCoord.x, rankMap.x);
                  const ny =
                    styleSet === "A" && selectedCoord.y !== undefined
                      ? getRank(selectedCoord.y, rankMap.y)
                      : undefined;
                  const nz =
                    styleSet === "B" && selectedCoord.z !== undefined
                      ? getRank(selectedCoord.z, rankMap.z)
                      : undefined;
                  const nc: Coordinate = { x: nx };
                  if (ny !== undefined) nc.y = ny;
                  if (nz !== undefined) nc.z = nz;
                  return nc;
                })()
                : null);

            const normPoints = rankMap
              ? genusData.style_sets[styleSet].points.map((p) => {
                const nx = getRank(p.coord.x, rankMap.x);
                const ny =
                  styleSet === "A" && p.coord.y !== undefined
                    ? getRank(p.coord.y, rankMap.y)
                    : undefined;
                const nz =
                  styleSet === "B" && p.coord.z !== undefined
                    ? getRank(p.coord.z, rankMap.z)
                    : undefined;
                const nc: Coordinate = { x: nx };
                if (ny !== undefined) nc.y = ny;
                if (nz !== undefined) nc.z = nz;
                return { ...p, normCoord: nc };
              })
              : [];

            return (
              <StyleGraph
                key={styleSet}
                styles={filteredStyles}
                styleSet={styleSet}
                points={normPoints}
                rankGroups={rankGroups}
                selectedCoord={normSelectedCoord}
                hoveredPointCoord={hoveredPointCoord}
                onCoordinateClick={handleCoordinateClick}
                onContourHover={setHoveredRankGroup}
                isScoreViewMode={isScoreViewMode}

              />
            );
          })()}
          {selectedCoord && (
            <div className="graph-overlay">
              <div className="graph-coord-display">
                Selected: ({selectedCoord.x.toFixed(4)},{" "}
                {(styleSet === "A"
                  ? selectedCoord.y
                  : selectedCoord.z
                )?.toFixed(4)}
                )
              </div>
            </div>
          )}
        </div>

        <div className="sidebar">
          <div className="sidebar-content">
            <div className="panel-header">
              <h2>유사 스타일</h2>
            </div>
            <div className="panel-content">
              <RecommendedStylesPanel
                key={`${styleSet}-${rankGroups.length}-${selectedCoord ? keyOf(selectedCoord) : "none"
                  }`}
                ref={recommendedPanelRef}
                rankGroups={rankGroups}
                hoveredRankGroup={hoveredRankGroup}
              />
            </div>
            <div className="sidebar-footer">
              <div className="panel-title">
                <span>📝</span> 점수 입력
              </div>
              <ScoreInputPanel
                coord={selectedCoord}
                existingScore={
                  selectedPointIndex !== null &&
                    selectedPointIndex >= 0 &&
                    selectedPointIndex < genusData.style_sets[styleSet].points.length
                    ? genusData.style_sets[styleSet].points[selectedPointIndex].score
                    : null
                }
                note={currentNote}
                onScoreChange={setCurrentScore}
                onNoteChange={(note) => {
                  if (selectedPointIndex !== null && genusData.style_sets[styleSet].points[selectedPointIndex]) {
                    const newData = { ...genusData };
                    newData.style_sets[styleSet].points[selectedPointIndex].note = note;
                    updateGenusData(newData);
                  }
                }}
                onSave={handleSaveScore}
                onDelete={handleDeletePoint}
              />
            </div>
          </div>
        </div>

        {/* Saved Points List - Absolute Overlay (Moved to end for z-index) */}
        <div
          style={{
            position: "fixed", // Changed to fixed to avoid clipping
            top: "80px", // Adjusted top to account for header (approx 64px + 16px)
            left: "20px",
            zIndex: 9999, // Increased z-index
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{
            backgroundColor: "#1f1f1f",
            padding: "8px 12px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            border: "1px solid rgba(255,255,255,0.1)"
          }}>
            <label className="switch">
              <input
                type="checkbox"
                checked={isScoreViewMode}
                onChange={(e) => setIsScoreViewMode(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#e5e5e5" }}>Score View</span>
          </div>

          <SavedPointsList
            points={genusData.style_sets[styleSet].points}
            styleSet={styleSet}
            selectedCoord={selectedCoord}
            onPointSelect={handlePointSelect}
            onPointHover={handlePointHover}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
