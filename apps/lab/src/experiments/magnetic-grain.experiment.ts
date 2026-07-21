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
import { MAGNETIC_GRAIN_FRAG, MAGNETIC_SIM_FRAG } from "./magnetic-grain.shaders";

const SIM_WIDTH = 224;
const SIM_HEIGHT = 140;
const MAGNET_RADIUS_PX = 85;
const REPLAY_MS = 1700;
const INTRO_DELAY_MS = 450;

function createEase(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const sampleX = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const sampleY = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  const slopeX = (t: number) => 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= (sampleX(t) - x) / slope;
      t = Math.min(1, Math.max(0, t));
    }
    return sampleY(t);
  };
}

const standardEase = createEase(0.6, 0.6, 0, 1);

const definition: ExperimentDefinition = {
  id: "magnetic-grain",
  title: "Magnetic Grain",
  category: "trail",
  blurb: "Iron-filing grain aligns to the cursor's trajectory, then relaxes back with a soft overshoot.",
  pointer: "custom",
  create: (ctx) => {
    let disposed = false;
    const pointer = { x: 0, y: 0, active: false };
    const ghost = { x: 0, y: 0, active: false };

    const onMove = (e: PointerEvent) => {
      const rect = ctx.canvas.getBoundingClientRect();
      pointer.x = (e.clientX - rect.left) / Math.max(1, rect.width);
      pointer.y = (e.clientY - rect.top) / Math.max(1, rect.height);
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    ctx.canvas.addEventListener("pointermove", onMove);
    ctx.canvas.addEventListener("pointerleave", onLeave);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const sim = createPingPong(gl, SIM_WIDTH, SIM_HEIGHT, { float: true, linear: true });
      const stepProgram = compileProgram(gl, FULLSCREEN_VERT, MAGNETIC_SIM_FRAG);
      const grainProgram = compileProgram(gl, FULLSCREEN_VERT, MAGNETIC_GRAIN_FRAG);
      const uPrev = gl.getUniformLocation(stepProgram, "uPrev");
      const uTexel = gl.getUniformLocation(stepProgram, "uTexel");
      const uStepCssSize = gl.getUniformLocation(stepProgram, "uCssSize");
      const uMagnet = gl.getUniformLocation(stepProgram, "uMagnet");
      const uStrength = gl.getUniformLocation(stepProgram, "uStrength");
      const uRadius = gl.getUniformLocation(stepProgram, "uRadius");
      const uDt = gl.getUniformLocation(stepProgram, "uDt");
      const uField = gl.getUniformLocation(grainProgram, "uField");
      const uSim = gl.getUniformLocation(grainProgram, "uSim");
      const uGrainCssSize = gl.getUniformLocation(grainProgram, "uCssSize");
      const tracker = {
        srcId: 0,
        hasPrev: false,
        px: 0,
        py: 0,
        vx: 0,
        vy: 0,
        dirX: 1,
        dirY: 0,
        strength: 0,
        mx: 0.5,
        my: 0.5,
        lastNow: -1,
      };
      return {
        render(frame) {
          const dt =
            tracker.lastNow < 0 ? 1 / 60 : Math.min(0.033, Math.max(0.001, (frame.now - tracker.lastNow) / 1000));
          tracker.lastNow = frame.now;
          const src = ghost.active ? ghost : pointer.active ? pointer : null;
          const srcId = ghost.active ? 1 : pointer.active ? 2 : 0;
          if (srcId !== tracker.srcId) {
            tracker.srcId = srcId;
            tracker.hasPrev = false;
          }
          if (src) {
            const x = src.x * frame.cssW;
            const y = src.y * frame.cssH;
            if (tracker.hasPrev) {
              const smoothing = 1 - Math.exp(-dt * 12);
              tracker.vx += ((x - tracker.px) / dt - tracker.vx) * smoothing;
              tracker.vy += ((y - tracker.py) / dt - tracker.vy) * smoothing;
            } else {
              tracker.vx = 0;
              tracker.vy = 0;
            }
            tracker.px = x;
            tracker.py = y;
            tracker.hasPrev = true;
            const speed = Math.hypot(tracker.vx, tracker.vy);
            if (speed > 1) {
              tracker.dirX = tracker.vx / speed;
              tracker.dirY = tracker.vy / speed;
            }
            const target = Math.min(1, Math.max(0, (speed - 24) / 420));
            tracker.strength += (target - tracker.strength) * (1 - Math.exp(-dt * 10));
            tracker.mx = src.x;
            tracker.my = src.y;
          } else {
            tracker.strength *= Math.exp(-dt * 9);
          }

          gl.bindFramebuffer(gl.FRAMEBUFFER, sim.write().fbo);
          gl.viewport(0, 0, SIM_WIDTH, SIM_HEIGHT);
          gl.useProgram(stepProgram);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, sim.read().texture);
          gl.uniform1i(uPrev, 0);
          gl.uniform2f(uTexel, 1 / SIM_WIDTH, 1 / SIM_HEIGHT);
          gl.uniform2f(uStepCssSize, frame.cssW, frame.cssH);
          gl.uniform4f(uMagnet, tracker.mx, 1 - tracker.my, tracker.dirX, -tracker.dirY);
          gl.uniform1f(uStrength, tracker.strength);
          gl.uniform1f(uRadius, MAGNET_RADIUS_PX);
          gl.uniform1f(uDt, dt);
          quad.draw();
          sim.swap();

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(grainProgram);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, sim.read().texture);
          gl.uniform1i(uSim, 1);
          gl.uniform2f(uGrainCssSize, frame.cssW, frame.cssH);
          quad.draw();
        },
        dispose() {
          sim.dispose();
          gl.deleteProgram(stepProgram);
          gl.deleteProgram(grainProgram);
        },
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
    });

    let replayRaf = 0;
    let introTimer = 0;
    const replay = () => {
      if (disposed) return;
      if (replayRaf) cancelAnimationFrame(replayRaf);
      const start = performance.now();
      ghost.active = true;
      const tick = () => {
        const t = (performance.now() - start) / REPLAY_MS;
        if (disposed || t >= 1) {
          ghost.active = false;
          replayRaf = 0;
          return;
        }
        const eased = standardEase(t);
        const bulge = Math.sin(eased * Math.PI) * 0.07;
        ghost.x = 0.12 + 0.76 * eased - bulge * 0.67;
        ghost.y = 0.16 + 0.68 * eased + bulge * 0.74;
        replayRaf = requestAnimationFrame(tick);
      };
      replayRaf = requestAnimationFrame(tick);
    };

    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      engine.setSource(image);
      introTimer = window.setTimeout(replay, INTRO_DELAY_MS);
    };
    image.src = ctx.textureUrl;
    engine.start();

    return {
      engine,
      replay,
      destroy: () => {
        disposed = true;
        if (replayRaf) cancelAnimationFrame(replayRaf);
        if (introTimer) window.clearTimeout(introTimer);
        ctx.canvas.removeEventListener("pointermove", onMove);
        ctx.canvas.removeEventListener("pointerleave", onLeave);
        engine.dispose();
      },
    };
  },
};

export default definition;
