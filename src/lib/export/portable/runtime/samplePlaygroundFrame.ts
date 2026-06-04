import { computeBlockGrid, type BlockGrid } from "./computeBlockGrid";
import { smoothBlockGridIndices } from "./stabilizeBlockGrid";
import { resolveStripeIndices } from "./stripes";
import type { StripeColors } from "../types";

export type PlaygroundGridBuildState = {
  stableIndices?: Uint8Array;
};

export function sampleTextureFrame(
  source: CanvasImageSource,
  displayWidth: number,
  displayHeight: number,
  sampleCanvas: HTMLCanvasElement,
  sampleCtx: CanvasRenderingContext2D,
): ImageData | null {
  if (displayWidth <= 0 || displayHeight <= 0) {
    return null;
  }
  sampleCanvas.width = displayWidth;
  sampleCanvas.height = displayHeight;
  sampleCtx.drawImage(source, 0, 0, displayWidth, displayHeight);
  return sampleCtx.getImageData(0, 0, displayWidth, displayHeight);
}

export function sampleVideoFrame(
  video: HTMLVideoElement,
  displayWidth: number,
  displayHeight: number,
  sampleCanvas: HTMLCanvasElement,
  sampleCtx: CanvasRenderingContext2D,
): ImageData | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return null;
  }
  return sampleTextureFrame(video, displayWidth, displayHeight, sampleCanvas, sampleCtx);
}

export function buildPlaygroundBlockGrid(
  frame: ImageData,
  displayWidth: number,
  displayHeight: number,
  colors: StripeColors,
  state: PlaygroundGridBuildState,
): { grid: BlockGrid; state: PlaygroundGridBuildState } {
  const lumaGrid = computeBlockGrid(frame.data, displayWidth, displayHeight);
  const rawIndices = resolveStripeIndices(lumaGrid.luma, colors.stripes);
  const stableIndices = smoothBlockGridIndices(rawIndices, state.stableIndices);

  return {
    grid: { cols: lumaGrid.cols, rows: lumaGrid.rows, indices: stableIndices },
    state: { stableIndices },
  };
}
