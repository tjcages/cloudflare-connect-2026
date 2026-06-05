import { computeBlockGrid, type BlockGrid } from "./computeBlockGrid";
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
import { drawPlaygroundFlames, type PlaygroundFlamesState } from "./playgroundFlames";
import type { PlaygroundFlamesConfig } from "./playgroundFlamesConfig";

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
  flamesState: PlaygroundFlamesState | null = null,
  flamesConfig: PlaygroundFlamesConfig | null = null,
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
  if (flamesState && flamesConfig?.enabled) {
    drawPlaygroundFlames(sampleCtx, flamesState, flamesConfig, displayWidth, displayHeight);
  }
  return sampleCtx.getImageData(0, 0, displayWidth, displayHeight);
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
  flamesState: PlaygroundFlamesState | null = null,
  flamesConfig: PlaygroundFlamesConfig | null = null,
): ImageData | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return null;
  }
  return sampleTextureFrame(
    video,
    displayWidth,
    displayHeight,
    sampleCanvas,
    sampleCtx,
    sourceTransform,
    flamesState,
    flamesConfig,
  );
}

export type PlaygroundGridBuildOptions = {
  cellWidth?: number;
  cellHeight?: number;
  /** Max stripe-index change per update (0 = snap instantly). */
  smoothingMaxStep?: number;
  textureAdjustments?: PlaygroundTextureAdjustments;
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
  const lumaGrid = computeBlockGrid(
    frame.data,
    displayWidth,
    displayHeight,
    options.textureAdjustments?.gamma ?? gamma,
    options.cellWidth,
    options.cellHeight,
    options.textureAdjustments ?? DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  );
  const rawIndices = resolveStripeIndices(lumaGrid.luma, colors.stripes);
  const stableIndices = smoothBlockGridIndices(rawIndices, state.stableIndices, options.smoothingMaxStep);

  return {
    grid: { cols: lumaGrid.cols, rows: lumaGrid.rows, indices: stableIndices },
    state: { stableIndices },
  };
}
