import { generateGrid } from "./generator";
import type { GeneratedGrid, GridConfig } from "./types";
import type { GridWorkerErrorResponse, GridWorkerRequest, GridWorkerResponse } from "./generatorWorker";

const canUseGridWorker = () => typeof Worker !== "undefined" && !import.meta.env.VITEST;

let worker: Worker | null = null;
let workerRequestId = 0;

const pendingRequests = new Map<
  number,
  {
    resolve: (grid: GeneratedGrid) => void;
    reject: (error: Error) => void;
  }
>();

const ensureWorker = () => {
  if (!canUseGridWorker()) {
    return null;
  }

  if (worker) {
    return worker;
  }

  worker = new Worker(new URL("./generatorWorker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<GridWorkerResponse | GridWorkerErrorResponse>) => {
    const payload = event.data;
    const pending = pendingRequests.get(payload.requestId);

    if (!pending) {
      return;
    }

    pendingRequests.delete(payload.requestId);

    if ("error" in payload) {
      pending.reject(new Error(payload.error));
      return;
    }

    pending.resolve(payload.grid);
  };

  worker.onerror = (event) => {
    for (const pending of pendingRequests.values()) {
      pending.reject(new Error(event.message || "Grid worker failed"));
    }
    pendingRequests.clear();
    worker?.terminate();
    worker = null;
  };

  return worker;
};

/** Runs grid generation off the main thread when workers are available. */
export const generateGridAsync = (config: GridConfig): Promise<GeneratedGrid> => {
  const activeWorker = ensureWorker();

  if (!activeWorker) {
    return Promise.resolve(generateGrid(config));
  }

  const requestId = workerRequestId + 1;
  workerRequestId = requestId;

  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    activeWorker.postMessage({ requestId, config } satisfies GridWorkerRequest);
  });
};
