// 타입 정의

export interface StyleMaster {
  style_id: number;
  is_opened: boolean;
  display: boolean;
  image_cover_url: string;
  full_image_url: string;
  image: string | null;
  heating_score?: number; // Added for filtering
  "포멀/정장스타일": number;
  "비즈니스캐주얼/신사형": number;
  "비즈니스캐주얼/모던오피스": number;
  "캐주얼/데일리웨어": number;
  "스포츠/애슬레저": number;
  "스트릿/스트리트캐주얼": number;
  "44세 이하/적당히": number | null;
  "45세 이상/적당히": number | null;
  "44세 이하/고수": number | null;
  "1_SMX (Softmax)": number;
  "PL‑LS (선형+Tanh)": number; // x값
  "비캐 지도값": number; // y값
  "캐 지도값": number; // z값
}

export type StyleSetType = "A" | "B";
export type AxisType = "x" | "y" | "z";

export interface Coordinate {
  x: number;
  y?: number;
  z?: number;
}

export interface AttractionPoint {
  coord: Coordinate;
  normCoord?: Coordinate; // normalized 0-1 coordinates for UI rendering
  score: number;
  note: string;
  product_ids?: number[]; // style_ids of rank 1 recommended styles
  isEdited?: boolean; // true if point has been modified after initial creation
}

export interface StyleSetData {
  style_id?: string;
  axes: AxisType[];
  heatingScoreMin: number | null;
  heatingScoreMax: number | null;
  points: AttractionPoint[];
}

export interface GenusAttractionData {
  genus: string;
  updated_at: string;
  style_sets: {
    A: StyleSetData;
    B: StyleSetData;
  };
}

export interface RankedStyle {
  style: StyleMaster;
  distance: number;
  rank: number;
}

export interface RankGroup {
  rank: number;
  styles: StyleMaster[];
  distance: number;
}
