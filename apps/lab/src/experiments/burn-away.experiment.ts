import {
  compileProgram,
  createSeededRng,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type CustomRevealPass,
  type EngineHookContext,
} from "@necatikcl/stripes-engine";
import { EXPERIMENT_BASE_CONFIG } from "./preset";
import type { ExperimentDefinition } from "./types";
import { BURN_AWAY_FRAG } from "./burn-away.shaders";

const DURATION_MS = 3000;

const bezierSample = (a: number, b: number, t: number) =>
  3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;

const easeStandard = (x: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 24; i++) {
    if (bezierSample(0.6, 0, t) < x) lo = t;
    else hi = t;
    t = (lo + hi) * 0.5;
  }
  return bezierSample(0.6, 1, t);
};

const definition: ExperimentDefinition = {
  id: "burn-away",
  title: "Burn Away",
  category: "reveal",
  blurb: "A noise-driven ember front eats the static with a glowing rim and brief soot, leaving the image behind.",
  create: (ctx) => {
    const rng = createSeededRng(0x51f15e);
    const run = { dirX: 0, dirY: 1, seedX: 0, seedY: 0 };
    const randomizeRun = () => {
      const angle = rng() * Math.PI * 2;
      run.dirX = Math.cos(angle);
      run.dirY = Math.sin(angle);
      run.seedX = 1 + rng() * 96;
      run.seedY = 1 + rng() * 96;
    };
    randomizeRun();

    const customReveal = ({ gl, quad }: EngineHookContext): CustomRevealPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, BURN_AWAY_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uProgress = gl.getUniformLocation(program, "uProgress");
      const uDir = gl.getUniformLocation(program, "uDir");
      const uSeed = gl.getUniformLocation(program, "uSeed");
      const uAspect = gl.getUniformLocation(program, "uAspect");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      return {
        render(frame) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.revealed.fbo);
          gl.viewport(0, 0, frame.revealed.width, frame.revealed.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.field.texture);
          gl.uniform1i(uField, 0);
          gl.uniform1f(uProgress, easeStandard(Math.min(1, Math.max(0, frame.progress))));
          gl.uniform2f(uDir, run.dirX, run.dirY);
          gl.uniform2f(uSeed, run.seedX, run.seedY);
          gl.uniform1f(uAspect, frame.cssW / Math.max(1, frame.cssH));
          gl.uniform1f(uTime, frame.now / 1000);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { customReveal } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      reveal: {
        ...DEFAULT_ENGINE_CONFIG.reveal,
        enabled: true,
        type: "custom",
        wave: { ...DEFAULT_ENGINE_CONFIG.reveal.wave, durationMs: DURATION_MS },
      },
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
      replay: () => {
        randomizeRun();
        engine.triggerReveal();
      },
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
