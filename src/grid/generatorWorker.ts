import { generateGrid } from "./generator";
import type { GeneratedGrid, GridConfig } from "./types";

export type GridWorkerRequest = {
  config: GridConfig;
};

export type GridWorkerResponse = {
  grid: GeneratedGrid;
};

self.onmessage = (event: MessageEvent<GridWorkerRequest>) => {
  self.postMessage({
    grid: generateGrid(event.data.config),
  } satisfies GridWorkerResponse);
};

export {};
