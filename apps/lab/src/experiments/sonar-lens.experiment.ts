import {
  compileProgram,
  createRealClock,
  createSeededRng,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type CustomRevealPass,
  type EngineHookContext,
} from "@necatikcl/stripes-engine";
import { EXPERIMENT_BASE_CONFIG } from "./preset";
import type { ExperimentDefinition } from "./types";
import { SONAR_LENS_REVEAL_FRAG } from "./sonar-lens.shaders";

const MAX_RINGS = 12;
const RINGS_PER_PING = 3;
const MAX_PINGS = 4;
const TRAVEL_MS = 1600;
const ECHO_DELAY_MS = 360;
const ECHO_STRENGTH = [1, 0.6, 0.34];
const ECHO_WIDTH = [1, 0.8, 0.65];
const START_RADIUS = 0.012;
const PING_LIFE_MS = ECHO_DELAY_MS * (RINGS_PER_PING - 1) + TRAVEL_MS * 1.12;

type Ping = { x: number; y: number; born: number; seed: number };

function easeStandard(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let u = x;
  for (let i = 0; i < 6; i++) {
    const inv = 1 - u;
    const bx = 1.8 * inv * inv * u + u * u * u;
    const dx = 1.8 * inv * inv - 3.6 * inv * u + 3 * u * u;
    if (Math.abs(dx) < 1e-6) break;
    u = Math.min(1, Math.max(0, u - (bx - x) / dx));
  }
  const inv = 1 - u;
  return 1.8 * inv * inv * u + 3 * inv * u * u + u * u * u;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const definition: ExperimentDefinition = {
  id: "sonar-lens",
  title: "Sonar Lens",
  category: "click",
  blurb: "Click pings 3 sonar rings that sweep the image out of static, each echo fainter.",
  pointer: "custom",
  create: (ctx) => {
    const clock = createRealClock();
    const rng = createSeededRng(1201);
    const created = clock.now();
    const pings: Ping[] = [];

    const ping = (x: number, y: number) => {
      pings.push({ x, y, born: clock.now(), seed: rng() });
      if (pings.length > MAX_PINGS) pings.shift();
    };

    const onPointerDown = (e: PointerEvent) => {
      const rect = ctx.canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      ping((e.clientX - rect.left) / rect.width, 1 - (e.clientY - rect.top) / rect.height);
    };
    ctx.canvas.addEventListener("pointerdown", onPointerDown);

    const customReveal = ({ gl, quad }: EngineHookContext): CustomRevealPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, SONAR_LENS_REVEAL_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uRingCount = gl.getUniformLocation(program, "uRingCount");
      const uRings = gl.getUniformLocation(program, "uRings");
      const uRingMeta = gl.getUniformLocation(program, "uRingMeta");
      const uFlash = gl.getUniformLocation(program, "uFlash");
      const uAspect = gl.getUniformLocation(program, "uAspect");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uGrain = gl.getUniformLocation(program, "uGrain");
      const ringData = new Float32Array(MAX_RINGS * 4);
      const ringMeta = new Float32Array(MAX_RINGS * 2);
      return {
        render(frame) {
          const now = frame.now;
          for (let i = pings.length - 1; i >= 0; i--) {
            if (now - pings[i].born > PING_LIFE_MS) pings.splice(i, 1);
          }
          const aspect = frame.cssW / Math.max(1, frame.cssH);
          let count = 0;
          let flashX = 0.5;
          let flashY = 0.5;
          let flashS = 0;
          for (const p of pings) {
            const age = now - p.born;
            const fs = Math.min(1, age / 40) * Math.exp(-age / 160) * 0.9;
            if (fs > flashS) {
              flashS = fs;
              flashX = p.x;
              flashY = p.y;
            }
            const cx = p.x * aspect;
            const rMax =
              Math.max(
                Math.hypot(cx, p.y),
                Math.hypot(aspect - cx, p.y),
                Math.hypot(cx, 1 - p.y),
                Math.hypot(aspect - cx, 1 - p.y),
              ) + 0.06;
            for (let e = 0; e < RINGS_PER_PING && count < MAX_RINGS; e++) {
              const t = (age - e * ECHO_DELAY_MS) / TRAVEL_MS;
              if (t <= 0 || t >= 1.12) continue;
              const env = smoothstep(0, 0.045, t) * (1 - smoothstep(0.8, 1.1, t));
              if (env <= 0.001) continue;
              const base = count * 4;
              ringData[base] = p.x;
              ringData[base + 1] = p.y;
              ringData[base + 2] = START_RADIUS + (rMax - START_RADIUS) * easeStandard(Math.min(1, t));
              ringData[base + 3] = ECHO_STRENGTH[e] * env;
              ringMeta[count * 2] = p.seed + e * 0.37;
              ringMeta[count * 2 + 1] = ECHO_WIDTH[e];
              count++;
            }
          }
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.revealed.fbo);
          gl.viewport(0, 0, frame.revealed.width, frame.revealed.height);
          gl.disable(gl.BLEND);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.field.texture);
          gl.uniform1i(uField, 0);
          gl.uniform1i(uRingCount, count);
          gl.uniform4fv(uRings, ringData);
          gl.uniform2fv(uRingMeta, ringMeta);
          gl.uniform4f(uFlash, flashX, flashY, flashS, 0.05);
          gl.uniform1f(uAspect, aspect);
          gl.uniform1f(uTime, (now - created) / 1000);
          gl.uniform2f(uGrain, frame.cssW / 8, frame.cssH / 8);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const engine = createStripesEngine(ctx.canvas, { clock, hooks: { customReveal } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      reveal: {
        ...DEFAULT_ENGINE_CONFIG.reveal,
        enabled: true,
        type: "custom",
        wave: { ...DEFAULT_ENGINE_CONFIG.reveal.wave, durationMs: TRAVEL_MS },
      },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
    });
    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      engine.setSource(image);
      engine.triggerReveal();
      ping(0.5, 0.5);
    };
    image.src = ctx.textureUrl;
    engine.start();
    return {
      engine,
      replay: () => ping(0.5, 0.5),
      destroy: () => {
        disposed = true;
        ctx.canvas.removeEventListener("pointerdown", onPointerDown);
        engine.dispose();
      },
    };
  },
};

export default definition;
