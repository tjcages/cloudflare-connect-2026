import { pixelTextureLuminance, type TextureLuminanceSettings } from "./colorWhiteness";
import { mergeFlameColorBytes } from "./playgroundFlameComposite";
import { resolveFlamesEdgeMaskAlpha, type PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  applyTextureLuminanceAdjustments,
  normalizePlaygroundTextureAdjustments,
  type PlaygroundTextureAdjustments,
} from "./playgroundTextureAdjustments";
import {
  buildRandomColumnRevealRanks,
  randomColumnRevealMultiplier,
  type PlaygroundRevealOptions,
} from "./playgroundReveal";
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
  /** Per-cell mean source RGB, three bytes per cell. */
  colors: Uint8Array;
};

/** Per-cell stripe index (0 = background, 1…N), resolved from luminance + the stripe list. */
export type BlockGrid = {
  cols: number;
  rows: number;
  indices: Uint8Array;
  /** Per-cell mean source RGB, three bytes per cell. */
  colors?: Uint8Array;
};

type RandomColumnsRevealSampling = Required<Pick<PlaygroundRevealOptions, "config" | "progress">> &
  Pick<PlaygroundRevealOptions, "replayKey"> & {
    ranks: Uint32Array;
    cols: number;
  };

/** Mean Rec.709 luminance (0–1) of a cell; out-of-bounds pixels count as black. */
function cellMeanSample(
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
  reveal?: RandomColumnsRevealSampling,
  luminanceSettings?: TextureLuminanceSettings,
): { luma: number; r: number; g: number; b: number; hasFlameSample: boolean } {
  const originX = col * cellWidth;
  const originY = row * cellHeight;

  let lumaSum = 0;
  let lumaMax = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let rMax = 0;
  let gMax = 0;
  let bMax = 0;
  let count = 0;
  let hasFlameSample = false;
  for (let j = 0; j < cellHeight; j++) {
    for (let i = 0; i < cellWidth; i++) {
      const x = originX + i;
      const y = originY + j;
      if (x >= imageWidth || y >= imageHeight) {
        continue;
      }
      const idx = (y * imageWidth + x) * 4;
      let r = pixels[idx] ?? 0;
      let g = pixels[idx + 1] ?? 0;
      let b = pixels[idx + 2] ?? 0;
      if (
        flames &&
        flames.imageWidth === imageWidth &&
        flames.imageHeight === imageHeight &&
        flames.pixels.length >= idx + 3
      ) {
        const mask = resolveFlamesEdgeMaskAlpha(x / imageWidth, y / imageHeight, flames.mask);
        if (mask > 0) {
          const flameR = flames.pixels[idx] ?? 0;
          const flameG = flames.pixels[idx + 1] ?? 0;
          const flameB = flames.pixels[idx + 2] ?? 0;
          const merged = mergeFlameColorBytes(r, g, b, flameR, flameG, flameB, mask);
          if (merged.hasFlame) {
            hasFlameSample = true;
          }
          r = merged.r;
          g = merged.g;
          b = merged.b;
        }
      }
      rSum += r;
      gSum += g;
      bSum += b;
      rMax = Math.max(rMax, r);
      gMax = Math.max(gMax, g);
      bMax = Math.max(bMax, b);
      count += 1;
      let luma = pixelTextureLuminance(r, g, b, luminanceSettings);
      luma = applyTextureLuminanceAdjustments(luma, adjustments, col, row);
      if (reveal?.config.preset === "randomColumns") {
        luma *= randomColumnRevealMultiplier({
          x,
          col,
          cols: reveal.cols,
          cellWidth,
          progress: reveal.progress,
          config: reveal.config.randomColumns,
          ranks: reveal.ranks,
        });
      }
      lumaSum += luma;
      lumaMax = Math.max(lumaMax, luma);
    }
  }

  const sampleCount = Math.max(1, count);
  if (hasFlameSample) {
    return {
      luma: lumaMax,
      r: rMax,
      g: gMax,
      b: bMax,
      hasFlameSample: true,
    };
  }
  return {
    luma: lumaSum / sampleCount,
    r: rSum / sampleCount,
    g: gSum / sampleCount,
    b: bSum / sampleCount,
    hasFlameSample: false,
  };
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
  reveal?: PlaygroundRevealOptions,
  luminanceSettings?: TextureLuminanceSettings,
): LumaGrid {
  const safeCellWidth = Math.max(1, Math.round(cellWidth));
  const safeCellHeight = Math.max(1, Math.round(cellHeight));
  const cols = Math.ceil(imageWidth / safeCellWidth);
  const rows = Math.ceil(imageHeight / safeCellHeight);
  const luma = new Uint8Array(cols * rows);
  const colors = new Uint8Array(cols * rows * 3);
  const flameCells = new Uint8Array(cols * rows);
  const adjustments = normalizePlaygroundTextureAdjustments({
    ...adjustmentsInput,
    gamma,
  });
  const randomColumnsReveal =
    reveal?.config?.preset === "randomColumns" && (reveal.progress ?? 1) < 1
      ? {
          config: reveal.config,
          progress: reveal.progress ?? 1,
          replayKey: reveal.replayKey,
          ranks: buildRandomColumnRevealRanks(cols, Math.max(0, reveal.replayKey ?? 0)),
          cols,
        }
      : undefined;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const mean = cellMeanSample(
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
        randomColumnsReveal,
        luminanceSettings,
      );
      const cellIndex = row * cols + col;
      luma[cellIndex] = Math.round(Math.min(1, Math.max(0, mean.luma)) * 255);
      flameCells[cellIndex] = mean.hasFlameSample ? 1 : 0;
      const colorOffset = cellIndex * 3;
      colors[colorOffset] = Math.round(Math.min(255, Math.max(0, mean.r)));
      colors[colorOffset + 1] = Math.round(Math.min(255, Math.max(0, mean.g)));
      colors[colorOffset + 2] = Math.round(Math.min(255, Math.max(0, mean.b)));
    }
  }

  const processedLuma = applyLumaGridEffects(luma, cols, rows, adjustments);
  if (flames) {
    for (let index = 0; index < flameCells.length; index++) {
      if (flameCells[index]) {
        processedLuma[index] = luma[index] ?? processedLuma[index]!;
      }
    }
  }

  return { cols, rows, luma: processedLuma, colors };
}
