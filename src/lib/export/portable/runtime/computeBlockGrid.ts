import { pixelLuminance } from "./colorWhiteness";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  applyTextureLuminanceAdjustments,
  normalizePlaygroundTextureAdjustments,
  type PlaygroundTextureAdjustments,
} from "./playgroundTextureAdjustments";
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
  adjustments: PlaygroundTextureAdjustments,
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
      sum += applyTextureLuminanceAdjustments(pixelLuminance(r, g, b), adjustments, col, row);
    }
  }

  return sum / STRIPE_BLOCK_SAMPLE_COUNT;
}

function applyLumaGridEffects(
  luma: Uint8Array,
  cols: number,
  rows: number,
  adjustments: PlaygroundTextureAdjustments,
): Uint8Array {
  const blurRadius = Math.round(adjustments.blurRadius);
  if (blurRadius <= 0 && adjustments.sharpenAmount <= 0) {
    return luma;
  }
  const blurred = new Uint8Array(luma.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let sum = 0;
      let count = 0;
      for (let y = Math.max(0, row - blurRadius); y <= Math.min(rows - 1, row + blurRadius); y++) {
        for (let x = Math.max(0, col - blurRadius); x <= Math.min(cols - 1, col + blurRadius); x++) {
          sum += luma[y * cols + x] ?? 0;
          count += 1;
        }
      }
      blurred[row * cols + col] = Math.round(sum / Math.max(1, count));
    }
  }
  if (adjustments.sharpenAmount <= 0) {
    return blurred;
  }
  const sharpened = new Uint8Array(luma.length);
  for (let index = 0; index < luma.length; index++) {
    const original = luma[index] ?? 0;
    const soft = blurred[index] ?? original;
    sharpened[index] = Math.round(Math.min(255, Math.max(0, original + (original - soft) * adjustments.sharpenAmount)));
  }
  return sharpened;
}

export function computeBlockGrid(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  gamma = 1,
  adjustmentsInput: PlaygroundTextureAdjustments = DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
): LumaGrid {
  const cols = Math.ceil(imageWidth / STRIPE_CELL_SIZE);
  const rows = Math.ceil(imageHeight / STRIPE_CELL_SIZE);
  const luma = new Uint8Array(cols * rows);
  const adjustments = normalizePlaygroundTextureAdjustments({
    ...adjustmentsInput,
    gamma,
  });

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const mean = cellMeanLuminance(pixels, imageWidth, imageHeight, col, row, adjustments);
      luma[row * cols + col] = Math.round(Math.min(1, Math.max(0, mean)) * 255);
    }
  }

  return { cols, rows, luma: applyLumaGridEffects(luma, cols, rows, adjustments) };
}
