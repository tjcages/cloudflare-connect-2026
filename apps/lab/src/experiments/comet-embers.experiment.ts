import {
  compileProgram,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
} from "@necatikcl/stripes-engine";
import type { ExperimentDefinition } from "./types";
import { COMET_COMPOSITE_FRAG, EMBER_FRAG, EMBER_VERT } from "./comet-embers.shaders";
import {
  createEmberSim,
  EMBER_PACK_FLOATS,
  EMBER_PACK_STRIDE_BYTES,
  REPLAY_DURATION_S,
  replayPoint,
} from "./comet-embers.sim";

const definition: ExperimentDefinition = {
  id: "comet-embers",
  title: "Comet Embers",
  category: "trail",
  blurb: "Velocity-stretched comet cursor that sheds cooling ember sparks on fast flicks.",
  pointer: "custom",
  create: (ctx) => {
    const input = { x: 0, y: 0, active: false };
    const motion = { x: 0, y: 0, velX: 0, velY: 0, glow: 0, lastNow: 0, wasActive: false };
    const sim = createEmberSim(0x9e3779);

    let replayRaf = 0;
    let replayStart = 0;

    const stopReplay = () => {
      if (replayRaf !== 0) {
        cancelAnimationFrame(replayRaf);
        replayRaf = 0;
      }
    };

    const replayTick = () => {
      replayRaf = 0;
      const t = (performance.now() - replayStart) / 1000;
      if (t >= REPLAY_DURATION_S) {
        input.active = false;
        return;
      }
      const w = ctx.canvas.clientWidth || 1;
      const h = ctx.canvas.clientHeight || 1;
      const p = replayPoint(Math.max(0, t));
      input.x = p.x * w;
      input.y = p.y * h;
      input.active = true;
      replayRaf = requestAnimationFrame(replayTick);
    };

    const startReplay = (delayMs: number) => {
      stopReplay();
      replayStart = performance.now() + delayMs;
      replayRaf = requestAnimationFrame(replayTick);
    };

    const onMove = (e: PointerEvent) => {
      stopReplay();
      const rect = ctx.canvas.getBoundingClientRect();
      const sx = rect.width > 0 ? ctx.canvas.clientWidth / rect.width : 1;
      const sy = rect.height > 0 ? ctx.canvas.clientHeight / rect.height : 1;
      input.x = (e.clientX - rect.left) * sx;
      input.y = (e.clientY - rect.top) * sy;
      input.active = true;
    };
    const onLeave = () => {
      input.active = false;
    };
    ctx.canvas.addEventListener("pointermove", onMove);
    ctx.canvas.addEventListener("pointerleave", onLeave);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const composite = compileProgram(gl, FULLSCREEN_VERT, COMET_COMPOSITE_FRAG);
      const uField = gl.getUniformLocation(composite, "uField");
      const uCssSize = gl.getUniformLocation(composite, "uCssSize");
      const uHead = gl.getUniformLocation(composite, "uHead");
      const uVel = gl.getUniformLocation(composite, "uVel");
      const uGlow = gl.getUniformLocation(composite, "uGlow");
      const uTime = gl.getUniformLocation(composite, "uTime");

      const embers = compileProgram(gl, EMBER_VERT, EMBER_FRAG);
      const uEmberCanvas = gl.getUniformLocation(embers, "uCanvas");
      const uEmberTime = gl.getUniformLocation(embers, "uTime");

      const vao = gl.createVertexArray();
      const buf = gl.createBuffer();
      if (!vao || !buf) throw new Error("Failed to create comet ember GL objects");
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
          const dtMs = motion.lastNow === 0 ? 16.7 : Math.min(50, Math.max(0.5, frame.now - motion.lastNow));
          motion.lastNow = frame.now;
          const dt = dtMs / 1000;

          const active = input.active;
          if (active && !motion.wasActive) {
            motion.x = input.x;
            motion.y = input.y;
            motion.velX = 0;
            motion.velY = 0;
          }
          const prevX = motion.x;
          const prevY = motion.y;
          if (active) {
            motion.x = input.x;
            motion.y = input.y;
          }
          const instVX = (motion.x - prevX) / dt;
          const instVY = (motion.y - prevY) / dt;
          const instSpeed = Math.hypot(instVX, instVY);
          const blend = 1 - Math.exp(-dt * 24);
          motion.velX += (instVX - motion.velX) * blend;
          motion.velY += (instVY - motion.velY) * blend;
          motion.glow += ((active ? 1 : 0) - motion.glow) * (1 - Math.exp(-dt * (active ? 12 : 5)));

          if (active && motion.wasActive) {
            sim.emit(prevX, prevY, motion.x, motion.y, instVX, instVY, instSpeed, dt);
          }
          motion.wasActive = active;
          sim.step(dtMs);

          gl.disable(gl.BLEND);
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(composite);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform2f(uHead, motion.x, motion.y);
          gl.uniform2f(uVel, motion.velX, motion.velY);
          gl.uniform1f(uGlow, motion.glow);
          gl.uniform1f(uTime, frame.now / 1000);
          quad.draw();

          const packedEmbers = sim.pack();
          if (packedEmbers.count > 0) {
            gl.useProgram(embers);
            gl.uniform2f(uEmberCanvas, frame.cssW, frame.cssH);
            gl.uniform1f(uEmberTime, frame.now / 1000);
            gl.bindVertexArray(vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              packedEmbers.data.subarray(0, packedEmbers.count * EMBER_PACK_FLOATS),
              gl.DYNAMIC_DRAW,
            );
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, packedEmbers.count);
            gl.disable(gl.BLEND);
            gl.bindVertexArray(null);
          }
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
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
    });
    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      engine.setSource(image);
      startReplay(400);
    };
    image.src = ctx.textureUrl;
    engine.start();
    return {
      engine,
      replay: () => startReplay(0),
      destroy: () => {
        disposed = true;
        stopReplay();
        ctx.canvas.removeEventListener("pointermove", onMove);
        ctx.canvas.removeEventListener("pointerleave", onLeave);
        engine.dispose();
      },
    };
  },
};

export default definition;
