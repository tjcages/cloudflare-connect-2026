export const BASE_UNIT = 40;
export const SMALL_CELL_SIZE = 40;
export const LARGE_CELL_SIZE = 80;
export const STROKE_COLOR = "#F3F3F3";

export type GridCellKind = "small" | "large" | "overlaySmall";

export type GridCell = {
  id: string;
  kind: GridCellKind;
  x: number;
  y: number;
  width: typeof SMALL_CELL_SIZE | typeof LARGE_CELL_SIZE;
  height: typeof SMALL_CELL_SIZE | typeof LARGE_CELL_SIZE;
};

export type GapMask = boolean[][];

export type GridConfig = {
  seed: string;
  width: number;
  height: number;
  density: number;
  smallCellRatio: number;
  largeCellRatio: number;
  strokeColor: string;
  gapMask: GapMask;
};

export type NormalizedGridConfig = GridConfig & {
  logicalWidth: number;
  logicalHeight: number;
  renderWidth: number;
  renderHeight: number;
  columns: number;
  rows: number;
};

export type GeneratedGrid = {
  config: NormalizedGridConfig;
  cells: GridCell[];
};

export type CandidateCell = {
  kind: GridCellKind;
  x: number;
  y: number;
  width: typeof SMALL_CELL_SIZE | typeof LARGE_CELL_SIZE;
  height: typeof SMALL_CELL_SIZE | typeof LARGE_CELL_SIZE;
};
