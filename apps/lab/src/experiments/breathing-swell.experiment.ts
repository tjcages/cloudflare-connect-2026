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
import { BREATHING_SWELL_FRAG } from "./breathing-swell.shaders";

const DEEP_BREATH_MS = 5200;
const DEEP_BREATH_RISE = 0.42;
const DEEP_BREATH_GAIN = 0.5;

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
  id: "breathing-swell",
  title: "Breathing Swell",
  category: "ambience",
  blurb: "Slow travelling swells breathe through the field, bunching stripes at the crest and thinning the troughs.",
  create: (ctx) => {
    let deepStartMs: number | null = null;

    const boostAt = (now: number): number => {
      if (deepStartMs === null) return 1;
      const u = (now - deepStartMs) / DEEP_BREATH_MS;
      if (u >= 1) {
        deepStartMs = null;
        return 1;
      }
      const rise = standardEase(Math.min(1, u / DEEP_BREATH_RISE));
      const fall = standardEase(Math.max(0, (u - DEEP_BREATH_RISE) / (1 - DEEP_BREATH_RISE)));
      return 1 + DEEP_BREATH_GAIN * rise * (1 - fall);
    };

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, BREATHING_SWELL_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uBoost = gl.getUniformLocation(program, "uBoost");
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
          gl.uniform1f(uBoost, boostAt(frame.now));
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
        deepStartMs = performance.now();
      },
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
