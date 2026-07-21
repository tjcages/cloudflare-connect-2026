import {
  compileProgram,
  createSeededRng,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
} from "@necatikcl/stripes-engine";
import { EXPERIMENT_BASE_CONFIG } from "./preset";
import type { ExperimentDefinition } from "./types";
import { SUPERNOVA_FIELD_FRAG } from "./supernova-pulse.shaders";

const MAX_EVENTS = 3;
const REMNANT_MS = 2800;
const FLASH_MS = 95;
const AMBIENT_PREFLARE_MS = 700;
const REPLAY_PREFLARE_MS = 220;
const INTRO_DELAY_MS = 900;
const SPAWN_MIN_MS = 3000;
const SPAWN_RANGE_MS = 4000;

interface Burst {
  x: number;
  y: number;
  seed: number;
  preflareMs: number;
  detonateAtMs: number;
}

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
  id: "supernova-pulse",
  title: "Supernova Pulse",
  category: "stars",
  blurb: "A dense starfield where a star detonates every few seconds, its shock ring warping the stripes as it sweeps.",
  create: (ctx) => {
    const rng = createSeededRng(20260722);
    const bursts: Burst[] = [];
    const packed = {
      count: 0,
      centers: new Float32Array(MAX_EVENTS * 2),
      ages: new Float32Array(MAX_EVENTS),
      seeds: new Float32Array(MAX_EVENTS),
      pres: new Float32Array(MAX_EVENTS),
      flashes: new Float32Array(MAX_EVENTS),
    };

    let nextSpawnMs: number | null = null;
    let pendingReplay = false;

    const spawn = (x: number, y: number, preflareMs: number, now: number) => {
      if (bursts.length >= MAX_EVENTS) bursts.shift();
      bursts.push({ x, y, seed: 1 + rng() * 96, preflareMs, detonateAtMs: now + preflareMs });
    };

    const spawnAmbient = (now: number) => {
      const w = Math.max(1, ctx.canvas.clientWidth);
      const h = Math.max(1, ctx.canvas.clientHeight);
      spawn(w * (0.16 + 0.68 * rng()), h * (0.18 + 0.64 * rng()), AMBIENT_PREFLARE_MS, now);
    };

    const spawnCentral = (now: number) => {
      const w = Math.max(1, ctx.canvas.clientWidth);
      const h = Math.max(1, ctx.canvas.clientHeight);
      spawn(w * (0.42 + 0.16 * rng()), h * (0.42 + 0.16 * rng()), REPLAY_PREFLARE_MS, now);
    };

    const stepBursts = (now: number) => {
      if (nextSpawnMs === null) nextSpawnMs = now + INTRO_DELAY_MS;
      if (pendingReplay) {
        pendingReplay = false;
        spawnCentral(now);
        nextSpawnMs = now + SPAWN_MIN_MS + rng() * SPAWN_RANGE_MS;
      }
      if (now >= nextSpawnMs) {
        spawnAmbient(now);
        nextSpawnMs = now + SPAWN_MIN_MS + rng() * SPAWN_RANGE_MS;
      }

      let write = 0;
      for (const burst of bursts) {
        if (now - burst.detonateAtMs <= REMNANT_MS) bursts[write++] = burst;
      }
      bursts.length = write;

      let count = 0;
      for (const burst of bursts) {
        if (count >= MAX_EVENTS) break;
        const age = now - burst.detonateAtMs;
        packed.centers[count * 2] = burst.x;
        packed.centers[count * 2 + 1] = burst.y;
        packed.ages[count] = age / 1000;
        packed.seeds[count] = burst.seed;
        packed.pres[count] = burst.preflareMs / 1000;
        packed.flashes[count] = standardEase(Math.min(1, Math.max(0, age) / FLASH_MS));
        count++;
      }
      packed.count = count;
    };

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, SUPERNOVA_FIELD_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uEvCount = gl.getUniformLocation(program, "uEvCount");
      const uEvCenter = gl.getUniformLocation(program, "uEvCenter");
      const uEvAge = gl.getUniformLocation(program, "uEvAge");
      const uEvSeed = gl.getUniformLocation(program, "uEvSeed");
      const uEvPre = gl.getUniformLocation(program, "uEvPre");
      const uEvFlash = gl.getUniformLocation(program, "uEvFlash");
      return {
        render(frame) {
          stepBursts(frame.now);
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1f(uTime, frame.elapsed / 1000);
          gl.uniform1i(uEvCount, packed.count);
          gl.uniform2fv(uEvCenter, packed.centers);
          gl.uniform1fv(uEvAge, packed.ages);
          gl.uniform1fv(uEvSeed, packed.seeds);
          gl.uniform1fv(uEvPre, packed.pres);
          gl.uniform1fv(uEvFlash, packed.flashes);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
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
        pendingReplay = true;
      },
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
