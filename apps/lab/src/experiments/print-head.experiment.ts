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
import { PRINT_HEAD_BAKE_FRAG, PRINT_HEAD_COMPOSITE_FRAG } from "./print-head.shaders";

const DURATION_MS = 2600;
const SETTLE_MS = 125;
const SETTLE_T = SETTLE_MS / DURATION_MS;
const JITTER_PX = 9;
const ROW_PX = 8;
const HEAD_FADE_IN_P = 0.035;

const headFadeIn = (p: number): number => {
  const x = Math.min(1, Math.max(0, p / HEAD_FADE_IN_P));
  return 1 - (1 - x) ** 3;
};

const definition: ExperimentDefinition = {
  id: "print-head",
  title: "Print Head",
  category: "reveal",
  blurb: "A scanline head prints the image top to bottom; fresh rows land with horizontal jitter, settle, and lock.",
  create: (ctx) => {
    const rng = createSeededRng(7);
    const run = { seed: rng() * 1000 };

    const customReveal = ({ gl, quad }: EngineHookContext): CustomRevealPass => {
      const bake = compileProgram(gl, FULLSCREEN_VERT, PRINT_HEAD_BAKE_FRAG);
      const bakeField = gl.getUniformLocation(bake, "uField");
      const bakePrev = gl.getUniformLocation(bake, "uPrev");
      const bakePrevCommitT = gl.getUniformLocation(bake, "uPrevCommitT");
      const bakeCommitT = gl.getUniformLocation(bake, "uCommitT");

      const composite = compileProgram(gl, FULLSCREEN_VERT, PRINT_HEAD_COMPOSITE_FRAG);
      const compField = gl.getUniformLocation(composite, "uField");
      const compAccum = gl.getUniformLocation(composite, "uAccum");
      const compHeadT = gl.getUniformLocation(composite, "uHeadT");
      const compCommitT = gl.getUniformLocation(composite, "uCommitT");
      const compSettleT = gl.getUniformLocation(composite, "uSettleT");
      const compJitterU = gl.getUniformLocation(composite, "uJitterU");
      const compRowCount = gl.getUniformLocation(composite, "uRowCount");
      const compCssH = gl.getUniformLocation(composite, "uCssH");
      const compTime = gl.getUniformLocation(composite, "uTime");
      const compSeed = gl.getUniformLocation(composite, "uSeed");
      const compHeadAlpha = gl.getUniformLocation(composite, "uHeadAlpha");

      const accum = createPingPong(gl, 4, 4);
      let accumW = 4;
      let accumH = 4;
      let prevCommit = 0;
      let lastProgress = Number.POSITIVE_INFINITY;

      const clearAccum = () => {
        gl.clearColor(0, 0, 0, 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, accum.read().fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, accum.write().fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
      };

      return {
        render(frame) {
          const { width, height } = frame.fieldSize;
          if (width !== accumW || height !== accumH) {
            accum.resize(width, height);
            accumW = width;
            accumH = height;
            clearAccum();
            prevCommit = 0;
          }
          const p = frame.progress;
          if (p < lastProgress) {
            clearAccum();
            prevCommit = 0;
          }
          lastProgress = p;

          const headT = p * (1 + SETTLE_T);
          const commitT = Math.min(1, Math.max(0, headT - SETTLE_T));

          if (commitT > prevCommit) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, accum.write().fbo);
            gl.viewport(0, 0, accumW, accumH);
            gl.useProgram(bake);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, frame.field.texture);
            gl.uniform1i(bakeField, 0);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, accum.read().texture);
            gl.uniform1i(bakePrev, 1);
            gl.uniform1f(bakePrevCommitT, prevCommit);
            gl.uniform1f(bakeCommitT, commitT);
            quad.draw();
            accum.swap();
            prevCommit = commitT;
          }

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.revealed.fbo);
          gl.viewport(0, 0, frame.revealed.width, frame.revealed.height);
          gl.useProgram(composite);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.field.texture);
          gl.uniform1i(compField, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, accum.read().texture);
          gl.uniform1i(compAccum, 1);
          gl.uniform1f(compHeadT, headT);
          gl.uniform1f(compCommitT, commitT);
          gl.uniform1f(compSettleT, SETTLE_T);
          gl.uniform1f(compJitterU, JITTER_PX / Math.max(1, frame.cssW));
          gl.uniform1f(compRowCount, Math.max(1, frame.cssH / ROW_PX));
          gl.uniform1f(compCssH, Math.max(1, frame.cssH));
          gl.uniform1f(compTime, frame.now / 1000);
          gl.uniform1f(compSeed, run.seed);
          gl.uniform1f(compHeadAlpha, headT < 1.2 ? headFadeIn(p) : 0);
          quad.draw();
        },
        dispose() {
          accum.dispose();
          gl.deleteProgram(bake);
          gl.deleteProgram(composite);
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
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
    });

    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      engine.setSource(image);
      run.seed = rng() * 1000;
      engine.triggerReveal();
    };
    image.src = ctx.textureUrl;
    engine.start();

    return {
      engine,
      replay: () => {
        run.seed = rng() * 1000;
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
