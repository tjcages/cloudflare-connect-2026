import {
  compileProgram,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
} from "@necatikcl/stripes-engine";
import type { ExperimentDefinition } from "./types";
import { GRAVITY_WELL_FRAG } from "./gravity-well.shaders";

const MAX_TWIST = 5;
const HARD_MAX_TWIST = 7.5;
const BUILD_TAU_S = 0.75;
const CREEP_RAD_PER_S = 0.3;
const PULL_SCALE = 0.34;
const HOLD_OMEGA = 14;
const HOLD_ZETA = 1.05;
const RELEASE_OMEGA = 13;
const RELEASE_ZETA = 0.19;
const RIPPLE_SPEED = 1.45;
const RIPPLE_DECAY_S = 0.38;
const RIPPLE_RAMP_S = 0.06;
const GHOST_HOLD_MS = 1200;

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

const definition: ExperimentDefinition = {
  id: "gravity-well",
  title: "Gravity Well",
  category: "click",
  blurb: "Press and hold to spin up an attractor; release for an elastic snap-back with a soft ripple.",
  pointer: "custom",
  create: (ctx) => {
    const well = {
      holding: false,
      holdStartMs: 0,
      centerX: 0.5,
      centerY: 0.5,
      twist: 0,
      twistVel: 0,
      lastNow: -1,
      rippleStartMs: 0,
      rippleAmp0: 0,
      rippleX: 0.5,
      rippleY: 0.5,
      ghostReleaseMs: 0,
      replaySeq: 0,
    };

    const pressAt = (x: number, y: number, now: number) => {
      well.holding = true;
      well.holdStartMs = now;
      well.centerX = x;
      well.centerY = y;
      well.twist = 0;
      well.twistVel = 0;
    };

    const releaseAt = (now: number) => {
      if (!well.holding) return;
      well.holding = false;
      const strength = clamp(well.twist / MAX_TWIST, 0, 1);
      if (strength > 0.04) {
        well.rippleStartMs = now;
        well.rippleAmp0 = 0.35 + 0.65 * strength;
        well.rippleX = well.centerX;
        well.rippleY = well.centerY;
      }
    };

    const onDown = (e: PointerEvent) => {
      well.ghostReleaseMs = 0;
      const rect = ctx.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(1, rect.width);
      const y = (e.clientY - rect.top) / Math.max(1, rect.height);
      ctx.canvas.setPointerCapture(e.pointerId);
      pressAt(clamp(x, 0, 1), clamp(y, 0, 1), performance.now());
    };
    const onUp = () => releaseAt(performance.now());
    ctx.canvas.addEventListener("pointerdown", onDown);
    ctx.canvas.addEventListener("pointerup", onUp);
    ctx.canvas.addEventListener("pointercancel", onUp);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, GRAVITY_WELL_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCenter = gl.getUniformLocation(program, "uCenter");
      const uRippleCenter = gl.getUniformLocation(program, "uRippleCenter");
      const uAspect = gl.getUniformLocation(program, "uAspect");
      const uTwist = gl.getUniformLocation(program, "uTwist");
      const uPull = gl.getUniformLocation(program, "uPull");
      const uStrength = gl.getUniformLocation(program, "uStrength");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uRippleRadius = gl.getUniformLocation(program, "uRippleRadius");
      const uRippleAmp = gl.getUniformLocation(program, "uRippleAmp");

      return {
        render(frame) {
          if (well.ghostReleaseMs > 0 && frame.now >= well.ghostReleaseMs) {
            releaseAt(well.ghostReleaseMs);
            well.ghostReleaseMs = 0;
          }

          if (well.lastNow < 0) well.lastNow = frame.now;
          const dtS = clamp((frame.now - well.lastNow) / 1000, 0, 0.05);
          well.lastNow = frame.now;

          let target = 0;
          if (well.holding) {
            const holdS = Math.max(0, (frame.now - well.holdStartMs) / 1000);
            const base = MAX_TWIST * (1 - Math.exp(-holdS / BUILD_TAU_S));
            target = Math.min(HARD_MAX_TWIST, base + CREEP_RAD_PER_S * Math.max(0, holdS - 2));
          }
          const omega = well.holding ? HOLD_OMEGA : RELEASE_OMEGA;
          const zeta = well.holding ? HOLD_ZETA : RELEASE_ZETA;
          const h = dtS / 2;
          for (let i = 0; i < 2; i++) {
            const accel = omega * omega * (target - well.twist) - 2 * zeta * omega * well.twistVel;
            well.twistVel += accel * h;
            well.twist += well.twistVel * h;
          }
          if (!well.holding && Math.abs(well.twist) < 0.0004 && Math.abs(well.twistVel) < 0.0004) {
            well.twist = 0;
            well.twistVel = 0;
          }

          let rippleRadius = -1;
          let rippleAmp = 0;
          if (well.rippleStartMs > 0) {
            const rippleS = Math.max(0, (frame.now - well.rippleStartMs) / 1000);
            rippleAmp = well.rippleAmp0 * Math.exp(-rippleS / RIPPLE_DECAY_S) * Math.min(1, rippleS / RIPPLE_RAMP_S);
            rippleRadius = 0.1 + RIPPLE_SPEED * rippleS;
            if (rippleAmp < 0.012 && rippleS > RIPPLE_RAMP_S) {
              well.rippleStartMs = 0;
              rippleAmp = 0;
              rippleRadius = -1;
            }
          }

          const norm = well.twist / MAX_TWIST;
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCenter, well.centerX, well.centerY);
          gl.uniform2f(uRippleCenter, well.rippleX, well.rippleY);
          gl.uniform1f(uAspect, frame.cssW / Math.max(1, frame.cssH));
          gl.uniform1f(uTwist, well.twist);
          gl.uniform1f(uPull, PULL_SCALE * clamp(norm, -1.25, 1.25));
          gl.uniform1f(uStrength, clamp(norm, -1, 1));
          gl.uniform1f(uTime, frame.elapsed / 1000);
          gl.uniform1f(uRippleRadius, rippleRadius);
          gl.uniform1f(uRippleAmp, rippleAmp);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
    engine.setConfig({
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
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
        well.replaySeq += 1;
        const now = performance.now();
        const gx = 0.5 + 0.26 * Math.cos(well.replaySeq * 2.4);
        const gy = 0.5 + 0.2 * Math.sin(well.replaySeq * 2.4 + 1.7);
        pressAt(gx, gy, now);
        well.ghostReleaseMs = now + GHOST_HOLD_MS;
      },
      destroy: () => {
        disposed = true;
        ctx.canvas.removeEventListener("pointerdown", onDown);
        ctx.canvas.removeEventListener("pointerup", onUp);
        ctx.canvas.removeEventListener("pointercancel", onUp);
        engine.dispose();
      },
    };
  },
};

export default definition;
