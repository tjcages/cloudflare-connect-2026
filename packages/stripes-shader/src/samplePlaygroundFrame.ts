import type { CursorTrailPixelBounds } from "./cursorTrail";
import {
  computeBlockGrid,
  computeBlockGridRegion,
  createGridPreprocessCache,
  type BlockGrid,
  type FlamesLuminanceContribution,
  type GridPreprocessCache,
  type LumaGrid,
} from "./computeBlockGrid";
import { normalizeTextureLuminanceMode, type TextureLuminanceSettings } from "./colorWhiteness";
import { PlaygroundFlamesRaster, rasterizePlaygroundFlames, type PlaygroundFlamesState } from "./playgroundFlames";
import type { PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
import type { PlaygroundEdgeMaskConfig } from "./playgroundEdgeMaskConfig";
import {
  promoteColorsModeIndicesInRegion,
  resolveStripeIndicesInRegion,
  smoothBlockGridIndicesInRegion,
  type GridCellRegion,
} from "./playgroundGridDirty";
import { smoothBlockGridIndices } from "./stabilizeBlockGrid";
import { resolveStripeIndices, resolveStripesForLuminanceMode, type StripeColors } from "./stripeColors";
import {
  DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
  resolvePlaygroundDrawRects,
  type PlaygroundSourceTransform,
} from "./playgroundSourceTransform";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  type PlaygroundTextureAdjustments,
} from "./playgroundTextureAdjustments";

export type PlaygroundGridBuildState = {
  stableIndices?: Uint8Array;
};

export function sampleTextureFrame(
  source: CanvasImageSource,
  displayWidth: number,
  displayHeight: number,
  sampleCanvas: HTMLCanvasElement,
  sampleCtx: CanvasRenderingContext2D,
  sourceTransform: PlaygroundSourceTransform = DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
): ImageData | null {
  if (displayWidth <= 0 || displayHeight <= 0) {
    return null;
  }
  sampleCanvas.width = displayWidth;
  sampleCanvas.height = displayHeight;
  sampleCtx.clearRect(0, 0, displayWidth, displayHeight);
  const sourceSize = getCanvasSourceSize(source);
  const { source: sourceRect, destination } = resolvePlaygroundDrawRects(
    sourceSize,
    { width: displayWidth, height: displayHeight },
    sourceTransform,
  );
  sampleCtx.drawImage(
    source,
    sourceRect.sx,
    sourceRect.sy,
    sourceRect.sw,
    sourceRect.sh,
    destination.dx,
    destination.dy,
    destination.dw,
    destination.dh,
  );
  return sampleCtx.getImageData(0, 0, displayWidth, displayHeight);
}

function resolveFlamesLuminanceContribution(
  flamesState: PlaygroundFlamesState | null | undefined,
  flamesConfig: PlaygroundFlamesConfig | null | undefined,
  displayWidth: number,
  displayHeight: number,
  flamesRaster?: PlaygroundFlamesRaster,
): FlamesLuminanceContribution | undefined {
  if (!flamesState || !flamesConfig?.enabled) {
    return undefined;
  }
  const raster = rasterizePlaygroundFlames(flamesState, flamesConfig, displayWidth, displayHeight, flamesRaster);
  if (!raster) {
    return undefined;
  }
  return {
    pixels: raster.data,
    imageWidth: displayWidth,
    imageHeight: displayHeight,
  };
}

function buildIndicesFromLumaGrid(
  lumaGrid: LumaGrid,
  colors: StripeColors,
  luminanceSettings: TextureLuminanceSettings | undefined,
  state: PlaygroundGridBuildState,
  smoothingMaxStep: number | undefined,
  region?: GridCellRegion,
  previousGrid?: BlockGrid,
): Uint8Array {
  const effectiveStripes = resolveStripesForLuminanceMode(
    colors,
    normalizeTextureLuminanceMode(luminanceSettings?.mode),
  );
  const colorsMode = normalizeTextureLuminanceMode(luminanceSettings?.mode) === "colors";
  const rawIndices = region
    ? new Uint8Array(previousGrid?.indices ?? state.stableIndices ?? new Uint8Array(lumaGrid.cols * lumaGrid.rows))
    : resolveStripeIndices(lumaGrid.luma, effectiveStripes);

  if (region) {
    resolveStripeIndicesInRegion(lumaGrid.luma, effectiveStripes, region, lumaGrid.cols, rawIndices);
    if (colorsMode && lumaGrid.colorCoverage) {
      promoteColorsModeIndicesInRegion(rawIndices, lumaGrid.colorCoverage, region, lumaGrid.cols);
    }
    return smoothBlockGridIndicesInRegion(rawIndices, state.stableIndices, region, lumaGrid.cols, smoothingMaxStep);
  }

  if (colorsMode && lumaGrid.colorCoverage) {
    for (let index = 0; index < rawIndices.length; index++) {
      if ((rawIndices[index] ?? 0) === 0 && (lumaGrid.colorCoverage[index] ?? 0) > 0) {
        rawIndices[index] = 1;
      }
    }
  }

  return smoothBlockGridIndices(rawIndices, state.stableIndices, smoothingMaxStep);
}

