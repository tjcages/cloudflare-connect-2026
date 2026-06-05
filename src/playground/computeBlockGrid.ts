import { applyTextureLuminanceGamma, pixelLuminance } from "./colorWhiteness";
import { STRIPE_CELL_SIZE } from "./stripeGridConstants";

/** Per-cell mean luminance (0–255), independent of the stripe list. */
export type LumaGrid = {
  cols: number;
  rows: number;
  luma: Uint8Array;
};

/** Per-cell stripe index (0 = background, 1…N), resolved from luminance + the stripe list. */
export type BlockGrid = {
  cols: number;
  rows: number;
  indices: Uint8Array;
};

/** Mean Rec.709 luminance (0–1) of a cell; out-of-bounds pixels count as black. */
function cellMeanLuminance(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  col: number,
  row: number,
  gamma: number,
  cellWidth: number,
  cellHeight: number,
): number {
  const originX = col * cellWidth;
  const originY = row * cellHeight;

  let sum = 0;
  for (let j = 0; j < cellHeight; j++) {
    for (let i = 0; i < cellWidth; i++) {
      const x = originX + i;
      const y = originY + j;
      if (x >= imageWidth || y >= imageHeight) {
        continue;
      }
      const idx = (y * imageWidth + x) * 4;
      const r = pixels[idx] ?? 0;
      const g = pixels[idx + 1] ?? 0;
      const b = pixels[idx + 2] ?? 0;
      sum += applyTextureLuminanceGamma(pixelLuminance(r, g, b), gamma);
    }
  }

  return sum / Math.max(1, cellWidth * cellHeight);
}

export function computeBlockGrid(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  gamma = 1,
  cellWidth: number = STRIPE_CELL_SIZE,
  cellHeight: number = STRIPE_CELL_SIZE,
): LumaGrid {
  const safeCellWidth = Math.max(1, Math.round(cellWidth));
  const safeCellHeight = Math.max(1, Math.round(cellHeight));
  const cols = Math.ceil(imageWidth / safeCellWidth);
  const rows = Math.ceil(imageHeight / safeCellHeight);
  const luma = new Uint8Array(cols * rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const mean = cellMeanLuminance(pixels, imageWidth, imageHeight, col, row, gamma, safeCellWidth, safeCellHeight);
      luma[row * cols + col] = Math.round(Math.min(1, Math.max(0, mean)) * 255);
    }
  }

  return { cols, rows, luma };
}
