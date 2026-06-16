import type { BlockGrid, LumaGrid } from "./computeBlockGrid";
import type { PlaygroundGridBuildOptions, PlaygroundGridBuildState } from "./samplePlaygroundFrame";
import type { StripeColors } from "./stripeColors";
import type {
  GridBuildWorkerError,
  GridBuildWorkerRequest,
  GridBuildWorkerResponse,
} from "./playgroundGridBuildWorker";

type BuildRequest = {
  frame: ImageData;
  displayWidth: number;
  displayHeight: number;
  colors: StripeColors;
  gamma: number;
  state: PlaygroundGridBuildState;
  options: PlaygroundGridBuildOptions;
};

export type AsyncGridBuildResult = {
  grid: BlockGrid;
  state: PlaygroundGridBuildState;
  lumaGrid: LumaGrid;
};

type BuildCallbacks = {
  onResult: (result: AsyncGridBuildResult) => void;
  onError?: (error: Error) => void;
};

type PendingJob = {
  requestId: number;
  request: BuildRequest;
  callbacks: BuildCallbacks;
};

export type PlaygroundGridBuildQueue = {
  submitLatest: (
    request: BuildRequest,
    callbacks: BuildCallbacks,
  ) => { accepted: boolean; queued: boolean; replacedQueued: boolean };
  hasInFlight: () => boolean;
  getStats: () => {
    inFlight: boolean;
    queued: boolean;
    depth: number;
    submitted: number;
    coalesced: number;
    droppedQueued: number;
    lastLatencyMs: number | null;
    inFlightForMs: number | null;
  };
  dispose: () => void;
};

function canUsePlaygroundGridWorker(): boolean {
  if (typeof Worker === "undefined" || import.meta.env.VITEST) {
    return false;
  }
  const flag = (globalThis as { __PLAYGROUND_GRID_WORKER__?: boolean }).__PLAYGROUND_GRID_WORKER__;
  return flag !== false;
}

