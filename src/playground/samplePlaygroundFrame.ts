import {
  constrainReferenceColor,
  REFERENCE_COLOR_SMOOTH_ALPHA,
  sampleReferenceColorFromFrame,
  smoothReferenceColor,
} from "./colorWhiteness";
import { computeBlockGrid, type BlockGrid } from "./computeBlockGrid";
import { smoothBlockGridBands } from "./stabilizeBlockGrid";
import type { Rgb01, StripeDuotoneOptions } from "./stripeFilterOptions";

export type PlaygroundGridBuildState = {
  stableReference?: Rgb01;
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
  const frameSample = sampleReferenceColorFromFrame(
    frame.data,
    displayWidth,
    displayHeight,
    options.ignoreColorRgb,
    options.gamma,
  );
  const constrained = constrainReferenceColor(frameSample, options.ignoreColorRgb, options.ignoreTolerance);
  const stableReference = smoothReferenceColor(state.stableReference, constrained, REFERENCE_COLOR_SMOOTH_ALPHA);

  const rawGrid = computeBlockGrid(frame.data, displayWidth, displayHeight, {
    ...options,
    referenceColorRgb: stableReference,
  });
  const stableBands = smoothBlockGridBands(rawGrid.bands, state.stableBands);

  return {
    grid: { cols: rawGrid.cols, rows: rawGrid.rows, bands: stableBands },
    state: { stableReference, stableBands },
  };
}
