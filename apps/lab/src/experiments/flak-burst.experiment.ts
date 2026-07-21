import {
  compileProgram,
  createSeededRng,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
  type PostHookPass,
} from "@necatikcl/stripes-engine";
import { EXPERIMENT_BASE_CONFIG } from "./preset";
import type { ExperimentDefinition } from "./types";
import { FLAK_FIELD_FRAG, FLAK_POST_FRAG } from "./flak-burst.shaders";

const MAX_VOLLEYS = 3;
const MAX_BURSTS = 21;
const MIN_SUBS = 5;
const MAX_SUBS = 7;
const BURST_LIFE_MS = 1500;
const STAGGER_MS = 400;
const FLASH_MS = 60;
const INTRO_DELAY_MS = 650;
const TAU = Math.PI * 2;

interface SubBurst {
  x: number;
  y: number;
  delayMs: number;
  scale: number;
  seed: number;
}

interface Volley {
  subs: SubBurst[];
  lifeMs: number;
  startMs: number | null;
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
  id: "flak-burst",
  title: "Flak Burst",
  category: "click",
  blurb: "A click airbursts into five to seven small pops scattered around it, crackling apart over 400ms.",
  pointer: "custom",
  create: (ctx) => {
    const rng = createSeededRng(20260722);
    const volleys: Volley[] = [];
    const packed = {
      count: 0,
      centers: new Float32Array(MAX_BURSTS * 2),
      ages: new Float32Array(MAX_BURSTS),
      seeds: new Float32Array(MAX_BURSTS),
      scales: new Float32Array(MAX_BURSTS),
      flashes: new Float32Array(MAX_BURSTS),
    };

    const packBursts = (now: number) => {
      let write = 0;
      for (const volley of volleys) {
        if (volley.startMs === null) volley.startMs = now;
        if (now - volley.startMs <= volley.lifeMs) volleys[write++] = volley;
      }
      volleys.length = write;

      let count = 0;
      for (const volley of volleys) {
        const start = volley.startMs ?? now;
        for (const sub of volley.subs) {
          if (count >= MAX_BURSTS) break;
          const age = now - start - sub.delayMs;
          if (age < 0 || age > BURST_LIFE_MS) continue;
          packed.centers[count * 2] = sub.x;
          packed.centers[count * 2 + 1] = sub.y;
          packed.ages[count] = age / 1000;
          packed.seeds[count] = sub.seed;
          packed.scales[count] = sub.scale;
          packed.flashes[count] = standardEase(Math.min(1, age / FLASH_MS));
          count++;
        }
      }
      packed.count = count;
    };

    const spawn = (x: number, y: number) => {
      const w = Math.max(1, ctx.canvas.clientWidth);
      const h = Math.max(1, ctx.canvas.clientHeight);
      const sc = Math.min(2.5, Math.max(0.5, Math.min(w, h) / 300));
      const subCount = MIN_SUBS + Math.floor(rng() * (MAX_SUBS - MIN_SUBS + 1));
      const arcBase = rng() * TAU;
      const arcSpan = 1.9 + rng() * 1.5;
      const spread = (42 + 30 * rng()) * sc;
      const seedBase = 1 + rng() * 96;

      const delays: number[] = [];
      for (let j = 0; j < subCount; j++) delays.push(rng() * STAGGER_MS);
      delays.sort((a, b) => a - b);
      delays[0] = 0;

      const subs: SubBurst[] = [];
      for (let j = 0; j < subCount; j++) {
        const f = subCount > 1 ? j / (subCount - 1) : 0.5;
        const ang = arcBase + arcSpan * (f - 0.5) + (rng() - 0.5) * 0.55;
        const rad = spread * (0.6 + 0.85 * rng());
        subs.push({
          x: Math.min(w * 0.95, Math.max(w * 0.05, x + Math.cos(ang) * rad)),
          y: Math.min(h * 0.95, Math.max(h * 0.05, y + Math.sin(ang) * rad)),
          delayMs: delays[j] ?? 0,
          scale: 0.25 + 0.15 * rng(),
          seed: seedBase + j * 7.3 + rng() * 2.6,
        });
      }

      if (volleys.length >= MAX_VOLLEYS) volleys.shift();
      volleys.push({ subs, lifeMs: (delays[subCount - 1] ?? 0) + BURST_LIFE_MS, startMs: null });
    };

    const onDown = (e: PointerEvent) => {
      const rect = ctx.canvas.getBoundingClientRect();
      const sx = ctx.canvas.clientWidth / Math.max(1, rect.width);
      const sy = ctx.canvas.clientHeight / Math.max(1, rect.height);
      spawn((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
    };
    ctx.canvas.addEventListener("pointerdown", onDown);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, FLAK_FIELD_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uBurstCount = gl.getUniformLocation(program, "uBurstCount");
      const uBurstCenter = gl.getUniformLocation(program, "uBurstCenter");
      const uBurstAge = gl.getUniformLocation(program, "uBurstAge");
      const uBurstSeed = gl.getUniformLocation(program, "uBurstSeed");
      const uBurstScale = gl.getUniformLocation(program, "uBurstScale");
      const uBurstFlash = gl.getUniformLocation(program, "uBurstFlash");
      return {
        render(frame) {
          packBursts(frame.now);
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1i(uBurstCount, packed.count);
          gl.uniform2fv(uBurstCenter, packed.centers);
          gl.uniform1fv(uBurstAge, packed.ages);
          gl.uniform1fv(uBurstSeed, packed.seeds);
          gl.uniform1fv(uBurstScale, packed.scales);
          gl.uniform1fv(uBurstFlash, packed.flashes);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const postPass = ({ gl, quad }: EngineHookContext): PostHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, FLAK_POST_FRAG);
      const uSrc = gl.getUniformLocation(program, "uSrc");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uBurstCount = gl.getUniformLocation(program, "uBurstCount");
      const uBurstCenter = gl.getUniformLocation(program, "uBurstCenter");
      const uBurstAge = gl.getUniformLocation(program, "uBurstAge");
      const uBurstSeed = gl.getUniformLocation(program, "uBurstSeed");
      const uBurstScale = gl.getUniformLocation(program, "uBurstScale");
      return {
        render(src, dst, frame) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
          gl.viewport(0, 0, dst ? dst.width : frame.outputWidth, dst ? dst.height : frame.outputHeight);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, src);
          gl.uniform1i(uSrc, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1i(uBurstCount, packed.count);
          gl.uniform2fv(uBurstCenter, packed.centers);
          gl.uniform1fv(uBurstAge, packed.ages);
          gl.uniform1fv(uBurstSeed, packed.seeds);
          gl.uniform1fv(uBurstScale, packed.scales);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass, postPass } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
    });

    const replay = () => {
      const w = Math.max(1, ctx.canvas.clientWidth);
      const h = Math.max(1, ctx.canvas.clientHeight);
      spawn(w * (0.26 + 0.48 * rng()), h * (0.3 + 0.4 * rng()));
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
        ctx.canvas.removeEventListener("pointerdown", onDown);
        engine.dispose();
      },
    };
  },
};

export default definition;
