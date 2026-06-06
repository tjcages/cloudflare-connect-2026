import { pixelLuminance } from "./colorWhiteness";
import { resolveFlamesEdgeMaskAlpha, type PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  applyTextureLuminanceAdjustments,
  normalizePlaygroundTextureAdjustments,
  type PlaygroundTextureAdjustments,
} from "./playgroundTextureAdjustments";
import { STRIPE_CELL_SIZE } from "./stripeGridConstants";

export type FlamesLuminanceContribution = {
  pixels: Uint8ClampedArray;
  imageWidth: number;
  imageHeight: number;
  mask: Pick<PlaygroundFlamesConfig, "edgeMaskEnabled" | "edgeMaskStart" | "edgeMaskEnd" | "edgeMaskPower">;
};

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
  adjustments: PlaygroundTextureAdjustments,
  flames?: FlamesLuminanceContribution,
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
      let luma = pixelLuminance(r, g, b);
      if (
        flames &&
        flames.imageWidth === imageWidth &&
        flames.imageHeight === imageHeight &&
        flames.pixels.length >= idx + 3
      ) {
        const flameLuma = pixelLuminance(
          flames.pixels[idx] ?? 0,
          flames.pixels[idx + 1] ?? 0,
          flames.pixels[idx + 2] ?? 0,
        );
        const mask = resolveFlamesEdgeMaskAlpha(x / imageWidth, y / imageHeight, flames.mask);
        luma = Math.max(luma, flameLuma * mask);
      }
      sum += applyTextureLuminanceAdjustments(luma, adjustments, col, row);
    }
  }

  return sum / Math.max(1, cellWidth * cellHeight);
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
  cellWidth: number = STRIPE_CELL_SIZE,
  cellHeight: number = STRIPE_CELL_SIZE,
  adjustmentsInput: PlaygroundTextureAdjustments = DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  flames?: FlamesLuminanceContribution,
): LumaGrid {
  const safeCellWidth = Math.max(1, Math.round(cellWidth));
  const safeCellHeight = Math.max(1, Math.round(cellHeight));
  const cols = Math.ceil(imageWidth / safeCellWidth);
  const rows = Math.ceil(imageHeight / safeCellHeight);
  const luma = new Uint8Array(cols * rows);
  const adjustments = normalizePlaygroundTextureAdjustments({
    ...adjustmentsInput,
    gamma,
  });

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const mean = cellMeanLuminance(
        pixels,
        imageWidth,
        imageHeight,
        col,
        row,
        gamma,
        safeCellWidth,
        safeCellHeight,
        adjustments,
        flames,
      );
      luma[row * cols + col] = Math.round(Math.min(1, Math.max(0, mean)) * 255);
    }
  }

  return { cols, rows, luma: applyLumaGridEffects(luma, cols, rows, adjustments) };
}
