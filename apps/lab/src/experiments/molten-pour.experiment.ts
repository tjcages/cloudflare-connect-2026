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
import { MOLTEN_POUR_FRAG } from "./molten-pour.shaders";

const DURATION_MS = 3200;
const FILL_START = -0.22;
const FILL_END = 1.45;

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

const smoothRange = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

const gravityEase = (t: number) => {
  const fall = Math.pow(t, 1.55);
  return fall + (easeStandard(t) - fall) * smoothRange(0.3, 1, t);
};

const definition: ExperimentDefinition = {
  id: "molten-pour",
  title: "Molten Pour",
  category: "reveal",
  blurb: "Molten image pours diagonally from a corner, its meniscus bulging the stripes ahead and settling behind.",
  create: (ctx) => {
    const rng = createSeededRng(0x0b1e77);
    const run = { side: rng() < 0.5 ? 1 : -1, seedX: 1 + rng() * 96, seedY: 1 + rng() * 96 };
    const randomizeRun = () => {
      run.side = -run.side;
      run.seedX = 1 + rng() * 96;
      run.seedY = 1 + rng() * 96;
    };

    const customReveal = ({ gl, quad }: EngineHookContext): CustomRevealPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, MOLTEN_POUR_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uAspect = gl.getUniformLocation(program, "uAspect");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uFill = gl.getUniformLocation(program, "uFill");
      const uFade = gl.getUniformLocation(program, "uFade");
      const uSettle = gl.getUniformLocation(program, "uSettle");
      const uFlow = gl.getUniformLocation(program, "uFlow");
      const uOrigin = gl.getUniformLocation(program, "uOrigin");
      const uDiag = gl.getUniformLocation(program, "uDiag");
      const uSeed = gl.getUniformLocation(program, "uSeed");
      return {
        render(frame) {
          const t = Math.min(1, Math.max(0, frame.progress));
          const aspect = frame.cssW / Math.max(1, frame.cssH);
          const diag = Math.hypot(aspect, 1);
          const flowX = (run.side * aspect) / diag;
          const flowY = -1 / diag;

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.revealed.fbo);
          gl.viewport(0, 0, frame.revealed.width, frame.revealed.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.field.texture);
          gl.uniform1i(uField, 0);
          gl.uniform1f(uAspect, aspect);
          gl.uniform1f(uTime, frame.now / 1000);
          gl.uniform1f(uFill, FILL_START + (FILL_END - FILL_START) * gravityEase(t));
          gl.uniform1f(uFade, 1 - smoothRange(0.9, 1, t));
          gl.uniform1f(uSettle, smoothRange(0.45, 0.95, t));
          gl.uniform2f(uFlow, flowX, flowY);
          gl.uniform2f(uOrigin, run.side > 0 ? 0 : aspect, 1);
          gl.uniform1f(uDiag, diag);
          gl.uniform2f(uSeed, run.seedX, run.seedY);
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
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
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
