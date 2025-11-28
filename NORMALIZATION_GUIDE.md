# 정규화/역정규화 가이드

## 개요

이 프로젝트는 좌표를 **rank-based normalization** 방식으로 정규화합니다.
- **정규화**: 원본 좌표 → 0-1 범위의 `normCoord`
- **역정규화**: `normCoord` → 원본 좌표로 복원

## 핵심 함수들

### 1. 정규화: `calculateRankBasedNormalization`

**위치**: `src/utils.ts` (96-176줄)

```typescript
export function calculateRankBasedNormalization(
  styles: StyleMaster[],
  styleSet: StyleSetType
): { normalizedStyles: StyleMaster[]; rankMap: RankMap }
```

**작동 방식**:
1. 모든 스타일의 x, y, z 값을 추출
2. **y와 z에서 -1 값을 제외**하고 정렬 (107-113줄)
3. 각 값의 rank(순위)를 계산하여 0-1 범위로 변환
4. `rankMap` 생성: 정렬된 값 배열 (x, y, z 각각)

**중요 포인트**:
- Type A: `y` 값이 -1인 경우 제외
- Type B: `z` 값이 -1인 경우 제외
- `rankMap.y`와 `rankMap.z`는 이미 -1이 제외된 배열

### 2. 역정규화: `denormalizeRankBased`

**위치**: `src/utils.ts` (179-213줄)

```typescript
export function denormalizeRankBased(
  normCoord: Coordinate,  // 0-1 범위의 정규화된 좌표
  rankMap: RankMap,       // 정규화 시 사용된 정렬된 값 배열
  styleSet: StyleSetType
): Coordinate             // 원본 좌표로 복원
```

**작동 방식**:
1. `normCoord.x` (0-1) → `rankMap.x` 배열에서 선형 보간으로 원본 값 계산
2. `normCoord.y` (0-1) → `rankMap.y` 배열에서 선형 보간으로 원본 값 계산 (Type A만)
3. `normCoord.z` (0-1) → `rankMap.z` 배열에서 선형 보간으로 원본 값 계산 (Type B만)

**선형 보간 로직** (184-197줄):
```typescript
const getValueAtRank = (rank: number, sortedArr: number[]) => {
  const clampedRank = Math.max(0, Math.min(1, rank));  // 0-1 범위로 제한
  const floatIndex = clampedRank * (sortedArr.length - 1);  // 배열 인덱스로 변환
  const lowerIndex = Math.floor(floatIndex);
  const upperIndex = Math.ceil(floatIndex);
  
  if (lowerIndex === upperIndex) return sortedArr[lowerIndex];
  
  // 선형 보간
  const weight = floatIndex - lowerIndex;
  return sortedArr[lowerIndex] * (1 - weight) + sortedArr[upperIndex] * weight;
};
```

## 데이터 흐름

### 1. 초기화 (App.tsx 105-112줄)

```typescript
useEffect(() => {
  if (masterStyles.length > 0) {
    const { normalizedStyles: normalized, rankMap: computedRankMap } =
      calculateRankBasedNormalization(masterStyles, styleSet);
    setRankMap(computedRankMap);           // rankMap 저장
    setNormalizedStyles(normalized);       // 정규화된 스타일 저장
  }
}, [masterStyles, styleSet]);
```

### 2. 좌표 클릭 시 역정규화 (App.tsx 156-162줄)

```typescript
const handleCoordinateClick = useCallback(
  (normCoord: Coordinate, originalCoord?: Coordinate, index?: number) => {
    if (!rankMap) return;

    // normCoord를 원본 coord로 변환
    const coord = originalCoord || denormalizeRankBased(normCoord, rankMap, styleSet);
    setSelectedCoord(coord);
    // ...
  },
  [rankMap, styleSet, ...]
);
```

### 3. 저장 시 정규화 (App.tsx handleSave)

저장할 때는 `coord`를 `normCoord`로 변환하여 저장합니다.

## RankMap 구조

```typescript
interface RankMap {
  x: number[];  // 모든 x 값 정렬 (오름차순)
  y: number[];  // Type A: -1 제외한 y 값 정렬
  z: number[];  // Type B: -1 제외한 z 값 정렬
}
```

## 예시

### 정규화 예시

원본 데이터:
- Style 1: `{ x: 0.5, y: 0.3 }`
- Style 2: `{ x: 0.8, y: -1 }`  ← y=-1은 제외
- Style 3: `{ x: 0.2, y: 0.7 }`

정렬된 배열:
- `rankMap.x = [0.2, 0.5, 0.8]`
- `rankMap.y = [0.3, 0.7]`  ← -1 제외

정규화 결과:
- Style 1: `normCoord = { x: 0.5, y: 0.0 }`  (x는 0.5의 rank, y는 0.3의 rank)
- Style 2: `normCoord = { x: 1.0, y: undefined }`  (y=-1이므로 undefined)
- Style 3: `normCoord = { x: 0.0, y: 1.0 }`

### 역정규화 예시

`normCoord = { x: 0.5, y: 0.5 }`가 주어졌을 때:

1. x 역정규화:
   - `rankMap.x = [0.2, 0.5, 0.8]`
   - `floatIndex = 0.5 * (3-1) = 1.0`
   - `sortedArr[1] = 0.5` → `x = 0.5`

2. y 역정규화:
   - `rankMap.y = [0.3, 0.7]`
   - `floatIndex = 0.5 * (2-1) = 0.5`
   - `lowerIndex = 0, upperIndex = 1`
   - `weight = 0.5`
   - `y = 0.3 * (1-0.5) + 0.7 * 0.5 = 0.5`

결과: `coord = { x: 0.5, y: 0.5 }`

## 주의사항

1. **-1 값 처리**: y나 z가 -1인 경우 정규화 시 `undefined`가 되고, 역정규화도 불가능합니다.
2. **rankMap 필수**: 역정규화를 위해서는 반드시 `rankMap`이 필요합니다.
3. **근사치**: 역정규화는 선형 보간을 사용하므로 완전히 정확하지 않을 수 있습니다 (특히 중간 값).

