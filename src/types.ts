export const CANVAS_W = 1200;
export const CANVAS_H = 800;
export const MODEL_ID = 'Xenova/modnet';

export interface SubjectState {
  x: number;        // 正規化 0.0〜1.0
  y: number;        // 正規化 0.0〜1.0
  scale: number;    // 0.05〜3.0
  rotation: number; // degrees -180〜180
  flipped: boolean;
}

export const DEFAULT_STATE: SubjectState = {
  x: 0.5,
  y: 0.5,
  scale: 1.0,
  rotation: 0,
  flipped: false,
};
