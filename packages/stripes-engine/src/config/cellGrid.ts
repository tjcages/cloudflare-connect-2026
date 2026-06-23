export type CellGrid = { cols: number; rows: number };

export function resolveCellGrid(cssWidth: number, cssHeight: number, cellWidth: number, cellHeight: number): CellGrid {
  return {
    cols: Math.max(1, Math.ceil(cssWidth / cellWidth)),
    rows: Math.max(1, Math.ceil(cssHeight / cellHeight)),
  };
}
