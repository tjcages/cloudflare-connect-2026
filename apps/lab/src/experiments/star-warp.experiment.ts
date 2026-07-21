import {
  compileProgram,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
} from "@necatikcl/stripes-engine";
import { EXPERIMENT_BASE_CONFIG } from "./preset";
import type { ExperimentDefinition } from "./types";
import { STAR_WARP_FRAG } from "./star-warp.shaders";

const RAMP_MS = 700;
const HOLD_MS = 520;
const DECAY_MS = 2400;
const BURST_MS = RAMP_MS + HOLD_MS + DECAY_MS;
const GAP_MS = 3200;
const INTRO_DELAY_MS = 900;
const CALM_SPEED = 0.045;
const WARP_SPEED = 0.6;

const bezierX = (u: number): number => 3 * u * (1 - u) * (1 - u) * 0.6 + u * u * u;
const bezierY = (u: number): number => 3 * u * (1 - u) * (1 - u) * 0.6 + 3 * u * u * (1 - u) + u * u * u;

function standardEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let mid = t;
  for (let i = 0; i < 22; i++) {
    mid = (lo + hi) * 0.5;
    if (bezierX(mid) < t) lo = mid;
    else hi = mid;
  }
  return bezierY(mid);
}

function burstEnvelope(age: number): number {
  if (age < 0) return 0;
  if (age < RAMP_MS) return standardEase(age / RAMP_MS);
  if (age < RAMP_MS + HOLD_MS) return 1;
  const decayed = (age - RAMP_MS - HOLD_MS) / DECAY_MS;
  if (decayed >= 1) return 0;
  return 1 - standardEase(decayed);
}

const definition: ExperimentDefinition = {
  id: "star-warp",
  title: "Star Warp",
  category: "stars",
  blurb: "Hyperspace bursts stretch drifting stars into radial streaks that shear the stripes outward.",
  create: (ctx) => {
    let requestBurst: (() => void) | null = null;

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, STAR_WARP_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uVanish = gl.getUniformLocation(program, "uVanish");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uWarp = gl.getUniformLocation(program, "uWarp");
      const uWarpDist = gl.getUniformLocation(program, "uWarpDist");

      let warpDistance = 0;
      let lastNow: number | null = null;
      let burstStartMs: number | null = null;
      let nextBurstMs: number | null = null;
      let burstPending = false;

      const triggerBurst = () => {
        burstPending = true;
      };
      requestBurst = triggerBurst;

      return {
        render(frame) {
          const now = frame.now;
          const dt = lastNow === null ? 0 : Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
          lastNow = now;
          if (nextBurstMs === null) nextBurstMs = now + INTRO_DELAY_MS;
          if (burstPending) {
            burstPending = false;
            burstStartMs = now;
            nextBurstMs = now + BURST_MS + GAP_MS;
          } else if (now >= nextBurstMs) {
            burstStartMs = now;
            nextBurstMs = now + BURST_MS + GAP_MS;
          }

          const warp = burstStartMs === null ? 0 : burstEnvelope(now - burstStartMs);
          warpDistance += (CALM_SPEED + WARP_SPEED * warp) * dt;
          const seconds = frame.elapsed / 1000;
          const vanishX = frame.cssW * (0.5 + 0.045 * Math.sin(seconds * 0.11));
          const vanishY = frame.cssH * (0.46 + 0.05 * Math.sin(seconds * 0.083 + 1.7));

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform2f(uVanish, vanishX, vanishY);
          gl.uniform1f(uTime, seconds);
          gl.uniform1f(uWarp, warp);
          gl.uniform1f(uWarpDist, warpDistance);
          quad.draw();
        },
        dispose() {
          if (requestBurst === triggerBurst) requestBurst = null;
          gl.deleteProgram(program);
        },
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
      background: {
        ...EXPERIMENT_BASE_CONFIG.background,
        stars: { ...DEFAULT_ENGINE_CONFIG.background.stars, enabled: false },
      },
    });

    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (!disposed) engine.setSource(image);
    };
    image.src = ctx.textureUrl;
    engine.start();

    return {
      engine,
      replay: () => requestBurst?.(),
      destroy: () => {
        disposed = true;
        image.onload = null;
        engine.dispose();
        requestBurst = null;
      },
    };
  },
};

export default definition;
