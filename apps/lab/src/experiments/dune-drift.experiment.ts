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
import { DUNE_FIELD_FRAG } from "./dune-drift.shaders";

const BASE_DRIFT_PX_PER_SEC = 9.5;
const BASE_MORPH_PER_SEC = 0.055;
const GUST_RISE_MS = 320;
const GUST_DECAY_MS = 1900;
const GUST_SPEED_GAIN = 5.5;
const INTRO_DELAY_MS = 900;

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

const definition: ExperimentDefinition = {
  id: "dune-drift",
  title: "Dune Drift",
  category: "ambience",
  blurb: "Sand-dune ridges migrate across the field, bunching stripes at the crests and thinning them in the troughs.",
  create: (ctx) => {
    const state = {
      drift: 0,
      morph: 0,
      gust: 0,
      gustStartMs: null as number | null,
      gustPending: false,
      lastNow: null as number | null,
    };

    const advance = (now: number) => {
      const dt = state.lastNow === null ? 0 : Math.min(0.05, Math.max(0, (now - state.lastNow) / 1000));
      state.lastNow = now;
      if (state.gustPending) {
        state.gustPending = false;
        state.gustStartMs = now;
      }
      if (state.gustStartMs !== null) {
        const age = now - state.gustStartMs;
        if (age < GUST_RISE_MS) {
          state.gust = standardEase(age / GUST_RISE_MS);
        } else if (age < GUST_RISE_MS + GUST_DECAY_MS) {
          state.gust = 1 - standardEase((age - GUST_RISE_MS) / GUST_DECAY_MS);
        } else {
          state.gust = 0;
          state.gustStartMs = null;
        }
      }
      const speed = 1 + GUST_SPEED_GAIN * state.gust;
      state.drift += dt * BASE_DRIFT_PX_PER_SEC * speed;
      state.morph += dt * BASE_MORPH_PER_SEC * (1 + 1.8 * state.gust);
    };

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, DUNE_FIELD_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uDrift = gl.getUniformLocation(program, "uDrift");
      const uMorph = gl.getUniformLocation(program, "uMorph");
      const uGust = gl.getUniformLocation(program, "uGust");
      return {
        render(frame) {
          advance(frame.now);
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1f(uDrift, state.drift);
          gl.uniform1f(uMorph, state.morph);
          gl.uniform1f(uGust, state.gust);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
    });

    const replay = () => {
      state.gustStartMs = null;
      state.gust = 0;
      state.gustPending = true;
    };

    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (!disposed) engine.setSource(image);
    };
    image.src = ctx.textureUrl;
    engine.start();
    const introTimer = window.setTimeout(replay, INTRO_DELAY_MS);

    return {
      engine,
      replay,
      destroy: () => {
        disposed = true;
        window.clearTimeout(introTimer);
        engine.dispose();
      },
    };
  },
};

export default definition;
