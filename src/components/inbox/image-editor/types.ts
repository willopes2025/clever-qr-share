export type EditorTool = 'pen' | 'text' | 'rect' | 'arrow' | 'crop';

export interface Point {
  x: number;
  y: number;
}

export interface StrokeOp {
  type: 'stroke';
  points: Point[];
  color: string;
  width: number;
}

export interface RectOp {
  type: 'rect';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
}

export interface ArrowOp {
  type: 'arrow';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
}

export interface TextOp {
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
}

export interface RotateOp {
  type: 'rotate';
}

export interface CropOp {
  type: 'crop';
  x: number;
  y: number;
  w: number;
  h: number;
}

export type EditorOp = StrokeOp | RectOp | ArrowOp | TextOp | RotateOp | CropOp;

export const EDITOR_COLORS = [
  '#ffffff',
  '#000000',
  '#ef4444',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
];