function getCanvasSourceSize(source: CanvasImageSource): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  const sized = source as { width?: number; height?: number };
  return { width: Number(sized.width) || 0, height: Number(sized.height) || 0 };
}

export function sampleVideoFrame(
  video: HTMLVideoElement,
  displayWidth: number,
  displayHeight: number,
  sampleCanvas: HTMLCanvasElement,
  sampleCtx: CanvasRenderingContext2D,
  sourceTransform: PlaygroundSourceTransform = DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
): ImageData | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return null;
  }
  return sampleTextureFrame(video, displayWidth, displayHeight, sampleCanvas, sampleCtx, sourceTransform);
}

export type PlaygroundGridBuildOptions = {
  cellWidth?: number;
  cellHeight?: number;
  /** Max stripe-index change per update (0 = snap instantly). */
  smoothingMaxStep?: number;
  textureAdjustments?: PlaygroundTextureAdjustments;
  luminanceSettings?: TextureLuminanceSettings;
  flamesState?: PlaygroundFlamesState | null;
  flamesConfig?: PlaygroundFlamesConfig | null;
  flamesRaster?: PlaygroundFlamesRaster;
  /** Global edge mask: fades per-cell luma near canvas edges in the CPU block map + export. */
  edgeMask?: PlaygroundEdgeMaskConfig;
  /** When set with `previousLumaGrid`, only recompute stripe cells inside this region. */
  dirtyRegion?: GridCellRegion;
  previousLumaGrid?: LumaGrid;
  previousGrid?: BlockGrid;
  preprocessCache?: GridPreprocessCache;
  pixelDirtyBounds?: CursorTrailPixelBounds | null;
};

export function buildPlaygroundBlockGrid(
  frame: ImageData,
  displayWidth: number,
  displayHeight: number,
  colors: StripeColors,
  state: PlaygroundGridBuildState,
  gamma = 1,
  options: PlaygroundGridBuildOptions = {},
): {
  grid: BlockGrid;
  state: PlaygroundGridBuildState;
  partial: boolean;
  lumaGrid: LumaGrid;
  preprocessCache: GridPreprocessCache | null;
} {
  const flames = resolveFlamesLuminanceContribution(
    options.flamesState,
    options.flamesConfig,
    displayWidth,
    displayHeight,
    options.flamesRaster,
  );

  const canUsePartialRegion =
    options.dirtyRegion &&
    options.previousLumaGrid &&
    options.previousLumaGrid.cols > 0 &&
    options.previousLumaGrid.rows > 0;

  const lumaGrid = canUsePartialRegion
    ? computeBlockGridRegion(
        frame.data,
        displayWidth,
        displayHeight,
        options.dirtyRegion!,
        options.previousLumaGrid!,
        options.textureAdjustments?.gamma ?? gamma,
        options.cellWidth,
        options.cellHeight,
        options.textureAdjustments ?? DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
        flames,
        options.luminanceSettings,
        options.preprocessCache,
        options.pixelDirtyBounds,
        options.edgeMask,
      )
    : computeBlockGrid(
        frame.data,
        displayWidth,
        displayHeight,
        options.textureAdjustments?.gamma ?? gamma,
        options.cellWidth,
        options.cellHeight,
        options.textureAdjustments ?? DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
        flames,
        options.luminanceSettings,
        options.edgeMask,
      );

  const stableIndices = buildIndicesFromLumaGrid(
    lumaGrid,
    colors,
    options.luminanceSettings,
    state,
    options.smoothingMaxStep,
    canUsePartialRegion ? options.dirtyRegion : undefined,
    options.previousGrid,
  );

  const preprocessCache = canUsePartialRegion
    ? (options.preprocessCache ?? null)
    : createGridPreprocessCache(
        frame.data,
        displayWidth,
        displayHeight,
        options.textureAdjustments?.gamma ?? gamma,
        options.cellWidth,
        options.cellHeight,
        options.textureAdjustments ?? DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
        options.luminanceSettings,
      );

  return {
    grid: {
      cols: lumaGrid.cols,
      rows: lumaGrid.rows,
      indices: stableIndices,
      colors: lumaGrid.colors,
      colorCoverage: lumaGrid.colorCoverage,
      luma: lumaGrid.luma,
    },
    state: { stableIndices },
    partial: Boolean(canUsePartialRegion),
    lumaGrid: lumaGrid,
    preprocessCache,
  };
}
