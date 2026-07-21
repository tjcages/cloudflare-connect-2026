import {
  compileProgram,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
} from "@necatikcl/stripes-engine";
import type { ExperimentDefinition } from "./types";
import { AURORA_CURTAINS_FRAG } from "./aurora-curtains.shaders";

const SURGE_MS = 1900;
const GHOST_WEIGHT = 0.16;

const standardEase = (t: number): number => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const cx = 1.8;
  const bx = -3.6;
  const ax = 2.8;
  const cy = 1.8;
  const by = -0.6;
  const ay = -0.2;
  let u = t;
  for (let i = 0; i < 6; i++) {
    const x = ((ax * u + bx) * u + cx) * u - t;
    const dx = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(dx) < 1e-6) break;
    u -= x / dx;
  }
  u = Math.min(1, Math.max(0, u));
  return ((ay * u + by) * u + cy) * u;
};

const definition: ExperimentDefinition = {
  id: "aurora-curtains",
  title: "Aurora Curtains",
  category: "ambience",
  blurb: "Three layered aurora curtains undulate at offset phases, brightness rippling along their length.",
  create: (ctx) => {
    let surgeRequested = false;
    let surgeStartMs = -1;

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, AURORA_CURTAINS_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uGhost = gl.getUniformLocation(program, "uGhost");
      const uSurge = gl.getUniformLocation(program, "uSurge");

      return {
        render(frame) {
          if (surgeRequested) {
            surgeRequested = false;
            surgeStartMs = frame.now;
          }
          let surge = -1;
          if (surgeStartMs >= 0) {
            const progress = (frame.now - surgeStartMs) / SURGE_MS;
            if (progress >= 1) surgeStartMs = -1;
            else surge = standardEase(progress);
          }

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform1f(uTime, frame.elapsed / 1000);
          gl.uniform1f(uGhost, GHOST_WEIGHT);
          gl.uniform1f(uSurge, surge);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
    engine.setConfig({
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      background: {
        ...DEFAULT_ENGINE_CONFIG.background,
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
      replay: () => {
        surgeRequested = true;
      },
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
