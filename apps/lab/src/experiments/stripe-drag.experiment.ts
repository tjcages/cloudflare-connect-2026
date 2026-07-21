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
import { STRIPE_DRAG_FIELD_FRAG, STRIPE_DRAG_SIM_FRAG } from "./stripe-drag.shaders";

const SIM_W = 224;
const SIM_H = 140;
const DRAG_MS = 1500;
const HOLD_MS = 520;
const INTRO_DELAY_MS = 700;

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
  id: "stripe-drag",
  title: "Stripe Drag",
  category: "trail",
  blurb: "The cursor grabs the stripe field like cloth, stretching it into ribbons that snap elastically back.",
  pointer: "custom",
  create: (ctx) => {
    const pointer = { x: 0, y: 0, active: false };

    const setFromEvent = (e: PointerEvent) => {
      const rect = ctx.canvas.getBoundingClientRect();
      const sx = ctx.canvas.clientWidth / Math.max(1, rect.width);
      const sy = ctx.canvas.clientHeight / Math.max(1, rect.height);
      pointer.x = (e.clientX - rect.left) * sx;
      pointer.y = (e.clientY - rect.top) * sy;
    };

    let ghostRaf = 0;
    const stopGhost = () => {
      if (ghostRaf) {
        cancelAnimationFrame(ghostRaf);
        ghostRaf = 0;
      }
    };

    const onMove = (e: PointerEvent) => {
      stopGhost();
      setFromEvent(e);
      pointer.active = true;
    };
    const onLeave = () => {
      if (!ghostRaf) pointer.active = false;
    };
    ctx.canvas.addEventListener("pointermove", onMove);
    ctx.canvas.addEventListener("pointerleave", onLeave);
    ctx.canvas.addEventListener("pointercancel", onLeave);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const sim = createPingPong(gl, SIM_W, SIM_H, { float: true, linear: true });
      const stepProgram = compileProgram(gl, FULLSCREEN_VERT, STRIPE_DRAG_SIM_FRAG);
      const fieldProgram = compileProgram(gl, FULLSCREEN_VERT, STRIPE_DRAG_FIELD_FRAG);
      const uPrev = gl.getUniformLocation(stepProgram, "uPrev");
      const uStepCss = gl.getUniformLocation(stepProgram, "uCssSize");
      const uPrevPos = gl.getUniformLocation(stepProgram, "uPrevPos");
      const uCurPos = gl.getUniformLocation(stepProgram, "uCurPos");
      const uDelta = gl.getUniformLocation(stepProgram, "uDelta");
      const uActive = gl.getUniformLocation(stepProgram, "uActive");
      const uDt = gl.getUniformLocation(stepProgram, "uDt");
      const uScale = gl.getUniformLocation(stepProgram, "uScale");
      const uField = gl.getUniformLocation(fieldProgram, "uField");
      const uSim = gl.getUniformLocation(fieldProgram, "uSim");
      const uFieldCss = gl.getUniformLocation(fieldProgram, "uCssSize");

      let lastNow = 0;
      let lastX = 0;
      let lastY = 0;
      let wasActive = false;

      return {
        render(frame) {
          const scale = Math.min(2.5, Math.max(0.5, Math.min(frame.cssW, frame.cssH) / 300));
          const dt = lastNow === 0 ? 1 / 60 : Math.min(1 / 30, Math.max(0, (frame.now - lastNow) / 1000));
          lastNow = frame.now;

          const active = pointer.active;
          if (!active || !wasActive) {
            lastX = pointer.x;
            lastY = pointer.y;
          }
          wasActive = active;

          let dx = pointer.x - lastX;
          let dy = pointer.y - lastY;
          const dl = Math.hypot(dx, dy);
          const maxStep = 70 * scale;
          if (dl > maxStep) {
            dx *= maxStep / dl;
            dy *= maxStep / dl;
          }
          const prevX = lastX;
          const prevY = lastY;
          lastX = pointer.x;
          lastY = pointer.y;

          gl.bindFramebuffer(gl.FRAMEBUFFER, sim.write().fbo);
          gl.viewport(0, 0, SIM_W, SIM_H);
          gl.useProgram(stepProgram);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, sim.read().texture);
          gl.uniform1i(uPrev, 0);
          gl.uniform2f(uStepCss, frame.cssW, frame.cssH);
          gl.uniform2f(uPrevPos, prevX, prevY);
          gl.uniform2f(uCurPos, pointer.x, pointer.y);
          gl.uniform2f(uDelta, dx, dy);
          gl.uniform1f(uActive, active ? 1 : 0);
          gl.uniform1f(uDt, dt);
          gl.uniform1f(uScale, scale);
          quad.draw();
          sim.swap();

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(fieldProgram);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, sim.read().texture);
          gl.uniform1i(uSim, 1);
          gl.uniform2f(uFieldCss, frame.cssW, frame.cssH);
          quad.draw();
          gl.activeTexture(gl.TEXTURE0);
        },
        dispose() {
          sim.dispose();
          gl.deleteProgram(stepProgram);
          gl.deleteProgram(fieldProgram);
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

    const replay = () => {
      stopGhost();
      const w = Math.max(1, ctx.canvas.clientWidth);
      const h = Math.max(1, ctx.canvas.clientHeight);
      const ax = w * 0.16;
      const ay = h * 0.72;
      const bx = w * 0.86;
      const by = h * 0.3;
      const startMs = performance.now();
      pointer.x = ax;
      pointer.y = ay;
      pointer.active = true;
      const tick = () => {
        const t = performance.now() - startMs;
        if (t < DRAG_MS) {
          const u = standardEase(t / DRAG_MS);
          const bow = Math.sin(Math.PI * u) * h * 0.13;
          pointer.x = ax + (bx - ax) * u;
          pointer.y = ay + (by - ay) * u + bow;
          ghostRaf = requestAnimationFrame(tick);
          return;
        }
        if (t < DRAG_MS + HOLD_MS) {
          pointer.x = bx;
          pointer.y = by;
          ghostRaf = requestAnimationFrame(tick);
          return;
        }
        pointer.active = false;
        ghostRaf = 0;
      };
      ghostRaf = requestAnimationFrame(tick);
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
        stopGhost();
        ctx.canvas.removeEventListener("pointermove", onMove);
        ctx.canvas.removeEventListener("pointerleave", onLeave);
        ctx.canvas.removeEventListener("pointercancel", onLeave);
        engine.dispose();
      },
    };
  },
};

export default definition;
