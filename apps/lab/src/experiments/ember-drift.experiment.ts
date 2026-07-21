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
import { EMBER_DRIFT_COMPOSITE_FRAG, EMBER_DRIFT_FRAG, EMBER_DRIFT_VERT } from "./ember-drift.shaders";
import {
  createEmberDriftSim,
  EMBER_PACK_FLOATS,
  EMBER_PACK_STRIDE_BYTES,
  REPLAY_DURATION_S,
  updraftAt,
} from "./ember-drift.sim";

const HEAT_KEY = "ember-drift-heat";

const definition: ExperimentDefinition = {
  id: "ember-drift",
  title: "Ember Drift",
  category: "ambience",
  blurb: "Slow embers rise, sway and cool, each nudging the stripes only where it glows.",
  pointer: "custom",
  create: (ctx) => {
    const sim = createEmberDriftSim(0x51a7c3);
    const drive = { lastNow: 0, replayStart: 0, pending: false, updraft: 0 };

    const fieldPass = ({ gl, quad, pool }: EngineHookContext): FieldHookPass => {
      const composite = compileProgram(gl, FULLSCREEN_VERT, EMBER_DRIFT_COMPOSITE_FRAG);
      const uField = gl.getUniformLocation(composite, "uField");
      const uHeat = gl.getUniformLocation(composite, "uHeat");
      const uCssSize = gl.getUniformLocation(composite, "uCssSize");
      const uCompositeUpdraft = gl.getUniformLocation(composite, "uUpdraft");

      const embers = compileProgram(gl, EMBER_DRIFT_VERT, EMBER_DRIFT_FRAG);
      const uCanvas = gl.getUniformLocation(embers, "uCanvas");
      const uTime = gl.getUniformLocation(embers, "uTime");
      const uEmberUpdraft = gl.getUniformLocation(embers, "uUpdraft");

      const vao = gl.createVertexArray();
      const buf = gl.createBuffer();
      if (!vao || !buf) throw new Error("Failed to create ember drift GL objects");
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const aEmber = gl.getAttribLocation(embers, "aEmber");
      const aSeed = gl.getAttribLocation(embers, "aSeed");
      gl.enableVertexAttribArray(aEmber);
      gl.vertexAttribPointer(aEmber, 4, gl.FLOAT, false, EMBER_PACK_STRIDE_BYTES, 0);
      gl.vertexAttribDivisor(aEmber, 1);
      gl.enableVertexAttribArray(aSeed);
      gl.vertexAttribPointer(aSeed, 1, gl.FLOAT, false, EMBER_PACK_STRIDE_BYTES, 16);
      gl.vertexAttribDivisor(aSeed, 1);
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      return {
        render(frame) {
          const dtMs = drive.lastNow === 0 ? 16.7 : Math.min(50, Math.max(0.5, frame.now - drive.lastNow));
          drive.lastNow = frame.now;

          if (drive.pending) {
            drive.pending = false;
            drive.replayStart = frame.now;
          }
          if (drive.replayStart !== 0) {
            const t = (frame.now - drive.replayStart) / 1000;
            if (t >= REPLAY_DURATION_S) {
              drive.replayStart = 0;
              drive.updraft = 0;
            } else {
              drive.updraft = updraftAt(t);
            }
          }

          sim.setUpdraft(drive.updraft);
          sim.step(dtMs, frame.cssW, frame.cssH);

          const heat = pool.get(HEAT_KEY, frame.fieldSize.width, frame.fieldSize.height, { linear: true });
          gl.bindFramebuffer(gl.FRAMEBUFFER, heat.fbo);
          gl.viewport(0, 0, heat.width, heat.height);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);

          const packedEmbers = sim.pack();
          if (packedEmbers.count > 0) {
            gl.useProgram(embers);
            gl.uniform2f(uCanvas, frame.cssW, frame.cssH);
            gl.uniform1f(uTime, frame.now / 1000);
            gl.uniform1f(uEmberUpdraft, drive.updraft);
            gl.bindVertexArray(vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              packedEmbers.data.subarray(0, packedEmbers.count * EMBER_PACK_FLOATS),
              gl.DYNAMIC_DRAW,
            );
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE);
            gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, packedEmbers.count);
            gl.disable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.bindVertexArray(null);
          }

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(composite);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, heat.texture);
          gl.uniform1i(uHeat, 1);
          gl.activeTexture(gl.TEXTURE0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1f(uCompositeUpdraft, drive.updraft);
          quad.draw();
        },
        dispose() {
          gl.deleteProgram(composite);
          gl.deleteProgram(embers);
          gl.deleteVertexArray(vao);
          gl.deleteBuffer(buf);
        },
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
    });
    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      engine.setSource(image);
    };
    image.src = ctx.textureUrl;
    engine.start();
    return {
      engine,
      replay: () => {
        drive.pending = true;
      },
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
