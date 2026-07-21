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
import { IRIS_BLADES_FRAG } from "./iris-blades.shaders";

const BLADES = 7;
const DURATION_MS = 2300;
const WINDUP = 0.09;
const WINDUP_ROT = 0.15;
const SWEEP_ROT = 1.05;
const VEL_REF = 1.9;

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

const openShape = (p: number) => easeStandard((p - WINDUP) / (1 - WINDUP));

const definition: ExperimentDefinition = {
  id: "iris-blades",
  title: "Iris Blades",
  category: "reveal",
  blurb: "Seven mechanical blades wind up, then sweep open from the center, shoving the stripes aside as they cut.",
  create: (ctx) => {
    const rng = createSeededRng(0x1815ade);
    const run = { rot0: rng() * Math.PI * 2, phase: new Float32Array(BLADES), gain: new Float32Array(BLADES) };
    const radii = new Float32Array(BLADES);

    const randomizeRun = () => {
      run.rot0 = rng() * Math.PI * 2;
      for (let i = 0; i < BLADES; i++) {
        run.phase[i] = (rng() - 0.5) * 0.036;
        run.gain[i] = 0.97 + rng() * 0.06;
      }
    };
    randomizeRun();

    const customReveal = ({ gl, quad }: EngineHookContext): CustomRevealPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, IRIS_BLADES_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uRot = gl.getUniformLocation(program, "uRot");
      const uAmp = gl.getUniformLocation(program, "uAmp");
      const uBladeR = gl.getUniformLocation(program, "uBladeR");
      return {
        render(frame) {
          const p = Math.min(1, Math.max(0, frame.progress));
          const halfDiag = 0.5 * Math.hypot(frame.cssW, frame.cssH);
          const rMax = halfDiag * 1.3;
          const done = p >= 1;

          for (let i = 0; i < BLADES; i++) {
            const pb = Math.min(1, Math.max(0, p + (run.phase[i] ?? 0)));
            radii[i] = done ? rMax * 2 : rMax * openShape(pb) * (run.gain[i] ?? 1);
          }

          const back = easeStandard(Math.min(1, p / WINDUP));
          const rot = run.rot0 - WINDUP_ROT * back + (WINDUP_ROT + SWEEP_ROT) * openShape(p);

          const h = 0.012;
          const velocity = (openShape(Math.min(1, p + h)) - openShape(Math.max(0, p - h))) / (2 * h);
          const amp = done ? 0 : Math.min(1, Math.max(0, velocity / VEL_REF));

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.revealed.fbo);
          gl.viewport(0, 0, frame.revealed.width, frame.revealed.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.field.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1f(uRot, rot);
          gl.uniform1f(uAmp, amp);
          gl.uniform1fv(uBladeR, radii);
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
