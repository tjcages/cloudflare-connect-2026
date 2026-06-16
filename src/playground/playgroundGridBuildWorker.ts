import {
  buildPlaygroundBlockGrid,
  type PlaygroundGridBuildState,
  type PlaygroundGridBuildOptions,
} from "./samplePlaygroundFrame";
import type { StripeColors } from "./stripeColors";

type GridBuildWorkerRequest = {
  requestId: number;
  frameWidth: number;
  frameHeight: number;
  frameData: ArrayBuffer;
  displayWidth: number;
  displayHeight: number;
  colors: StripeColors;
  gamma: number;
  stateStableIndices?: ArrayBuffer;
  options: PlaygroundGridBuildOptions;
};

type GridBuildWorkerResponse = {
  requestId: number;
  ok: true;
  gridCols: number;
  gridRows: number;
  gridIndices: ArrayBuffer;
  gridColors?: ArrayBuffer;
  gridColorCoverage?: ArrayBuffer;
  gridLuma?: ArrayBuffer;
  stateStableIndices: ArrayBuffer;
  lumaCols: number;
  lumaRows: number;
  lumaBytes: ArrayBuffer;
  lumaColors: ArrayBuffer;
  lumaColorCoverage?: ArrayBuffer;
};

type GridBuildWorkerError = {
  requestId: number;
  ok: false;
  error: string;
};

function toBuffer(view: ArrayBufferView | undefined): ArrayBuffer | undefined {
  if (!view) {
    return undefined;
  }
  const sourceBuffer = view.buffer;
  if (sourceBuffer instanceof ArrayBuffer && view.byteOffset === 0 && view.byteLength === sourceBuffer.byteLength) {
    return sourceBuffer;
  }
  if (sourceBuffer instanceof ArrayBuffer) {
    return sourceBuffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }
  const copied = new Uint8Array(view.byteLength);
  copied.set(new Uint8Array(sourceBuffer, view.byteOffset, view.byteLength));
  return copied.buffer;
}

/**
 * buildPlaygroundBlockGrid returns the same arrays through `grid`, `state`, and `lumaGrid`
 * (e.g. `grid.indices` aliases `state.stableIndices`), so response fields can share one
 * ArrayBuffer. postMessage throws on duplicate entries in the transfer list — dedupe.
 */
export function collectGridBuildTransfers(response: GridBuildWorkerResponse): ArrayBuffer[] {
  const transfers = new Set<ArrayBuffer>([
    response.gridIndices,
    response.stateStableIndices,
    response.lumaBytes,
    response.lumaColors,
  ]);
  if (response.gridColors) {
    transfers.add(response.gridColors);
  }
  if (response.gridColorCoverage) {
    transfers.add(response.gridColorCoverage);
  }
  if (response.gridLuma) {
    transfers.add(response.gridLuma);
  }
  if (response.lumaColorCoverage) {
    transfers.add(response.lumaColorCoverage);
  }
  return [...transfers];
}

self.onmessage = (event: MessageEvent<GridBuildWorkerRequest>) => {
  const payload = event.data;
  try {
    const frameData = new Uint8ClampedArray(payload.frameData);
    const frame = {
      width: payload.frameWidth,
      height: payload.frameHeight,
      data: frameData,
    } as ImageData;
    const state: PlaygroundGridBuildState = payload.stateStableIndices
      ? { stableIndices: new Uint8Array(payload.stateStableIndices) }
      : {};
    const built = buildPlaygroundBlockGrid(
      frame,
      payload.displayWidth,
      payload.displayHeight,
      payload.colors,
      state,
      payload.gamma,
      payload.options,
    );
    const response: GridBuildWorkerResponse = {
      requestId: payload.requestId,
      ok: true,
      gridCols: built.grid.cols,
      gridRows: built.grid.rows,
      gridIndices: toBuffer(built.grid.indices)!,
      gridColors: toBuffer(built.grid.colors),
      gridColorCoverage: toBuffer(built.grid.colorCoverage),
      gridLuma: toBuffer(built.grid.luma),
      stateStableIndices: toBuffer(built.state.stableIndices ?? new Uint8Array(0))!,
      lumaCols: built.lumaGrid.cols,
      lumaRows: built.lumaGrid.rows,
      lumaBytes: toBuffer(built.lumaGrid.luma)!,
      lumaColors: toBuffer(built.lumaGrid.colors)!,
      lumaColorCoverage: toBuffer(built.lumaGrid.colorCoverage),
    };
    self.postMessage(response, { transfer: collectGridBuildTransfers(response) });
  } catch (error) {
    const response: GridBuildWorkerError = {
      requestId: payload.requestId,
      ok: false,
      error: error instanceof Error ? error.message : "Playground grid build worker failed.",
    };
    self.postMessage(response);
  }
};

export type { GridBuildWorkerError, GridBuildWorkerRequest, GridBuildWorkerResponse };
