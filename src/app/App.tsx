import { useMemo, useState } from "react";
import { GridCanvas } from "../components/GridCanvas";
import { Sidebar } from "../components/Sidebar";
import { DEFAULT_CONFIG, updateLargeRatio, updateSmallRatio } from "../grid/config";
import { generateGrid } from "../grid/generator";
import { gridToSvg } from "../grid/renderer";
import type { GridConfig } from "../grid/types";

const createSeed = () => {
  if ("crypto" in window && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID().slice(0, 8);
  }

  return `seed-${Date.now()}`;
};

export const App = () => {
  const [config, setConfig] = useState<GridConfig>(DEFAULT_CONFIG);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const grid = useMemo(() => generateGrid(config), [config]);

  const copySvg = async () => {
    try {
      await navigator.clipboard.writeText(gridToSvg(grid));
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
          gapMask: grid.config.gapMask,
          width: grid.config.logicalWidth,
          height: grid.config.logicalHeight,
          density: grid.config.density,
          smallCellRatio: grid.config.smallCellRatio,
          largeCellRatio: grid.config.largeCellRatio,
        }}
        cellCount={grid.cells.length}
        logicalSize={{
          width: grid.config.logicalWidth,
          height: grid.config.logicalHeight,
        }}
        renderSize={{
          width: grid.config.renderWidth,
          height: grid.config.renderHeight,
        }}
        onConfigChange={setConfig}
        onSmallRatioChange={(value) => setConfig((current) => ({ ...current, ...updateSmallRatio(value) }))}
        onLargeRatioChange={(value) => setConfig((current) => ({ ...current, ...updateLargeRatio(value) }))}
        onGenerate={() => setConfig((current) => ({ ...current, seed: createSeed() }))}
        onGapMaskChange={(gapMask) => setConfig((current) => ({ ...current, gapMask }))}
        onCopySvg={copySvg}
        copyState={copyState}
      />
      <section className="canvas-panel">
        <GridCanvas grid={grid} />
      </section>
    </main>
  );
};
