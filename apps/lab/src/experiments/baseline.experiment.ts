import { createStripesEngine, DEFAULT_ENGINE_CONFIG } from "@necatikcl/stripes-engine";
import type { ExperimentDefinition } from "./types";

const definition: ExperimentDefinition = {
  id: "baseline",
  title: "Baseline",
  category: "reveal",
  blurb: "Control tile: default engine config, wave reveal, default cursor trail and click wave.",
  create: (ctx) => {
    const engine = createStripesEngine(ctx.canvas);
    engine.setConfig({
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: true, type: "wave" },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: true },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: true },
    });
    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      engine.setSource(image);
      engine.triggerReveal();
    };
    image.src = ctx.textureUrl;
    engine.start();
    return {
      engine,
      replay: () => engine.triggerReveal(),
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
