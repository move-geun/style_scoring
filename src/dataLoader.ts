import type {
  StyleMaster,
  GenusAttractionData,

  AttractionPoint,
  Coordinate,
  StyleSetType,
} from "./types.ts";
import { keyOf } from "./utils";

// Simplified save format for single style set
interface SimplifiedSaveData {
  genus: string;
  styleSet: StyleSetType;
  savedAt: string;
  heatingScoreMin: number | null;
  heatingScoreMax: number | null;
  points: AttractionPoint[];
}

// 마스터 스타일 JSON 로드
export async function loadMasterStyles(): Promise<StyleMaster[]> {
  try {
    const response = await fetch("/style_master.json");
    if (!response.ok) {
      throw new Error("Failed to load master styles");
    }
    const data: StyleMaster[] = await response.json();
    return data;
  } catch (error) {
    console.error("Error loading master styles:", error);
    throw error;
  }
}

// 지누스별 점수 JSON 저장 (새 형식: genus_styleSet_timestamp.json)
export function saveGenusData(
  data: GenusAttractionData,
  styleSet: StyleSetType
): void {
  console.log("=== saveGenusData 시작 ===");
  console.log("저장할 styleSet:", styleSet);
  console.log("데이터 존재:", !!data);

  if (!data) {
    console.error("No data to save");
    return;
  }

  // normCoord is already computed in App.tsx before calling this function
  // Create simplified save data for current styleSet only
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, -5); // Format: YYYYMMDD_HHmmss

  // Clean up points data to remove unnecessary properties (like normCoord or D3 internal props)
  const pointsToSave = data.style_sets[styleSet].points.map(p => ({
    coord: p.coord,
    score: p.score,
    note: p.note,
    product_ids: p.product_ids
  }));
  console.log("저장할 포인트 개수:", pointsToSave.length);
  console.log(
    "저장할 포인트 샘플 (처음 3개):",
    pointsToSave.slice(0, 3).map((p) => ({
      coord: p.coord,
      score: p.score,
      note: p.note,
    }))
  );

  const simplifiedData: SimplifiedSaveData = {
    genus: data.genus,
    styleSet: styleSet,
    savedAt: new Date().toISOString(),
    heatingScoreMin: data.style_sets[styleSet].heatingScoreMin ?? null,
    heatingScoreMax: data.style_sets[styleSet].heatingScoreMax ?? null,
    points: pointsToSave,
  };

  const jsonStr = JSON.stringify(simplifiedData, null, 2);
  // Use text/plain to avoid browser handling issues with application/json
  const blob = new Blob([jsonStr], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  // Sanitize filename
  const safeGenus = data.genus.replace(/[^a-zA-Z0-9가-힣]/g, "_");
  const filename = `${safeGenus}_${styleSet}_${timestamp}.json`;
  a.href = url;
  a.download = filename;
  console.log("다운로드 파일명:", filename);
  console.log("JSON 크기:", jsonStr.length, "bytes");
  document.body.appendChild(a);
  a.click();

  // Delay cleanup to ensure download starts
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("=== saveGenusData 완료 ===");
  }, 100);
}

// 지누스별 점수 JSON 불러오기 (새 형식 지원)
export function loadGenusData(
  file: File,
  currentData: GenusAttractionData,
  _styleSet: StyleSetType
): Promise<GenusAttractionData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loadedData = JSON.parse(e.target?.result as string);

        // Check if it's the new simplified format
        if (loadedData.styleSet && loadedData.points) {
          // New simplified format
          const simplified = loadedData as SimplifiedSaveData;
          const mergedData = { ...currentData };
          mergedData.genus = simplified.genus;
          mergedData.style_sets[simplified.styleSet].heatingScoreMin =
            simplified.heatingScoreMin ?? null;
          mergedData.style_sets[simplified.styleSet].heatingScoreMax =
            simplified.heatingScoreMax ?? null;
          mergedData.style_sets[simplified.styleSet].points = simplified.points;
          mergedData.updated_at = new Date().toISOString();
          resolve(mergedData);
        } else {
          // Old full format
          const fullData = loadedData as GenusAttractionData;
          resolve(fullData);
        }
      } catch (error) {
        reject(new Error("Invalid JSON file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// 초기 빈 데이터 생성
export function createEmptyGenusData(genus: string): GenusAttractionData {
  return {
    genus,
    updated_at: new Date().toISOString(),
    style_sets: {
      A: {
        axes: ["x", "y"],
        heatingScoreMin: 680,
        heatingScoreMax: null,
        points: [],
      },
      B: {
        axes: ["x", "z"],
        heatingScoreMin: 680,
        heatingScoreMax: null,
        points: [],
      },
    },
  };
}

// 점수 데이터에서 좌표별 점수 맵 생성
export function createPointMap(
  points: AttractionPoint[]
): Map<string, AttractionPoint> {
  const map = new Map<string, AttractionPoint>();
  for (const point of points) {
    map.set(keyOf(point.coord), point);
  }
  return map;
}

// 좌표에 점수 추가/수정
export function upsertPoint(
  data: GenusAttractionData,
  styleSet: StyleSetType,
  coord: Coordinate,
  score: number,
  note: string = "",
  product_ids: number[] = []
): void {
  const styleSetData = data.style_sets[styleSet]; // Use the renamed parameter
  const key = keyOf(coord);
  const existingIndex = styleSetData.points.findIndex(
    (p) => keyOf(p.coord) === key
  );

  const newPoint: AttractionPoint = {
    coord,
    score,
    note,
    product_ids,
  };

  if (existingIndex !== -1) {
    styleSetData.points[existingIndex] = newPoint;
  } else {
    styleSetData.points.push(newPoint);
  }

  data.updated_at = new Date().toISOString();
}

// 좌표의 점수 삭제
export function deletePoint(
  data: GenusAttractionData,
  styleSet: StyleSetType,
  coord: Coordinate
): void {
  const styleSetData = data.style_sets[styleSet];
  const key = keyOf(coord);
  const existingIndex = styleSetData.points.findIndex(
    (p) => keyOf(p.coord) === key
  );

  if (existingIndex !== -1) {
    styleSetData.points.splice(existingIndex, 1);
  }
  data.updated_at = new Date().toISOString();
}
