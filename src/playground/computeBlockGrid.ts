import {
  colorDistanceLuminance,
  colorPixelPresence,
  DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
  isNonBackgroundColorPixel,
  finalizeStripeBucketingLuminance,
  normalizeTextureLuminanceMode,
  pixelTextureLuminance,
  type TextureLuminanceSettings,
} from "./colorWhiteness";
import { mergeFlameColorBytes } from "./playgroundFlameComposite";
import { resolveFlamesEdgeMaskAlpha, type PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  applyTextureLuminanceAdjustments,
  applyTextureRgbAdjustments,
  blurRgbaPixels,
  compositeRgbaOverBackground,
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
  /** Per-cell color fill factor 0–255 (colors mode width scaling). */
  colorCoverage?: Uint8Array;
};

/** Per-cell stripe index (0 = background, 1…N), resolved from luminance + the stripe list. */
export type BlockGrid = {
  cols: number;
  rows: number;
  indices: Uint8Array;
  /** Per-cell mean source RGB, three bytes per cell. */
  colors?: Uint8Array;
  /** Per-cell color fill factor 0–255 (colors mode width scaling). */
  colorCoverage?: Uint8Array;
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
): { luma: number; r: number; g: number; b: number; colorCoverage: number; hasFlameSample: boolean } {
  const originX = col * cellWidth;
  const originY = row * cellHeight;
  const luminanceMode = normalizeTextureLuminanceMode(luminanceSettings?.mode);
  const colorsMode = luminanceMode === "colors";
  const backgroundColor = luminanceSettings?.backgroundColor ?? DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR;

  let lumaSum = 0;
  let lumaMax = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let rMax = 0;
  let gMax = 0;
  let bMax = 0;
  let coloredCount = 0;
  let coloredDistanceSum = 0;
  let coloredLumaSum = 0;
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

      const distance = colorsMode ? colorDistanceLuminance(r, g, b, backgroundColor) : 0;
      const rawPresence = colorsMode
        ? colorPixelPresence(r, g, b, backgroundColor)
        : pixelTextureLuminance(r, g, b, luminanceSettings);
      if (colorsMode && isNonBackgroundColorPixel(r, g, b, backgroundColor)) {
        coloredCount += 1;
        coloredDistanceSum += distance;
        let adjustedPresence = applyTextureLuminanceAdjustments(rawPresence, adjustments, col, row);
        if (reveal?.config.preset === "randomColumns") {
          adjustedPresence *= randomColumnRevealMultiplier({
            x,
            col,
            cols: reveal.cols,
            cellWidth,
            progress: reveal.progress,
            config: reveal.config.randomColumns,
            ranks: reveal.ranks,
          });
        }
        coloredLumaSum += adjustedPresence;
      }

      let luma = colorsMode ? rawPresence : pixelTextureLuminance(r, g, b, luminanceSettings);
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
  const meanR = rSum / sampleCount;
  const meanG = gSum / sampleCount;
  const meanB = bSum / sampleCount;

  if (hasFlameSample) {
    const fillRatio = coloredCount / sampleCount;
    const meanColoredPresence = coloredCount > 0 ? coloredLumaSum / coloredCount : lumaMax;
    return {
      luma: finalizeStripeBucketingLuminance(lumaMax, luminanceMode),
      r: rMax,
      g: gMax,
      b: bMax,
      colorCoverage: Math.min(1, Math.max(fillRatio * meanColoredPresence, lumaMax)),
      hasFlameSample: true,
    };
  }

  if (colorsMode) {
    const adjustedRgb = applyTextureRgbAdjustments(meanR, meanG, meanB, adjustments, luminanceSettings, col, row);
    if (coloredCount > 0 && coloredDistanceSum > 0) {
      const fillRatio = coloredCount / sampleCount;
      const meanColoredDistance = coloredDistanceSum / coloredCount;
      const meanColoredPresence = coloredLumaSum / coloredCount;
      return {
        luma: meanColoredPresence,
        // Full-cell mean blends foreground with the texture background (e.g. sparse red → light pink).
        r: adjustedRgb.r,
        g: adjustedRgb.g,
        b: adjustedRgb.b,
        colorCoverage: fillRatio * meanColoredDistance,
        hasFlameSample: false,
      };
    }
    return {
      luma: 0,
      r: adjustedRgb.r,
      g: adjustedRgb.g,
      b: adjustedRgb.b,
      colorCoverage: 0,
      hasFlameSample: false,
    };
  }

  return {
    luma: finalizeStripeBucketingLuminance(lumaSum / sampleCount, luminanceMode),
    r: meanR,
    g: meanG,
    b: meanB,
    colorCoverage: 1,
    hasFlameSample: false,
  };
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
  const colorsMode = normalizeTextureLuminanceMode(luminanceSettings?.mode) === "colors";
  const luma = new Uint8Array(cols * rows);
  const colors = new Uint8Array(cols * rows * 3);
  const colorCoverage = colorsMode ? new Uint8Array(cols * rows) : undefined;
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

  const backgroundColor = luminanceSettings?.backgroundColor ?? DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR;
  const compositedPixels = compositeRgbaOverBackground(pixels, imageWidth, imageHeight, backgroundColor);
  const sourcePixels = blurRgbaPixels(compositedPixels, imageWidth, imageHeight, adjustments);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const mean = cellMeanSample(
        sourcePixels,
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
      if (colorCoverage) {
        colorCoverage[cellIndex] = Math.round(Math.min(1, Math.max(0, mean.colorCoverage)) * 255);
      }
    }
  }

  if (flames) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellIndex = row * cols + col;
        if (!flameCells[cellIndex]) {
          continue;
        }
        const mean = cellMeanSample(
          compositedPixels,
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
        luma[cellIndex] = Math.round(Math.min(1, Math.max(0, mean.luma)) * 255);
      }
    }
  }

  return { cols, rows, luma, colors, colorCoverage };
}
