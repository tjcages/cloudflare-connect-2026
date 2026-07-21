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
import { HEAT_SHIMMER_FIELD_FRAG } from "./heat-shimmer.shaders";

const SURGE_RISE_MS = 480;
const SURGE_HOLD_MS = 240;
const SURGE_FALL_MS = 1180;
const SURGE_PEAK = 1;

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
  id: "heat-shimmer",
  title: "Heat Shimmer",
  category: "ambience",
  blurb: "Rising columns of hot air refract the stripe geometry, strongest at the ground and fading upward.",
  create: (ctx) => {
    const surge = { startMs: null as number | null, pending: false };

    const surgeAt = (now: number): number => {
      if (surge.pending) {
        surge.startMs = now;
        surge.pending = false;
      }
      if (surge.startMs === null) return 0;
      const age = now - surge.startMs;
      if (age < SURGE_RISE_MS) return standardEase(age / SURGE_RISE_MS) * SURGE_PEAK;
      if (age < SURGE_RISE_MS + SURGE_HOLD_MS) return SURGE_PEAK;
      const fall = (age - SURGE_RISE_MS - SURGE_HOLD_MS) / SURGE_FALL_MS;
      if (fall >= 1) {
        surge.startMs = null;
        return 0;
      }
      return (1 - standardEase(fall)) * SURGE_PEAK;
    };

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, HEAT_SHIMMER_FIELD_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uSurge = gl.getUniformLocation(program, "uSurge");
      return {
        render(frame) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1f(uTime, frame.elapsed / 1000);
          gl.uniform1f(uSurge, surgeAt(frame.now));
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

    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (!disposed) engine.setSource(image);
    };
    image.src = ctx.textureUrl;
    engine.start();

    return {
      engine,
      replay: () => {
        surge.pending = true;
      },
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
