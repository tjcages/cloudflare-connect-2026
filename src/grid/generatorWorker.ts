import { generateGrid } from "./generator";
import type { GeneratedGrid, GridConfig } from "./types";

export type GridWorkerRequest = {
  requestId: number;
  config: GridConfig;
};

export type GridWorkerResponse = {
  requestId: number;
  grid: GeneratedGrid;
};

export type GridWorkerErrorResponse = {
  requestId: number;
  error: string;
};

self.onmessage = (event: MessageEvent<GridWorkerRequest>) => {
  const { requestId, config } = event.data;

  try {
    self.postMessage({
      requestId,
      grid: generateGrid(config),
    } satisfies GridWorkerResponse);
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : "Grid generation failed",
    } satisfies GridWorkerErrorResponse);
  }
};

export {};
