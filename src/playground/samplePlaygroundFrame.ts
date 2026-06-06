import { computeBlockGrid, type BlockGrid, type FlamesLuminanceContribution } from "./computeBlockGrid";
import { rasterizePlaygroundFlames, type PlaygroundFlamesState } from "./playgroundFlames";
import type { PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
import { applyPlaygroundRevealToLumaGrid, type PlaygroundRevealOptions } from "./playgroundReveal";
import { smoothBlockGridIndices } from "./stabilizeBlockGrid";
import { resolveStripeIndices, type StripeColors } from "./stripeColors";
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
): FlamesLuminanceContribution | undefined {
  if (!flamesState || !flamesConfig?.enabled) {
    return undefined;
  }
  const raster = rasterizePlaygroundFlames(flamesState, flamesConfig, displayWidth, displayHeight);
  if (!raster) {
    return undefined;
  }
  return {
    pixels: raster.data,
    imageWidth: displayWidth,
    imageHeight: displayHeight,
    mask: flamesConfig,
  };
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
  flamesState?: PlaygroundFlamesState | null;
  flamesConfig?: PlaygroundFlamesConfig | null;
  reveal?: PlaygroundRevealOptions;
};

export function buildPlaygroundBlockGrid(
  frame: ImageData,
  displayWidth: number,
  displayHeight: number,
  colors: StripeColors,
  state: PlaygroundGridBuildState,
  gamma = 1,
  options: PlaygroundGridBuildOptions = {},
): { grid: BlockGrid; state: PlaygroundGridBuildState } {
  const flames = resolveFlamesLuminanceContribution(
    options.flamesState,
    options.flamesConfig,
    displayWidth,
    displayHeight,
  );
  const lumaGrid = computeBlockGrid(
    frame.data,
    displayWidth,
    displayHeight,
    options.textureAdjustments?.gamma ?? gamma,
    options.cellWidth,
    options.cellHeight,
    options.textureAdjustments ?? DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
    flames,
  );
  const revealedLumaGrid = options.reveal ? applyPlaygroundRevealToLumaGrid(lumaGrid, options.reveal) : lumaGrid;
  const rawIndices = resolveStripeIndices(revealedLumaGrid.luma, colors.stripes);
  const stableIndices = smoothBlockGridIndices(rawIndices, state.stableIndices, options.smoothingMaxStep);

  return {
    grid: { cols: lumaGrid.cols, rows: lumaGrid.rows, indices: stableIndices },
    state: { stableIndices },
  };
}
