import { applyTextureLuminanceGamma, pixelLuminance } from "./colorWhiteness";
import { STRIPE_BLOCK_SAMPLE_COUNT, STRIPE_BLOCK_SAMPLES, STRIPE_CELL_SIZE } from "./stripeGridConstants";

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

/** Mean Rec.709 luminance (0–1) of a 7×7 cell; out-of-bounds pixels count as black. */
function cellMeanLuminance(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  col: number,
  row: number,
  gamma: number,
): number {
  const originX = col * STRIPE_CELL_SIZE;
  const originY = row * STRIPE_CELL_SIZE;

  let sum = 0;
  for (let j = 0; j < STRIPE_BLOCK_SAMPLES; j++) {
    for (let i = 0; i < STRIPE_BLOCK_SAMPLES; i++) {
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

  return sum / STRIPE_BLOCK_SAMPLE_COUNT;
}

export function computeBlockGrid(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  gamma = 1,
): LumaGrid {
  const cols = Math.ceil(imageWidth / STRIPE_CELL_SIZE);
  const rows = Math.ceil(imageHeight / STRIPE_CELL_SIZE);
  const luma = new Uint8Array(cols * rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const mean = cellMeanLuminance(pixels, imageWidth, imageHeight, col, row, gamma);
      luma[row * cols + col] = Math.round(Math.min(1, Math.max(0, mean)) * 255);
    }
  }

  return { cols, rows, luma };
}
