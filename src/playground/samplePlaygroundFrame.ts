import { computeBlockGrid, type BlockGrid } from "./computeBlockGrid";
import { smoothBlockGridIndices } from "./stabilizeBlockGrid";
import { resolveStripeIndices, type StripeColors } from "./stripeColors";

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

export type PlaygroundGridBuildOptions = {
  cellWidth?: number;
  cellHeight?: number;
  /** Max stripe-index change per update (0 = snap instantly). */
  smoothingMaxStep?: number;
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
    gamma,
    options.cellWidth,
    options.cellHeight,
  );
  const rawIndices = resolveStripeIndices(lumaGrid.luma, colors.stripes);
  const stableIndices = smoothBlockGridIndices(rawIndices, state.stableIndices, options.smoothingMaxStep);

  return {
    grid: { cols: lumaGrid.cols, rows: lumaGrid.rows, indices: stableIndices },
    state: { stableIndices },
  };
}
