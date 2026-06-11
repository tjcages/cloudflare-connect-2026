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
import type { CursorTrailPixelBounds } from "./cursorTrail";
import { expandPixelBounds, type GridCellRegion } from "./playgroundGridDirty";
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
  /** Per-cell bucketing-space luminance (0–255), already inverted for overlay mode. */
  luma?: Uint8Array;
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

export type GridPreprocessCache = {
  cols: number;
  rows: number;
  safeCellWidth: number;
  safeCellHeight: number;
  adjustments: PlaygroundTextureAdjustments;
  compositedPixels: Uint8ClampedArray;
  sourcePixels: Uint8ClampedArray;
  randomColumnsReveal: RandomColumnsRevealSampling | undefined;
};

function boxBlurSampleAt(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  blurRadius: number,
): { r: number; g: number; b: number; a: number } {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let aSum = 0;
  let count = 0;
  for (let dy = -blurRadius; dy <= blurRadius; dy++) {
    for (let dx = -blurRadius; dx <= blurRadius; dx++) {
      const sampleX = x + dx;
      const sampleY = y + dy;
      if (sampleX < 0 || sampleY < 0 || sampleX >= width || sampleY >= height) {
        continue;
      }
      const idx = (sampleY * width + sampleX) * 4;
      rSum += pixels[idx] ?? 0;
      gSum += pixels[idx + 1] ?? 0;
      bSum += pixels[idx + 2] ?? 0;
      aSum += pixels[idx + 3] ?? 255;
      count += 1;
    }
  }
  const divisor = Math.max(1, count);
  return {
    r: Math.round(rSum / divisor),
    g: Math.round(gSum / divisor),
    b: Math.round(bSum / divisor),
    a: Math.round(aSum / divisor),
  };
}

export function createGridPreprocessCache(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  gamma = 1,
  cellWidth: number = STRIPE_CELL_SIZE,
  cellHeight: number = STRIPE_CELL_SIZE,
  adjustmentsInput: PlaygroundTextureAdjustments = DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  reveal?: PlaygroundRevealOptions,
  luminanceSettings?: TextureLuminanceSettings,
): GridPreprocessCache {
  return buildGridPreprocessContext(
    pixels,
    imageWidth,
    imageHeight,
    gamma,
    cellWidth,
    cellHeight,
    adjustmentsInput,
    reveal,
    luminanceSettings,
  );
}

/** Recomposite and re-blur only pixels inside `bounds` (expanded by blur radius). */
export function patchGridPreprocessRegion(
  cache: GridPreprocessCache,
  rawPixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  bounds: CursorTrailPixelBounds,
  luminanceSettings?: TextureLuminanceSettings,
): void {
  const backgroundColor = luminanceSettings?.backgroundColor ?? DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR;
  const bgR = (backgroundColor >> 16) & 0xff;
  const bgG = (backgroundColor >> 8) & 0xff;
  const bgB = backgroundColor & 0xff;
  const blurRadius = Math.round(cache.adjustments.blurRadius);
  const expanded = expandPixelBounds(bounds, blurRadius, imageWidth, imageHeight);
  const minX = expanded.dirtyMinX;
  const minY = expanded.dirtyMinY;
  const maxX = expanded.dirtyMaxX;
  const maxY = expanded.dirtyMaxY;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = (y * imageWidth + x) * 4;
      const alpha = (rawPixels[idx + 3] ?? 255) / 255;
      cache.compositedPixels[idx] = Math.round((rawPixels[idx] ?? 0) * alpha + bgR * (1 - alpha));
      cache.compositedPixels[idx + 1] = Math.round((rawPixels[idx + 1] ?? 0) * alpha + bgG * (1 - alpha));
      cache.compositedPixels[idx + 2] = Math.round((rawPixels[idx + 2] ?? 0) * alpha + bgB * (1 - alpha));
      cache.compositedPixels[idx + 3] = 255;
    }
  }

  if (blurRadius <= 0 && cache.adjustments.sharpenAmount <= 0) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = (y * imageWidth + x) * 4;
        cache.sourcePixels[idx] = cache.compositedPixels[idx] ?? 0;
        cache.sourcePixels[idx + 1] = cache.compositedPixels[idx + 1] ?? 0;
        cache.sourcePixels[idx + 2] = cache.compositedPixels[idx + 2] ?? 0;
        cache.sourcePixels[idx + 3] = cache.compositedPixels[idx + 3] ?? 255;
      }
    }
    return;
  }

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const blurred =
        blurRadius > 0
          ? boxBlurSampleAt(cache.compositedPixels, imageWidth, imageHeight, x, y, blurRadius)
          : {
              r: cache.compositedPixels[(y * imageWidth + x) * 4] ?? 0,
              g: cache.compositedPixels[(y * imageWidth + x) * 4 + 1] ?? 0,
              b: cache.compositedPixels[(y * imageWidth + x) * 4 + 2] ?? 0,
              a: cache.compositedPixels[(y * imageWidth + x) * 4 + 3] ?? 255,
            };
      const idx = (y * imageWidth + x) * 4;
      if (cache.adjustments.sharpenAmount > 0) {
        for (let channel = 0; channel < 3; channel++) {
          const channelIdx = idx + channel;
          const original = cache.compositedPixels[channelIdx] ?? 0;
          const soft = channel === 0 ? blurred.r : channel === 1 ? blurred.g : blurred.b;
          cache.sourcePixels[channelIdx] = Math.round(
            Math.min(255, Math.max(0, original + (original - soft) * cache.adjustments.sharpenAmount)),
          );
        }
        cache.sourcePixels[idx + 3] = cache.compositedPixels[idx + 3] ?? 255;
      } else {
        cache.sourcePixels[idx] = blurred.r;
        cache.sourcePixels[idx + 1] = blurred.g;
        cache.sourcePixels[idx + 2] = blurred.b;
        cache.sourcePixels[idx + 3] = blurred.a;
      }
    }
  }
}

