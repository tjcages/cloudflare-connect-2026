import type { BlockGrid } from "./computeBlockGrid";

/**
 * Resamples stripe indices when grid dimensions change.
 * Each new cell takes the mode index from overlapping old cells (box downsample).
 */
export function resampleBlockGrid(
  indices: Uint8Array,
  oldCols: number,
  oldRows: number,
  newCols: number,
  newRows: number,
): BlockGrid {
  if (oldCols <= 0 || oldRows <= 0 || newCols <= 0 || newRows <= 0) {
    return { cols: newCols, rows: newRows, indices: new Uint8Array(newCols * newRows) };
  }

  const out = new Uint8Array(newCols * newRows);
  const oldCellW = 1 / oldCols;
  const oldCellH = 1 / oldRows;
  const newCellW = 1 / newCols;
  const newCellH = 1 / newRows;

  for (let row = 0; row < newRows; row++) {
    for (let col = 0; col < newCols; col++) {
      const x0 = col * newCellW;
      const x1 = (col + 1) * newCellW;
      const y0 = row * newCellH;
      const y1 = (row + 1) * newCellH;

      const oldCol0 = Math.floor(x0 / oldCellW);
      const oldCol1 = Math.min(oldCols - 1, Math.ceil(x1 / oldCellW) - 1);
      const oldRow0 = Math.floor(y0 / oldCellH);
      const oldRow1 = Math.min(oldRows - 1, Math.ceil(y1 / oldCellH) - 1);

      const counts = new Map<number, number>();
      let bestIndex = 0;
      let bestCount = 0;

      for (let oldRow = oldRow0; oldRow <= oldRow1; oldRow++) {
        for (let oldCol = oldCol0; oldCol <= oldCol1; oldCol++) {
          const idx = indices[oldRow * oldCols + oldCol] ?? 0;
          const next = (counts.get(idx) ?? 0) + 1;
          counts.set(idx, next);
          if (next > bestCount) {
            bestCount = next;
            bestIndex = idx;
          }
        }
      }

      out[row * newCols + col] = bestIndex;
    }
  }

  return { cols: newCols, rows: newRows, indices: out };
}