function toArrayBuffer(bytes: Uint8Array | Uint8ClampedArray): ArrayBuffer {
  const sourceBuffer = bytes.buffer;
  if (sourceBuffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === sourceBuffer.byteLength) {
    return sourceBuffer;
  }
  // Transfer lists require standalone buffers; slice only when view spans a subset.
  if (sourceBuffer instanceof ArrayBuffer) {
    return sourceBuffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(new Uint8Array(sourceBuffer, bytes.byteOffset, bytes.byteLength));
  return copied.buffer;
}

function serializeJob(job: PendingJob): { payload: GridBuildWorkerRequest; transfers: ArrayBuffer[] } {
  const frameData = toArrayBuffer(job.request.frame.data);
  // Copy instead of moving the live buffer: `state.stableIndices` aliases `grid.indices` held
  // by the scene (letter layer, exports); transferring it would detach those views mid-frame.
  const stable = job.request.state.stableIndices ? toArrayBuffer(job.request.state.stableIndices).slice(0) : undefined;
  const payload: GridBuildWorkerRequest = {
    requestId: job.requestId,
    frameWidth: job.request.frame.width,
    frameHeight: job.request.frame.height,
    frameData,
    displayWidth: job.request.displayWidth,
    displayHeight: job.request.displayHeight,
    colors: job.request.colors,
    gamma: job.request.gamma,
    stateStableIndices: stable,
    options: job.request.options,
  };
  const transfers = [frameData];
  if (stable) {
    transfers.push(stable);
  }
  return { payload, transfers };
}

function deserializeResult(payload: GridBuildWorkerResponse): AsyncGridBuildResult {
  return {
    grid: {
      cols: payload.gridCols,
      rows: payload.gridRows,
      indices: new Uint8Array(payload.gridIndices),
      colors: payload.gridColors ? new Uint8Array(payload.gridColors) : undefined,
      colorCoverage: payload.gridColorCoverage ? new Uint8Array(payload.gridColorCoverage) : undefined,
      luma: payload.gridLuma ? new Uint8Array(payload.gridLuma) : undefined,
    },
    state: {
      stableIndices: new Uint8Array(payload.stateStableIndices),
    },
    lumaGrid: {
      cols: payload.lumaCols,
      rows: payload.lumaRows,
      luma: new Uint8Array(payload.lumaBytes),
      colors: new Uint8Array(payload.lumaColors),
      colorCoverage: payload.lumaColorCoverage ? new Uint8Array(payload.lumaColorCoverage) : undefined,
    },
  };
}

export function createPlaygroundGridBuildQueue(): PlaygroundGridBuildQueue | null {
  if (!canUsePlaygroundGridWorker()) {
    return null;
  }

  let worker: Worker | null = new Worker(new URL("./playgroundGridBuildWorker.ts", import.meta.url), {
    type: "module",
  });
  let requestId = 0;
  let inFlight: PendingJob | null = null;
  let queuedLatest: PendingJob | null = null;
  let inFlightStartedAtMs: number | null = null;
  let submitted = 0;
  let coalesced = 0;
  let droppedQueued = 0;
  let lastLatencyMs: number | null = null;

  const dispatch = (job: PendingJob) => {
    const activeWorker = worker;
    if (!activeWorker) {
      return;
    }
    inFlight = job;
    inFlightStartedAtMs = performance.now();
    submitted += 1;
    const { payload, transfers } = serializeJob(job);
    activeWorker.postMessage(payload, { transfer: transfers });
  };

  worker.onmessage = (event: MessageEvent<GridBuildWorkerResponse | GridBuildWorkerError>) => {
    const payload = event.data;
    const active = inFlight;
    if (!active || payload.requestId !== active.requestId) {
      return;
    }
    if (inFlightStartedAtMs != null) {
      lastLatencyMs = performance.now() - inFlightStartedAtMs;
    }
    inFlightStartedAtMs = null;
    inFlight = null;
    if (!payload.ok) {
      active.callbacks.onError?.(new Error(payload.error));
    } else {
      active.callbacks.onResult(deserializeResult(payload));
    }
    if (queuedLatest) {
      const next = queuedLatest;
      queuedLatest = null;
      dispatch(next);
    }
  };

  worker.onerror = (event) => {
    const error = new Error(event.message || "Playground grid build worker failed.");
    inFlight?.callbacks.onError?.(error);
    queuedLatest?.callbacks.onError?.(error);
    inFlight = null;
    inFlightStartedAtMs = null;
    queuedLatest = null;
    worker?.terminate();
    worker = null;
  };

  return {
    submitLatest: (request, callbacks) => {
      const activeWorker = worker;
      if (!activeWorker) {
        return { accepted: false, queued: false, replacedQueued: false };
      }
      requestId += 1;
      const job: PendingJob = { requestId, request, callbacks };
      if (!inFlight) {
        dispatch(job);
        return { accepted: true, queued: false, replacedQueued: false };
      } else {
        const replacedQueued = queuedLatest !== null;
        queuedLatest = job;
        coalesced += 1;
        if (replacedQueued) {
          droppedQueued += 1;
        }
        return { accepted: true, queued: true, replacedQueued };
      }
    },
    hasInFlight: () => inFlight !== null,
    getStats: () => ({
      inFlight: inFlight !== null,
      queued: queuedLatest !== null,
      depth: (inFlight ? 1 : 0) + (queuedLatest ? 1 : 0),
      submitted,
      coalesced,
      droppedQueued,
      lastLatencyMs,
      inFlightForMs: inFlightStartedAtMs == null ? null : performance.now() - inFlightStartedAtMs,
    }),
    dispose: () => {
      inFlight = null;
      inFlightStartedAtMs = null;
      queuedLatest = null;
      worker?.terminate();
      worker = null;
    },
  };
}
