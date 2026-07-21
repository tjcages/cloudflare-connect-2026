import {
  compileProgram,
  createPingPong,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
} from "@necatikcl/stripes-engine";
import { EXPERIMENT_BASE_CONFIG } from "./preset";
import type { ExperimentDefinition } from "./types";
import { VORTEX_COMB_COMPOSITE_FRAG, VORTEX_COMB_STEP_FRAG } from "./vortex-comb.shaders";

const SIM_W = 240;
const SIM_H = 150;
const REF_SPEED = 0.55;
const MAX_SPEED = 1.4;
const REPLAY_MS = 5200;
const REPLAY_LOOPS = 1.75;
const INTRO_DELAY_MS = 700;

const definition: ExperimentDefinition = {
  id: "vortex-comb",
  title: "Vortex Comb",
  category: "trail",
  blurb: "The cursor combs the stripes into counter-rotating eddies that keep swirling and slowly unwind.",
  pointer: "custom",
  create: (ctx) => {
    const pointer = { x: 0, y: 0, active: false };
    const prev = { x: 0, y: 0, valid: false };
    const seg = { ax: 0, ay: 0, bx: 0, by: 0, speed: 0 };
    let lastNow: number | null = null;
    let ghostActive = false;
    let ghostRaf = 0;
    let ghostStart = 0;

    const toLocal = (e: PointerEvent) => {
      const rect = ctx.canvas.getBoundingClientRect();
      const sx = ctx.canvas.clientWidth / Math.max(1, rect.width);
      const sy = ctx.canvas.clientHeight / Math.max(1, rect.height);
      pointer.x = (e.clientX - rect.left) * sx;
      pointer.y = (e.clientY - rect.top) * sy;
      pointer.active = true;
    };
    const onMove = (e: PointerEvent) => {
      if (ghostActive) return;
      toLocal(e);
    };
    const onLeave = () => {
      if (ghostActive) return;
      pointer.active = false;
      prev.valid = false;
    };
    ctx.canvas.addEventListener("pointermove", onMove);
    ctx.canvas.addEventListener("pointerenter", onMove);
    ctx.canvas.addEventListener("pointerleave", onLeave);

    const advance = (now: number, cssW: number, cssH: number) => {
      const aspect = cssW / Math.max(1, cssH);
      const dt = lastNow === null ? 1 / 60 : Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;
      if (!pointer.active) {
        prev.valid = false;
        seg.speed = 0;
        return dt;
      }
      const bx = (pointer.x / Math.max(1, cssW)) * aspect;
      const by = pointer.y / Math.max(1, cssH);
      const ax = prev.valid ? (prev.x / Math.max(1, cssW)) * aspect : bx;
      const ay = prev.valid ? prev.y / Math.max(1, cssH) : by;
      const dist = Math.hypot(bx - ax, by - ay);
      seg.ax = ax;
      seg.ay = ay;
      seg.bx = bx;
      seg.by = by;
      seg.speed = prev.valid && dt > 0 ? Math.min(MAX_SPEED, dist / dt / REF_SPEED) : 0;
      prev.x = pointer.x;
      prev.y = pointer.y;
      prev.valid = true;
      return dt;
    };

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      gl.getExtension("EXT_color_buffer_float");
      const sim = createPingPong(gl, SIM_W, SIM_H, { float: true, linear: true });
      for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, sim.write().fbo);
        gl.viewport(0, 0, SIM_W, SIM_H);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        sim.swap();
      }

      const step = compileProgram(gl, FULLSCREEN_VERT, VORTEX_COMB_STEP_FRAG);
      const uPrev = gl.getUniformLocation(step, "uPrev");
      const uTexel = gl.getUniformLocation(step, "uTexel");
      const uDt = gl.getUniformLocation(step, "uDt");
      const uStepAspect = gl.getUniformLocation(step, "uAspect");
      const uSegA = gl.getUniformLocation(step, "uSegA");
      const uSegB = gl.getUniformLocation(step, "uSegB");
      const uSpeed = gl.getUniformLocation(step, "uSpeed");

      const composite = compileProgram(gl, FULLSCREEN_VERT, VORTEX_COMB_COMPOSITE_FRAG);
      const uField = gl.getUniformLocation(composite, "uField");
      const uSim = gl.getUniformLocation(composite, "uSim");
      const uCompAspect = gl.getUniformLocation(composite, "uAspect");

      return {
        render(frame) {
          const aspect = frame.cssW / Math.max(1, frame.cssH);
          const dt = advance(frame.now, frame.cssW, frame.cssH);

          gl.bindFramebuffer(gl.FRAMEBUFFER, sim.write().fbo);
          gl.viewport(0, 0, SIM_W, SIM_H);
          gl.useProgram(step);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, sim.read().texture);
          gl.uniform1i(uPrev, 0);
          gl.uniform2f(uTexel, 1 / SIM_W, 1 / SIM_H);
          gl.uniform1f(uDt, dt);
          gl.uniform1f(uStepAspect, aspect);
          gl.uniform2f(uSegA, seg.ax, seg.ay);
          gl.uniform2f(uSegB, seg.bx, seg.by);
          gl.uniform1f(uSpeed, seg.speed);
          quad.draw();
          sim.swap();

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(composite);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, sim.read().texture);
          gl.uniform1i(uSim, 1);
          gl.uniform1f(uCompAspect, aspect);
          quad.draw();
        },
        dispose() {
          sim.dispose();
          gl.deleteProgram(step);
          gl.deleteProgram(composite);
        },
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
    });

    const tickGhost = (t: number) => {
      if (ghostStart === 0) ghostStart = t;
      const s = Math.min(1, (t - ghostStart) / REPLAY_MS);
      const tau = s * s * (3 - 2 * s);
      const ang = tau * Math.PI * 2 * REPLAY_LOOPS;
      const w = Math.max(1, ctx.canvas.clientWidth);
      const h = Math.max(1, ctx.canvas.clientHeight);
      pointer.x = w * (0.5 + 0.3 * Math.sin(ang));
      pointer.y = h * (0.5 + 0.17 * Math.sin(ang * 2));
      pointer.active = true;
      if (s < 1) {
        ghostRaf = requestAnimationFrame(tickGhost);
        return;
      }
      ghostRaf = 0;
      ghostActive = false;
      pointer.active = false;
      prev.valid = false;
    };

    const replay = () => {
      if (ghostRaf !== 0) cancelAnimationFrame(ghostRaf);
      ghostActive = true;
      ghostStart = 0;
      prev.valid = false;
      ghostRaf = requestAnimationFrame(tickGhost);
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
        if (ghostRaf !== 0) cancelAnimationFrame(ghostRaf);
        ghostRaf = 0;
        ghostActive = false;
        ctx.canvas.removeEventListener("pointermove", onMove);
        ctx.canvas.removeEventListener("pointerenter", onMove);
        ctx.canvas.removeEventListener("pointerleave", onLeave);
        engine.dispose();
      },
    };
  },
};

export default definition;
