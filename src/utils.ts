import type { Coordinate, StyleMaster, RankedStyle, RankGroup, StyleSetType } from "./types.ts";

export interface RankMap {
  x: number[];
  y: number[];
  z: number[];
}

// 좌표를 정규화된 키로 변환 (소수 5자리)
export function keyOf(coord: Coordinate): string {
  const rx = coord.x.toFixed(5);
  const ry = coord.y !== undefined ? coord.y.toFixed(5) : "na";
  const rz = coord.z !== undefined ? coord.z.toFixed(5) : "na";
  return `x:${rx}|y:${ry}|z:${rz}`;
}

// 키를 좌표로 파싱
export function parseKey(key: string): Coordinate {
  const parts = key.split("|");
  const x = parseFloat(parts[0].split(":")[1]);
  const yPart = parts[1].split(":")[1];
  const zPart = parts[2].split(":")[1];
  const coord: Coordinate = { x };
  if (yPart !== "na") coord.y = parseFloat(yPart);
  if (zPart !== "na") coord.z = parseFloat(zPart);
  return coord;
}

// 유클리드 거리 계산 (두 점 사이의 직선 거리)
export function euclideanDistance(
  coord1: Coordinate,
  coord2: Coordinate,
  axes: ("x" | "y" | "z")[]
): number {
  let sumSq = 0;
  for (const axis of axes) {
    const val1 = coord1[axis] ?? 0;
    const val2 = coord2[axis] ?? 0;
    const diff = val1 - val2;
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

// 스타일을 좌표로 변환
export function styleToCoordinate(style: StyleMaster, styleSet: StyleSetType): Coordinate {
  const coord: Coordinate = {
    x: style["PL‑LS (선형+Tanh)"],
  };
  if (styleSet === "A") {
    coord.y = style["비캐 지도값"];
  } else {
    coord.z = style["캐 지도값"];
  }
  return coord;
}

// 스타일 목록에서 좌표 범위 계산
export function getCoordinateRange(
  styles: StyleMaster[],
  styleSet: StyleSetType
): { x: [number, number]; y?: [number, number]; z?: [number, number] } {
  if (styles.length === 0) {
    // 기본값 반환
    return {
      x: [-1, 1],
      ...(styleSet === "A" ? { y: [-1, 1] } : { z: [-1, 1] }),
    };
  }

  const coords = styles.map((s) => styleToCoordinate(s, styleSet));
  const xValues = coords.map((c) => c.x);
  const yValues = styleSet === "A" ? coords.map((c) => c.y ?? 0) : [];
  const zValues = styleSet === "B" ? coords.map((c) => c.z ?? 0) : [];

  const range: { x: [number, number]; y?: [number, number]; z?: [number, number] } = {
    x: xValues.length > 0 ? [Math.min(...xValues), Math.max(...xValues)] : [-1, 1],
  };

  if (styleSet === "A" && yValues.length > 0) {
    range.y = [Math.min(...yValues), Math.max(...yValues)];
  } else if (styleSet === "A") {
    range.y = [-1, 1];
  }

  if (styleSet === "B" && zValues.length > 0) {
    range.z = [Math.min(...zValues), Math.max(...zValues)];
  } else if (styleSet === "B") {
    range.z = [-1, 1];
  }

  return range;
}

// Calculate rank-based normalized coordinates for all styles
export function calculateRankBasedNormalization(
  styles: StyleMaster[],
  styleSet: StyleSetType
): { normalizedStyles: StyleMaster[]; rankMap: RankMap } {
  const xValues = styles.map(s => s["PL‑LS (선형+Tanh)"]);
  const yValues = styleSet === "A" ? styles.map(s => s["비캐 지도값"]) : [];
  const zValues = styleSet === "B" ? styles.map(s => s["캐 지도값"]) : [];

  // Sort values to determine ranks
  const sortedX = [...xValues].sort((a, b) => a - b);
  // For A type, exclude -1 values from y ranking
  const sortedY = styleSet === "A"
    ? yValues.filter(v => v !== -1).sort((a, b) => a - b)
    : [...yValues].sort((a, b) => a - b);
  // For B type, exclude -1 values and values smaller than 10^-4 from z ranking
  const sortedZ = styleSet === "B"
    ? zValues.filter(v => v !== -1 && v >= 0.0001).sort((a, b) => a - b)
    : [...zValues].sort((a, b) => a - b);

  // Helper to find rank (0-1)
  const getRank = (value: number, sortedArr: number[]) => {
    if (sortedArr.length <= 1) return 0.5;

    // Use binary search to find the position
    // For duplicate values, we want to find a position within the range of duplicates
    let lo = 0;
    let hi = sortedArr.length - 1;

    // Find first occurrence of value
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (sortedArr[mid] < value) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    // Check if value exists in array
    if (lo < sortedArr.length && sortedArr[lo] === value) {
      // Value found - use its position
      // For duplicates, we could use the middle of the range, but using first occurrence is fine
      return lo / (sortedArr.length - 1);
    }

    // Value was filtered out (e.g. -1 in Type A)
    // Return undefined to indicate it should be excluded
    return undefined;
  };

  const normalizedStyles = styles.map(style => {
    const x = style["PL‑LS (선형+Tanh)"];
    const y = styleSet === "A" ? style["비캐 지도값"] : 0;
    const z = styleSet === "B" ? style["캐 지도값"] : 0;

    const normX = getRank(x, sortedX);
    // For A type, getRank might return undefined if y is -1
    const normY = styleSet === "A" ? getRank(y, sortedY) : undefined;
    const normZ = styleSet === "B" ? getRank(z, sortedZ) : undefined;

    // If normX is undefined (shouldn't happen here) or normY/normZ is undefined when required,
    // we might want to exclude the point from rendering.
    // However, normCoord must have x. 
    // If normCoord.y is missing in Type A, it won't be rendered.

    // Note: getRank returns number | undefined now.
    // We need to cast or handle it.

    const normCoord: Coordinate = { x: normX ?? 0.5 }; // Fallback if x is invalid (unlikely)

    if (normY !== undefined) normCoord.y = normY;
    if (normZ !== undefined) normCoord.z = normZ;

    return { ...style, normCoord } as any;
  });

  return {
    normalizedStyles,
    rankMap: { x: sortedX, y: sortedY, z: sortedZ }
  };
}

// Denormalize rank-based coordinate (approximate using interpolation)
export function denormalizeRankBased(
  normCoord: Coordinate,
  rankMap: RankMap,
  styleSet: StyleSetType
): Coordinate {
  const getValueAtRank = (rank: number, sortedArr: number[]) => {
    if (sortedArr.length === 0) return 0;
    if (sortedArr.length === 1) return sortedArr[0];

    const clampedRank = Math.max(0, Math.min(1, rank));
    const floatIndex = clampedRank * (sortedArr.length - 1);
    const lowerIndex = Math.floor(floatIndex);
    const upperIndex = Math.ceil(floatIndex);

    if (lowerIndex === upperIndex) return sortedArr[lowerIndex];

    const weight = floatIndex - lowerIndex;
    return sortedArr[lowerIndex] * (1 - weight) + sortedArr[upperIndex] * weight;
  };

  const x = getValueAtRank(normCoord.x, rankMap.x);
  const result: Coordinate = { x };

  // For Type A, rankMap.y is already filtered (no -1 values)
  // So denormalization will work correctly with the filtered array
  if (styleSet === "A" && normCoord.y !== undefined) {
    result.y = getValueAtRank(normCoord.y, rankMap.y);
  }

  if (styleSet === "B" && normCoord.z !== undefined) {
    result.z = getValueAtRank(normCoord.z, rankMap.z);
  }

  return result;
}

// Normalize a coordinate to 0-1 range based on bounds (Min-Max normalization)
export function normalizeCoord(coord: Coordinate, bounds: { x: [number, number]; y?: [number, number]; z?: [number, number] }): Coordinate {
  const xRange = bounds.x[1] - bounds.x[0];
  const normX = xRange === 0 ? 0.5 : (coord.x - bounds.x[0]) / xRange;
  const result: Coordinate = { x: normX };

  if (coord.y !== undefined && bounds.y) {
    const yRange = bounds.y[1] - bounds.y[0];
    result.y = yRange === 0 ? 0.5 : (coord.y - bounds.y[0]) / yRange;
  }
  if (coord.z !== undefined && bounds.z) {
    const zRange = bounds.z[1] - bounds.z[0];
    result.z = zRange === 0 ? 0.5 : (coord.z - bounds.z[0]) / zRange;
  }
  return result;
}

// Denormalize a normalized coordinate back to original range
export function denormalizeCoord(normCoord: Coordinate, bounds: { x: [number, number]; y?: [number, number]; z?: [number, number] }): Coordinate {
  const origX = normCoord.x * (bounds.x[1] - bounds.x[0]) + bounds.x[0];
  const result: Coordinate = { x: origX };
  if (normCoord.y !== undefined && bounds.y) {
    result.y = normCoord.y * (bounds.y[1] - bounds.y[0]) + bounds.y[0];
  }
  if (normCoord.z !== undefined && bounds.z) {
    result.z = normCoord.z * (bounds.z[1] - bounds.z[0]) + bounds.z[0];
  }
  return result;
}

// 추천 알고리즘: 유클리드 거리 기반, 동일 거리 그룹으로 5순위까지 반환
export function recommendStyles(
  queryCoord: Coordinate,
  styles: StyleMaster[],
  styleSet: StyleSetType,
  maxRank: number = 5
): RankGroup[] {


  const axes: ("x" | "y" | "z")[] = styleSet === "A" ? ["x", "y"] : ["x", "z"];

  // 필터링: display === true이고, normCoord가 있고, y/z가 유효한 스타일만
  const filtered = styles.filter((s) => {
    if (s.display !== true) return false;
    
    const normCoord = (s as any).normCoord as Coordinate | undefined;
    if (!normCoord) return false;
    
    // Type A: normCoord.y가 있어야 함
    if (styleSet === "A" && normCoord.y === undefined) return false;
    
    // Type B: normCoord.z가 있어야 함
    if (styleSet === "B" && normCoord.z === undefined) return false;
    
    return true;
  });

  const ranked: RankedStyle[] = filtered
    .map((style) => {
      const normCoord = (style as any).normCoord as Coordinate;
      const distance = euclideanDistance(queryCoord, normCoord, axes);
      return { style, distance, rank: 0 };
    })
    .sort((a, b) => a.distance - b.distance);



  // 동일 거리(유사도) 그룹으로 묶기 (소수 5자리까지 비교)
  const rankGroups: RankGroup[] = [];
  let currentRank = 1;
  let currentDistance = -1;

  for (const item of ranked) {
    const roundedDist = parseFloat(item.distance.toFixed(5));

    if (currentDistance === -1 || roundedDist !== currentDistance) {
      if (currentRank > maxRank) break;
      currentDistance = roundedDist;
      rankGroups.push({
        rank: currentRank,
        styles: [item.style],
        distance: roundedDist,
      });
      currentRank++;
    } else {
      // 같은 거리면 같은 그룹에 추가
      rankGroups[rankGroups.length - 1].styles.push(item.style);
    }
  }

  return rankGroups;
}

// 등고선 경로 생성 (클릭한 좌표를 중심으로 원형 등고선)
export function generateContourPath(
  styles: StyleMaster[],
  styleSet: StyleSetType,
  centerCoord: Coordinate  // 클릭한 좌표 (normalized)
): Array<{ x: number; y: number }> {
  if (styles.length === 0) return [];

  const centerX = centerCoord.x;
  const centerY = styleSet === "A" ? (centerCoord.y ?? 0) : (centerCoord.z ?? 0);

  // Use normCoord from styles (already normalized)
  const points = styles.map((style) => {
    const normCoord = (style as any).normCoord as Coordinate | undefined;
    if (!normCoord) return { x: 0, y: 0 };
    return {
      x: normCoord.x,
      y: styleSet === "A" ? (normCoord.y ?? 0) : (normCoord.z ?? 0),
    };
  });

  const distances = points.map((p) =>
    Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2))
  );

  const radius = distances.reduce((sum, d) => sum + d, 0) / distances.length;

  // 원형 경로 생성 (36개 점으로 부드러운 원 생성)
  const circlePoints: Array<{ x: number; y: number }> = [];
  const numPoints = 36;
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    circlePoints.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  }

  return circlePoints;
}



