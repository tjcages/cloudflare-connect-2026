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
import { RIPPLE_WAKE_COMPOSITE_FRAG, RIPPLE_WAKE_STEP_FRAG } from "./ripple-wake.shaders";

const SIM_CELL_CSS_PX = 1.6;
const MAX_SIM_EDGE = 300;
const STEPS_PER_SECOND = 240;
const MAX_STEPS_PER_FRAME = 10;
const SPLAT_RADIUS = 4.2;
const SPLAT_AMP = 0.55;
const SPEED_TO_AMP = 0.11;
const TELEPORT_PX = 320;
const RING_SPACING_PX = 58;
const RING_AMP = 0.7;
const RING_RADIUS = 2.6;
const TAP_AMP = -2.2;
const TAP_RADIUS = 3.4;
const MAX_DROPS = 12;
const IDLE_FREEZE_MS = 6500;
const REPLAY_MS = 4200;

type Drop = { u: number; v: number; amp: number; radius: number };

const definition: ExperimentDefinition = {
  id: "ripple-wake",
  title: "Ripple Wake",
  category: "trail",
  blurb: "The field is still water: the cursor sheds a V wake and expanding ripple rings that interfere and damp out.",
  pointer: "custom",
  create: (ctx) => {
    const pointer = { u: 0.5, v: 0.5, has: false };
    const prev = { u: 0.5, v: 0.5, valid: false };
    const drops: Drop[] = [];
    let rideDist = 0;
    let replaying = false;
    let replayPending = false;
    let replayStart = 0;
    let lastDisturbMs = -Infinity;

    const queueDrop = (u: number, v: number, amp: number, radius: number) => {
      if (drops.length < MAX_DROPS) drops.push({ u, v, amp, radius });
    };

    const toLocal = (e: PointerEvent) => {
      const rect = ctx.canvas.getBoundingClientRect();
      pointer.u = (e.clientX - rect.left) / Math.max(1, rect.width);
      pointer.v = (e.clientY - rect.top) / Math.max(1, rect.height);
    };

    const onMove = (e: PointerEvent) => {
      if (replaying || replayPending) return;
      toLocal(e);
      pointer.has = true;
    };

    const onDown = (e: PointerEvent) => {
      replaying = false;
      replayPending = false;
      toLocal(e);
      pointer.has = true;
      queueDrop(pointer.u, pointer.v, TAP_AMP, TAP_RADIUS);
    };

    const onLeave = () => {
      if (replaying || replayPending) return;
      pointer.has = false;
      prev.valid = false;
    };

    ctx.canvas.addEventListener("pointermove", onMove);
    ctx.canvas.addEventListener("pointerdown", onDown);
    ctx.canvas.addEventListener("pointerleave", onLeave);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const sim = createPingPong(gl, 2, 2, { float: true, linear: true });
      const step = compileProgram(gl, FULLSCREEN_VERT, RIPPLE_WAKE_STEP_FRAG);
      const composite = compileProgram(gl, FULLSCREEN_VERT, RIPPLE_WAKE_COMPOSITE_FRAG);
      const uPrev = gl.getUniformLocation(step, "uPrev");
      const uTexel = gl.getUniformLocation(step, "uTexel");
      const uSplatA = gl.getUniformLocation(step, "uSplatA");
      const uSplatB = gl.getUniformLocation(step, "uSplatB");
      const uSplatDir = gl.getUniformLocation(step, "uSplatDir");
      const uSplatAmp = gl.getUniformLocation(step, "uSplatAmp");
      const uSplatRadius = gl.getUniformLocation(step, "uSplatRadius");
      const uDrop = gl.getUniformLocation(step, "uDrop");
      const uField = gl.getUniformLocation(composite, "uField");
      const uSim = gl.getUniformLocation(composite, "uSim");
      const uSimTexel = gl.getUniformLocation(composite, "uSimTexel");
      let simW = 2;
      let simH = 2;
      let lastNow = -1;
      let stepAccum = 0;

      const clearSim = () => {
        for (const rt of [sim.read(), sim.write()]) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
          gl.viewport(0, 0, rt.width, rt.height);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
      };

      return {
        render(frame) {
          const dt = lastNow < 0 ? 0 : Math.min(100, Math.max(0, frame.now - lastNow));
          lastNow = frame.now;

          let sw = Math.max(16, Math.round(frame.cssW / SIM_CELL_CSS_PX));
          let sh = Math.max(16, Math.round(frame.cssH / SIM_CELL_CSS_PX));
          const longEdge = Math.max(sw, sh);
          if (longEdge > MAX_SIM_EDGE) {
            const scale = MAX_SIM_EDGE / longEdge;
            sw = Math.max(16, Math.round(sw * scale));
            sh = Math.max(16, Math.round(sh * scale));
          }
          if (sw !== simW || sh !== simH) {
            sim.resize(sw, sh);
            simW = sw;
            simH = sh;
            clearSim();
            prev.valid = false;
          }

          if (replayPending) {
            replayPending = false;
            replaying = true;
            replayStart = frame.now;
            prev.valid = false;
          }
          if (replaying) {
            const t = (frame.now - replayStart) / REPLAY_MS;
            if (t >= 1) {
              replaying = false;
              pointer.has = false;
              prev.valid = false;
            } else {
              const s = t * t * (3 - 2 * t);
              const theta = s * Math.PI * 2.5;
              pointer.u = 0.5 + 0.37 * Math.sin(theta);
              pointer.v = 0.5 + 0.27 * Math.sin(theta * 2);
              pointer.has = true;
            }
          }

          let ax = 0;
          let ay = 0;
          let bx = 0;
          let by = 0;
          let amp = 0;
          let dirX = 1;
          let dirY = 0;
          if (pointer.has) {
            const pu = prev.valid ? prev.u : pointer.u;
            const pv = prev.valid ? prev.v : pointer.v;
            const dx = (pointer.u - pu) * frame.cssW;
            const dy = (pointer.v - pv) * frame.cssH;
            const dist = Math.hypot(dx, dy);
            if (dist < TELEPORT_PX && dist > 0.001 && dt > 0) {
              const spd60 = (dist / dt) * (1000 / 60);
              amp = Math.min(1, spd60 * SPEED_TO_AMP) * SPLAT_AMP;
              dirX = dx / dist;
              dirY = -dy / dist;
              ax = pu * simW;
              ay = (1 - pv) * simH;
              bx = pointer.u * simW;
              by = (1 - pointer.v) * simH;
              rideDist += dist;
              while (rideDist >= RING_SPACING_PX) {
                rideDist -= RING_SPACING_PX;
                queueDrop(pointer.u, pointer.v, RING_AMP * (0.5 + 0.5 * Math.min(1, spd60 * 0.08)), RING_RADIUS);
              }
            }
            prev.u = pointer.u;
            prev.v = pointer.v;
            prev.valid = true;
          }

          if (amp > 0 || drops.length > 0 || replaying) lastDisturbMs = frame.now;
          const awake = frame.now - lastDisturbMs < IDLE_FREEZE_MS;

          gl.disable(gl.BLEND);

          if (awake) {
            stepAccum = Math.min(stepAccum + (dt / 1000) * STEPS_PER_SECOND, MAX_STEPS_PER_FRAME);
            const steps = Math.floor(stepAccum);
            stepAccum -= steps;
            if (steps > 0) {
              gl.useProgram(step);
              gl.uniform2f(uTexel, 1 / simW, 1 / simH);
              gl.uniform1f(uSplatRadius, SPLAT_RADIUS);
              gl.uniform2f(uSplatDir, dirX, dirY);
              for (let i = 0; i < steps; i++) {
                const t0 = i / steps;
                const t1 = (i + 1) / steps;
                gl.bindFramebuffer(gl.FRAMEBUFFER, sim.write().fbo);
                gl.viewport(0, 0, simW, simH);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, sim.read().texture);
                gl.uniform1i(uPrev, 0);
                gl.uniform2f(uSplatA, ax + (bx - ax) * t0, ay + (by - ay) * t0);
                gl.uniform2f(uSplatB, ax + (bx - ax) * t1, ay + (by - ay) * t1);
                gl.uniform1f(uSplatAmp, amp);
                const drop = drops.shift();
                if (drop) {
                  gl.uniform4f(uDrop, drop.u * simW, (1 - drop.v) * simH, drop.amp, drop.radius);
                } else {
                  gl.uniform4f(uDrop, 0, 0, 0, 1);
                }
                quad.draw();
                sim.swap();
              }
            }
          }

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(composite);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, sim.read().texture);
          gl.uniform1i(uSim, 1);
          gl.uniform2f(uSimTexel, 1 / simW, 1 / simH);
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
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
      background: {
        ...EXPERIMENT_BASE_CONFIG.background,
        stars: { ...DEFAULT_ENGINE_CONFIG.background.stars, enabled: false },
      },
    });

    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      engine.setSource(image);
      replayPending = true;
    };
    image.src = ctx.textureUrl;
    engine.start();

    return {
      engine,
      replay: () => {
        replayPending = true;
      },
      destroy: () => {
        disposed = true;
        ctx.canvas.removeEventListener("pointermove", onMove);
        ctx.canvas.removeEventListener("pointerdown", onDown);
        ctx.canvas.removeEventListener("pointerleave", onLeave);
        engine.dispose();
      },
    };
  },
};

export default definition;
