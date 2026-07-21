import {
  compileProgram,
  createPingPong,
  createSeededRng,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type CustomRevealPass,
  type EngineHookContext,
} from "@necatikcl/stripes-engine";
import { EXPERIMENT_BASE_CONFIG } from "./preset";
import type { ExperimentDefinition } from "./types";
import { RAIN_WASH_COMPOSITE_FRAG, RAIN_WASH_STEP_FRAG } from "./rain-wash.shaders";

const DURATION_MS = 3400;
const MAX_STREAKS = 28;
const SIM_W = 320;
const SIM_H = 200;
const SPAWN_Y = -0.14;
const EXPIRE_Y = 1.65;
const BASE_SEED = 0x2fb7c3;

type Streak = {
  x: number;
  born: number;
  speed: number;
  halfWidth: number;
  seed: number;
  headPrev: number;
};

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

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const smoothstepNum = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / Math.max(edge1 - edge0, 1e-6));
  return t * t * (3 - 2 * t);
};

const fract = (x: number) => x - Math.floor(x);

const definition: ExperimentDefinition = {
  id: "rain-wash",
  title: "Rain Wash",
  category: "reveal",
  blurb: "Rain streaks wash the static off the glass, each drop carving a clean stripe with trailing drips.",
  create: (ctx) => {
    const state = {
      streaks: [] as Streak[],
      spawnAccum: 0,
      spawnIndex: 0,
      lastNow: -1,
      lastProgress: Number.POSITIVE_INFINITY,
      runCounter: 0,
      rng: createSeededRng(BASE_SEED),
      resetPending: false,
    };

    const spawnStreak = (now: number) => {
      const rng = state.rng;
      const x = fract(0.5 + state.spawnIndex * 0.618034 + (rng() - 0.5) * 0.24);
      state.spawnIndex += 1;
      const widthT = Math.pow(rng(), 1.6);
      const halfWidth = 0.017 + 0.032 * widthT;
      const speed = 0.72 + rng() * 0.5 + (halfWidth - 0.017) * 14;
      state.streaks.push({ x, born: now, speed, halfWidth, seed: 0.05 + rng() * 0.9, headPrev: SPAWN_Y });
    };

    const customReveal = ({ gl, quad }: EngineHookContext): CustomRevealPass => {
      const sim = createPingPong(gl, SIM_W, SIM_H, { linear: true });
      const stepProgram = compileProgram(gl, FULLSCREEN_VERT, RAIN_WASH_STEP_FRAG);
      const compositeProgram = compileProgram(gl, FULLSCREEN_VERT, RAIN_WASH_COMPOSITE_FRAG);
      const uPrev = gl.getUniformLocation(stepProgram, "uPrev");
      const uStreaks = gl.getUniformLocation(stepProgram, "uStreaks");
      const uSeeds = gl.getUniformLocation(stepProgram, "uSeeds");
      const uCount = gl.getUniformLocation(stepProgram, "uCount");
      const uAspect = gl.getUniformLocation(stepProgram, "uAspect");
      const uSheetHead = gl.getUniformLocation(stepProgram, "uSheetHead");
      const uWetKeep = gl.getUniformLocation(stepProgram, "uWetKeep");
      const uField = gl.getUniformLocation(compositeProgram, "uField");
      const uAccum = gl.getUniformLocation(compositeProgram, "uAccum");
      const uTime = gl.getUniformLocation(compositeProgram, "uTime");
      const uWetScale = gl.getUniformLocation(compositeProgram, "uWetScale");
      const uCssSize = gl.getUniformLocation(compositeProgram, "uCssSize");
      const streakData = new Float32Array(MAX_STREAKS * 4);
      const seedData = new Float32Array(MAX_STREAKS);

      const resetRun = () => {
        state.streaks.length = 0;
        state.spawnAccum = 0;
        state.spawnIndex = 0;
        state.lastNow = -1;
        state.runCounter += 1;
        state.rng = createSeededRng((BASE_SEED + state.runCounter * 7919) >>> 0);
        state.resetPending = false;
        for (const rt of [sim.read(), sim.write()]) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
      };

      return {
        render(frame) {
          const rawProgress = frame.progress;
          if (state.resetPending || rawProgress + 1e-6 < state.lastProgress) resetRun();
          state.lastProgress = rawProgress;
          const now = frame.now;
          const dt = state.lastNow < 0 ? 16.7 : Math.min(80, Math.max(0, now - state.lastNow));
          state.lastNow = now;
          const p = clamp01(rawProgress);
          const aspect = frame.cssW / Math.max(1, frame.cssH);

          if (rawProgress < 0.9) {
            const rate = 2.5 + 13.5 * easeStandard(Math.min(1, p / 0.85));
            state.spawnAccum += (rate * dt) / 1000;
            while (state.spawnAccum >= 1) {
              state.spawnAccum -= 1;
              if (state.streaks.length < MAX_STREAKS) spawnStreak(now);
            }
          }

          const alive: Streak[] = [];
          for (const s of state.streaks) {
            const head = SPAWN_Y + ((now - s.born) / 1000) * s.speed;
            if (head < EXPIRE_Y) alive.push(s);
          }
          state.streaks = alive;
          streakData.fill(0);
          seedData.fill(0);
          for (let i = 0; i < alive.length; i++) {
            const s = alive[i];
            const head = SPAWN_Y + ((now - s.born) / 1000) * s.speed;
            streakData[i * 4] = s.x;
            streakData[i * 4 + 1] = s.headPrev;
            streakData[i * 4 + 2] = head;
            streakData[i * 4 + 3] = s.halfWidth;
            seedData[i] = s.seed;
            s.headPrev = head;
          }

          const sheetT = clamp01((p - 0.74) / 0.26);
          const sheetHead = rawProgress >= 1 ? 2.5 : -0.32 + easeStandard(sheetT) * 1.72;
          const wetKeep = Math.exp(-dt / 260);
          const wetScale = 1 - smoothstepNum(0.86, 1, p);

          gl.bindFramebuffer(gl.FRAMEBUFFER, sim.write().fbo);
          gl.viewport(0, 0, SIM_W, SIM_H);
          gl.useProgram(stepProgram);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, sim.read().texture);
          gl.uniform1i(uPrev, 0);
          gl.uniform4fv(uStreaks, streakData);
          gl.uniform1fv(uSeeds, seedData);
          gl.uniform1i(uCount, alive.length);
          gl.uniform1f(uAspect, aspect);
          gl.uniform1f(uSheetHead, sheetHead);
          gl.uniform1f(uWetKeep, wetKeep);
          quad.draw();
          sim.swap();

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.revealed.fbo);
          gl.viewport(0, 0, frame.revealed.width, frame.revealed.height);
          gl.useProgram(compositeProgram);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.field.texture);
          gl.uniform1i(uField, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, sim.read().texture);
          gl.uniform1i(uAccum, 1);
          gl.uniform1f(uTime, now / 1000);
          gl.uniform1f(uWetScale, wetScale);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          quad.draw();
        },
        dispose() {
          sim.dispose();
          gl.deleteProgram(stepProgram);
          gl.deleteProgram(compositeProgram);
        },
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
        state.resetPending = true;
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
