import { computeBlockGrid, type BlockGrid } from "./computeBlockGrid";
import { smoothBlockGridBands } from "./stabilizeBlockGrid";
import type { StripeDuotoneOptions } from "./stripeFilterOptions";

export type PlaygroundGridBuildState = {
  stableBands?: Uint8Array;
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
  options: StripeDuotoneOptions,
  state: PlaygroundGridBuildState,
): { grid: BlockGrid; state: PlaygroundGridBuildState } {
  const rawGrid = computeBlockGrid(frame.data, displayWidth, displayHeight, options);
  const stableBands = smoothBlockGridBands(rawGrid.bands, state.stableBands);

  return {
    grid: { cols: rawGrid.cols, rows: rawGrid.rows, bands: stableBands },
    state: { stableBands },
  };
}
