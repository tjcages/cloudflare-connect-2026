import { computeBlockGrid, type BlockGrid } from "./computeBlockGrid";
import type { TextureLuminanceSettings } from "./colorWhiteness";
import { smoothBlockGridIndices } from "./stabilizeBlockGrid";
import { resolveStripeIndices } from "./stripes";
import type { StripeColors } from "../types";
import {
  DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
  resolvePlaygroundDrawRects,
  type PlaygroundSourceTransform,
} from "./playgroundSourceTransform";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  type PlaygroundTextureAdjustments,
} from "./playgroundTextureAdjustments";
import { applyPlaygroundRevealToLumaGrid, type PlaygroundRevealOptions } from "./playgroundReveal";

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
  textureAdjustments?: PlaygroundTextureAdjustments;
  reveal?: PlaygroundRevealOptions;
  luminanceSettings?: TextureLuminanceSettings;
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
    options.textureAdjustments ?? DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
    options.reveal,
    options.luminanceSettings,
  );
  const revealedLumaGrid = options.reveal ? applyPlaygroundRevealToLumaGrid(lumaGrid, options.reveal) : lumaGrid;
  const rawIndices = resolveStripeIndices(revealedLumaGrid.luma, colors.stripes);
  const stableIndices = smoothBlockGridIndices(rawIndices, state.stableIndices);

  return {
    grid: { cols: lumaGrid.cols, rows: lumaGrid.rows, indices: stableIndices, colors: lumaGrid.colors },
    state: { stableIndices },
  };
}