function buildGridPreprocessContext(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  gamma: number,
  cellWidth: number,
  cellHeight: number,
  adjustmentsInput: PlaygroundTextureAdjustments,
  reveal?: PlaygroundRevealOptions,
  luminanceSettings?: TextureLuminanceSettings,
): GridPreprocessCache {
  const safeCellWidth = Math.max(1, Math.round(cellWidth));
  const safeCellHeight = Math.max(1, Math.round(cellHeight));
  const cols = Math.ceil(imageWidth / safeCellWidth);
  const rows = Math.ceil(imageHeight / safeCellHeight);
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

  return {
    cols,
    rows,
    safeCellWidth,
    safeCellHeight,
    adjustments,
    compositedPixels,
    sourcePixels,
    randomColumnsReveal,
  };
}

function writeCellMeanToGrid(
  mean: ReturnType<typeof cellMeanSample>,
  cellIndex: number,
  luma: Uint8Array,
  colors: Uint8Array,
  colorCoverage: Uint8Array | undefined,
  flameCells: Uint8Array,
): void {
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

function sampleCellsInRegion(
  ctx: GridPreprocessCache,
  region: GridCellRegion,
  imageWidth: number,
  imageHeight: number,
  gamma: number,
  flames: FlamesLuminanceContribution | undefined,
  luminanceSettings: TextureLuminanceSettings | undefined,
  luma: Uint8Array,
  colors: Uint8Array,
  colorCoverage: Uint8Array | undefined,
  flameCells: Uint8Array,
): void {
  for (let row = region.rowMin; row <= region.rowMax; row++) {
    for (let col = region.colMin; col <= region.colMax; col++) {
      const mean = cellMeanSample(
        ctx.sourcePixels,
        imageWidth,
        imageHeight,
        col,
        row,
        gamma,
        ctx.safeCellWidth,
        ctx.safeCellHeight,
        ctx.adjustments,
        flames,
        ctx.randomColumnsReveal,
        luminanceSettings,
      );
      writeCellMeanToGrid(mean, row * ctx.cols + col, luma, colors, colorCoverage, flameCells);
    }
  }

  if (!flames) {
    return;
  }

  for (let row = region.rowMin; row <= region.rowMax; row++) {
    for (let col = region.colMin; col <= region.colMax; col++) {
      const cellIndex = row * ctx.cols + col;
      if (!flameCells[cellIndex]) {
        continue;
      }
      const mean = cellMeanSample(
        ctx.compositedPixels,
        imageWidth,
        imageHeight,
        col,
        row,
        gamma,
        ctx.safeCellWidth,
        ctx.safeCellHeight,
        ctx.adjustments,
        flames,
        ctx.randomColumnsReveal,
        luminanceSettings,
      );
      luma[cellIndex] = Math.round(Math.min(1, Math.max(0, mean.luma)) * 255);
    }
  }
}

/** Recompute only cells inside `region`, copying untouched cells from `previous`. */
export function computeBlockGridRegion(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  region: GridCellRegion,
  previous: LumaGrid,
  gamma = 1,
  cellWidth: number = STRIPE_CELL_SIZE,
  cellHeight: number = STRIPE_CELL_SIZE,
  adjustmentsInput: PlaygroundTextureAdjustments = DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  flames?: FlamesLuminanceContribution,
  reveal?: PlaygroundRevealOptions,
  luminanceSettings?: TextureLuminanceSettings,
  preprocessCache?: GridPreprocessCache,
  pixelDirtyBounds?: CursorTrailPixelBounds | null,
): LumaGrid {
  const ctx =
    preprocessCache && pixelDirtyBounds && pixelDirtyBounds.dirtyMaxX >= 0
      ? (patchGridPreprocessRegion(
          preprocessCache,
          pixels,
          imageWidth,
          imageHeight,
          pixelDirtyBounds,
          luminanceSettings,
        ),
        preprocessCache)
      : buildGridPreprocessContext(
          pixels,
          imageWidth,
          imageHeight,
          gamma,
          cellWidth,
          cellHeight,
          adjustmentsInput,
          reveal,
          luminanceSettings,
        );

  const luma = new Uint8Array(previous.luma);
  const colors = new Uint8Array(previous.colors);
  const colorCoverage = previous.colorCoverage ? new Uint8Array(previous.colorCoverage) : undefined;
  const flameCells = new Uint8Array(ctx.cols * ctx.rows);

  sampleCellsInRegion(
    ctx,
    region,
    imageWidth,
    imageHeight,
    gamma,
    flames,
    luminanceSettings,
    luma,
    colors,
    colorCoverage,
    flameCells,
  );

  return { cols: ctx.cols, rows: ctx.rows, luma, colors, colorCoverage };
}
