import {
  constrainReferenceColor,
  REFERENCE_COLOR_SMOOTH_ALPHA,
  sampleReferenceColorFromFrame,
  smoothReferenceColor,
} from "./colorWhiteness";
import { computeBlockGrid, type BlockGrid } from "./computeBlockGrid";
import { smoothBlockGridWidths } from "./stabilizeBlockGrid";
import type { Rgb01, StripeDuotoneOptions } from "./stripeFilterOptions";

export type PlaygroundGridBuildState = {
  stableReference?: Rgb01;
  stableWidths?: Uint8Array;
};

export function sampleVideoFrame(
  video: HTMLVideoElement,
  displayWidth: number,
  displayHeight: number,
  sampleCanvas: HTMLCanvasElement,
  sampleCtx: CanvasRenderingContext2D,
): ImageData | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || displayWidth <= 0 || displayHeight <= 0) {
    return null;
  }
  sampleCanvas.width = displayWidth;
  sampleCanvas.height = displayHeight;
  sampleCtx.drawImage(video, 0, 0, displayWidth, displayHeight);
  return sampleCtx.getImageData(0, 0, displayWidth, displayHeight);
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
  const stableWidths = smoothBlockGridWidths(rawGrid.widths, state.stableWidths);

  return {
    grid: { cols: rawGrid.cols, rows: rawGrid.rows, widths: stableWidths },
    state: { stableReference, stableWidths },
  };
}
