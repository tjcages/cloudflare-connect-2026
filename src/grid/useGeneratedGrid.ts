import { useEffect, useRef, useState } from "react";
import { generateGrid } from "./generator";
import type { GeneratedGrid, GridConfig } from "./types";
import type { GridWorkerRequest, GridWorkerResponse } from "./generatorWorker";

const createGridWorker = () =>
  new Worker(new URL("./generatorWorker.ts", import.meta.url), {
    type: "module",
  });

export const useGeneratedGrid = (config: GridConfig) => {
  const [grid, setGrid] = useState<GeneratedGrid>(() => generateGrid(config));
  const [isGenerating, setIsGenerating] = useState(false);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    let isActive = true;
    setIsGenerating(true);

    if (typeof Worker === "undefined") {
      const timeoutId = window.setTimeout(() => {
        if (!isActive) {
          return;
        }

        setGrid(generateGrid(config));
        setIsGenerating(false);
      }, 0);

      return () => {
        isActive = false;
        window.clearTimeout(timeoutId);
      };
    }

    const worker = createGridWorker();

    worker.onmessage = (event: MessageEvent<GridWorkerResponse>) => {
      if (!isActive) {
        return;
      }

      setGrid(event.data.grid);
      setIsGenerating(false);
      worker.terminate();
    };

    worker.onerror = () => {
      if (!isActive) {
        return;
      }

      setIsGenerating(false);
      worker.terminate();
    };

    worker.postMessage({
      config,
    } satisfies GridWorkerRequest);

    return () => {
      isActive = false;
      worker.terminate();
    };
  }, [config]);

  return {
    grid,
    isGenerating,
  };
};
