import { generateGrid } from "./generator";
import type { GeneratedGrid, GridConfig } from "./types";

type GridWorkerRequest = {
  id: number;
  config: GridConfig;
};

type GridWorkerResponse =
  | {
      id: number;
      grid: GeneratedGrid;
    }
  | {
      id: number;
      error: string;
    };

type GridWorkerScope = {
  onmessage: ((event: MessageEvent<GridWorkerRequest>) => void) | null;
  postMessage: (message: GridWorkerResponse) => void;
};

const workerScope = self as unknown as GridWorkerScope;

workerScope.onmessage = (event: MessageEvent<GridWorkerRequest>) => {
  const { id, config } = event.data;

  try {
    workerScope.postMessage({
      id,
      grid: generateGrid(config),
    } satisfies GridWorkerResponse);
  } catch (error) {
    workerScope.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    } satisfies GridWorkerResponse);
  }
};
