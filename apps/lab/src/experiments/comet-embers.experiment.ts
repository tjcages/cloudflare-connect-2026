import {
  compileProgram,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
  type PostHookPass,
} from "@necatikcl/stripes-engine";
import { EXPERIMENT_BASE_CONFIG } from "./preset";
import type { ExperimentDefinition } from "./types";
import { COMET_COMPOSITE_FRAG, COMET_POST_FRAG, EMBER_FRAG, EMBER_VERT } from "./comet-embers.shaders";
import {
  createEmberSim,
  EMBER_PACK_FLOATS,
  EMBER_PACK_STRIDE_BYTES,
  REPLAY_DURATION_S,
  replayPoint,
} from "./comet-embers.sim";

const HEAT_KEY = "comet-embers-heat";

interface CometUniforms {
  cssW: number;
  cssH: number;
  headX: number;
  headY: number;
  dirX: number;
  dirY: number;
  tail: number;
  presence: number;
  time: number;
}

interface CometLocations {
  cssSize: WebGLUniformLocation | null;
  head: WebGLUniformLocation | null;
  dir: WebGLUniformLocation | null;
  tail: WebGLUniformLocation | null;
  presence: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
}

function cometLocations(gl: WebGL2RenderingContext, program: WebGLProgram): CometLocations {
  return {
    cssSize: gl.getUniformLocation(program, "uCssSize"),
    head: gl.getUniformLocation(program, "uHead"),
    dir: gl.getUniformLocation(program, "uDir"),
    tail: gl.getUniformLocation(program, "uTail"),
    presence: gl.getUniformLocation(program, "uPresence"),
    time: gl.getUniformLocation(program, "uTime"),
  };
}

function setCometUniforms(gl: WebGL2RenderingContext, loc: CometLocations, u: CometUniforms): void {
  gl.uniform2f(loc.cssSize, u.cssW, u.cssH);
  gl.uniform2f(loc.head, u.headX, u.headY);
  gl.uniform2f(loc.dir, u.dirX, u.dirY);
  gl.uniform1f(loc.tail, u.tail);
  gl.uniform1f(loc.presence, u.presence);
  gl.uniform1f(loc.time, u.time);
}

const definition: ExperimentDefinition = {
  id: "comet-embers",
  title: "Comet Embers",
  category: "trail",
  blurb: "A comet head shoves the stripes aside, carving a wake and flinging embers that bend the geometry.",
  pointer: "custom",
  create: (ctx) => {
    const input = { x: 0, y: 0, active: false };
    const motion = {
      x: 0,
      y: 0,
      velX: 0,
      velY: 0,
      dirX: 1,
      dirY: 0,
      presence: 0,
      lastNow: 0,
      wasActive: false,
    };
    const uniforms: CometUniforms = {
      cssW: 1,
      cssH: 1,
      headX: 0,
      headY: 0,
      dirX: 1,
      dirY: 0,
      tail: 0,
      presence: 0,
      time: 0,
    };
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

    const fieldPass = ({ gl, quad, pool }: EngineHookContext): FieldHookPass => {
      const composite = compileProgram(gl, FULLSCREEN_VERT, COMET_COMPOSITE_FRAG);
      const compositeLoc = cometLocations(gl, composite);
      const uField = gl.getUniformLocation(composite, "uField");
      const uHeat = gl.getUniformLocation(composite, "uHeat");

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
          const blend = 1 - Math.exp(-dt * 22);
          motion.velX += (instVX - motion.velX) * blend;
          motion.velY += (instVY - motion.velY) * blend;
          const smoothSpeed = Math.hypot(motion.velX, motion.velY);
          const drive = Math.min(1, Math.max(0, (smoothSpeed - 18) / 150));
          const target = active ? Math.pow(drive, 0.7) : 0;
          const rate = target > motion.presence ? 15 : 3.4;
          motion.presence += (target - motion.presence) * (1 - Math.exp(-dt * rate));

          if (smoothSpeed > 12) {
            const nx = motion.velX / smoothSpeed;
            const ny = motion.velY / smoothSpeed;
            const turn = 1 - Math.exp(-dt * 16);
            motion.dirX += (nx - motion.dirX) * turn;
            motion.dirY += (ny - motion.dirY) * turn;
            const len = Math.hypot(motion.dirX, motion.dirY) || 1;
            motion.dirX /= len;
            motion.dirY /= len;
          }

          if (active && motion.wasActive) {
            sim.emit(prevX, prevY, motion.x, motion.y, instVX, instVY, instSpeed, dt);
          }
          motion.wasActive = active;
          sim.step(dtMs);

          uniforms.cssW = frame.cssW;
          uniforms.cssH = frame.cssH;
          uniforms.headX = motion.x;
          uniforms.headY = motion.y;
          uniforms.dirX = motion.dirX;
          uniforms.dirY = motion.dirY;
          uniforms.tail = Math.min(210, 34 + smoothSpeed * 0.1);
          uniforms.presence = motion.presence;
          uniforms.time = frame.now / 1000;

          const heat = pool.get(HEAT_KEY, frame.fieldSize.width, frame.fieldSize.height, { linear: true });
          gl.bindFramebuffer(gl.FRAMEBUFFER, heat.fbo);
          gl.viewport(0, 0, heat.width, heat.height);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);

          const packedEmbers = sim.pack();
          if (packedEmbers.count > 0) {
            gl.useProgram(embers);
            gl.uniform2f(uEmberCanvas, frame.cssW, frame.cssH);
            gl.uniform1f(uEmberTime, uniforms.time);
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
          setCometUniforms(gl, compositeLoc, uniforms);
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

    const postPass = ({ gl, quad }: EngineHookContext): PostHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, COMET_POST_FRAG);
      const loc = cometLocations(gl, program);
      const uSrc = gl.getUniformLocation(program, "uSrc");
      return {
        render(src, dst, frame) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
          gl.viewport(0, 0, dst ? dst.width : frame.outputWidth, dst ? dst.height : frame.outputHeight);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, src);
          gl.uniform1i(uSrc, 0);
          setCometUniforms(gl, loc, uniforms);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass, postPass } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
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
