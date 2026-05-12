import { useEffect, useMemo, useRef, useState } from "react";
import { GridCanvas } from "../components/GridCanvas";
import { Sidebar } from "../components/Sidebar";
import { DEFAULT_CONFIG, updateLargeRatio, updateSmallRatio } from "../grid/config";
import { writeSvgToClipboard } from "../grid/clipboard";
import { generateGrid } from "../grid/generator";
import { gridToSvg } from "../grid/renderer";
import type { GeneratedGrid, GridConfig } from "../grid/types";

export const GRID_GENERATION_DEBOUNCE_MS = 120;

type GridWorkerResponse =
  | {
      id: number;
      grid: GeneratedGrid;
    }
  | {
      id: number;
      error: string;
    };

const createSeed = () => {
  if ("crypto" in window && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID().slice(0, 8);
  }

  return `seed-${Date.now()}`;
};

export const App = () => {
  const [config, setConfig] = useState<GridConfig>(DEFAULT_CONFIG);
  const [grid, setGrid] = useState(() => generateGrid(DEFAULT_CONFIG));
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const nextRequestId = useRef(0);
  const renderedGrid = useMemo<GeneratedGrid>(
    () => ({
      ...grid,
      config: {
        ...grid.config,
        strokeColor: config.strokeColor,
      },
    }),
    [grid, config.strokeColor],
  );

  useEffect(() => {
    const requestId = nextRequestId.current + 1;
    nextRequestId.current = requestId;
    let worker: Worker | null = null;

    const timeoutId = window.setTimeout(() => {
      if (typeof Worker === "undefined") {
        setGrid(generateGrid(config));
        return;
      }

      worker = new Worker(new URL("../grid/generator.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<GridWorkerResponse>) => {
        if (event.data.id !== nextRequestId.current) {
          return;
        }

        if ("grid" in event.data) {
          setGrid(event.data.grid);
        } else {
          console.error(event.data.error);
        }
      };
      worker.onerror = (event) => {
        if (requestId === nextRequestId.current) {
          console.error(event.message);
        }
      };
      worker.postMessage({ id: requestId, config });
    }, GRID_GENERATION_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      worker?.terminate();
    };
  }, [
    config.seed,
    config.width,
    config.height,
    config.density,
    config.smallCellRatio,
    config.largeCellRatio,
    config.gapMask,
  ]);

  const copySvg = async () => {
    try {
      await writeSvgToClipboard(gridToSvg(renderedGrid));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  };

  return (
    <main className="app-shell">
      <Sidebar
        config={{
          ...config,
          gapMask: renderedGrid.config.gapMask,
        }}
        cellCount={renderedGrid.cells.length}
        logicalSize={{
          width: renderedGrid.config.logicalWidth,
          height: renderedGrid.config.logicalHeight,
        }}
        renderSize={{
          width: renderedGrid.config.renderWidth,
          height: renderedGrid.config.renderHeight,
        }}
        onConfigChange={setConfig}
        onSmallRatioChange={(value) => setConfig((current) => ({ ...current, ...updateSmallRatio(value) }))}
        onLargeRatioChange={(value) => setConfig((current) => ({ ...current, ...updateLargeRatio(value) }))}
        onStrokeColorChange={(strokeColor) => setConfig((current) => ({ ...current, strokeColor }))}
        onGenerate={() => setConfig((current) => ({ ...current, seed: createSeed() }))}
        onGapMaskChange={(gapMask) => setConfig((current) => ({ ...current, gapMask }))}
        onCopySvg={copySvg}
        copyState={copyState}
      />
      <section className="canvas-panel">
        <GridCanvas grid={renderedGrid} />
      </section>
    </main>
  );
};
