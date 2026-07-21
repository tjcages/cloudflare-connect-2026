import {
  compileProgram,
  createSeededRng,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type CustomRevealPass,
  type EngineHookContext,
} from "@necatikcl/stripes-engine";
import { EXPERIMENT_BASE_CONFIG } from "./preset";
import type { ExperimentDefinition } from "./types";
import { SHARD_SHATTER_REVEAL_FRAG } from "./shard-shatter.shaders";

const SHARDS = 14;
const RING_COUNTS = [4, 5, 5];
const RING_RADII = [0.17, 0.36, 0.68];
const DURATION_MS = 3000;
const FRONT_END = 0.32;
const FRONT_MAX = 1.35;
const FALL_START_MIN = 0.22;
const FALL_START_SPAN = 0.36;
const FALL_DURATION = 0.42;
const GRAVITY = 2.0;
const CENTROID_COLS = 44;
const CENTROID_ROWS = 28;

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
  id: "shard-shatter",
  title: "Shard Shatter",
  category: "reveal",
  blurb: "Fracture lines rip the stripe plate apart, then the shards tumble away and drop the image in place.",
  create: (ctx) => {
    const rng = createSeededRng(20260722);

    const sites = new Float32Array(SHARDS * 2);
    const centroids = new Float32Array(SHARDS * 2);
    const offsets = new Float32Array(SHARDS * 2);
    const rotations = new Float32Array(SHARDS * 2);
    const times = new Float32Array(SHARDS);
    const biases = new Float32Array(SHARDS);
    const velX = new Float32Array(SHARDS);
    const velY = new Float32Array(SHARDS);
    const spin = new Float32Array(SHARDS);
    const starts = new Float32Array(SHARDS);
    const impact = new Float32Array(2);
    const frame = { front: 0, impulse: 0 };

    const generate = () => {
      const w = Math.max(1, ctx.canvas.clientWidth);
      const h = Math.max(1, ctx.canvas.clientHeight);
      const aspect = h / w;
      impact[0] = 0.28 + 0.44 * rng();
      impact[1] = aspect * (0.26 + 0.48 * rng());

      let k = 0;
      for (let ring = 0; ring < RING_COUNTS.length; ring++) {
        const count = RING_COUNTS[ring] ?? 0;
        const radius = RING_RADII[ring] ?? 0.4;
        for (let i = 0; i < count; i++) {
          const angle = ((i + 0.5 * ring + (rng() - 0.5) * 0.6) / count) * Math.PI * 2;
          const r = radius * (0.72 + 0.56 * rng());
          sites[k * 2] = impact[0] + Math.cos(angle) * r;
          sites[k * 2 + 1] = impact[1] + Math.sin(angle) * r;
          k++;
        }
      }

      const sumX = new Float64Array(SHARDS);
      const sumY = new Float64Array(SHARDS);
      const hits = new Float64Array(SHARDS);
      for (let gy = 0; gy < CENTROID_ROWS; gy++) {
        const py = (aspect * (gy + 0.5)) / CENTROID_ROWS;
        for (let gx = 0; gx < CENTROID_COLS; gx++) {
          const px = (gx + 0.5) / CENTROID_COLS;
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let s = 0; s < SHARDS; s++) {
            const dx = px - sites[s * 2]!;
            const dy = py - sites[s * 2 + 1]!;
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
              bestDist = d;
              bestIdx = s;
            }
          }
          sumX[bestIdx] += px;
          sumY[bestIdx] += py;
          hits[bestIdx] += 1;
        }
      }

      let maxDist = 1e-4;
      for (let s = 0; s < SHARDS; s++) {
        const n = hits[s] ?? 0;
        const cx = n > 0 ? (sumX[s] ?? 0) / n : sites[s * 2]!;
        const cy = n > 0 ? (sumY[s] ?? 0) / n : sites[s * 2 + 1]!;
        centroids[s * 2] = cx;
        centroids[s * 2 + 1] = cy;
        maxDist = Math.max(maxDist, Math.hypot(cx - impact[0]!, cy - impact[1]!));
      }

      for (let s = 0; s < SHARDS; s++) {
        const cx = centroids[s * 2]!;
        const cy = centroids[s * 2 + 1]!;
        const dx = cx - impact[0]!;
        const dy = cy - impact[1]!;
        const len = Math.max(Math.hypot(dx, dy), 1e-4);
        const speed = 0.3 + 0.42 * rng();
        starts[s] = FALL_START_MIN + FALL_START_SPAN * Math.min(1, len / maxDist);
        velX[s] = (dx / len) * speed;
        velY[s] = (dy / len) * speed - 0.18 - 0.14 * rng();
        spin[s] = (rng() - 0.5) * 2.6;
        biases[s] = (rng() - 0.5) * 0.2;
      }
    };

    generate();

    const pack = (progress: number) => {
      const p = Math.max(0, progress);
      frame.front = standardEase(Math.min(1, p / FRONT_END)) * FRONT_MAX;
      frame.impulse = Math.exp(-p * 26);
      for (let s = 0; s < SHARDS; s++) {
        const t = (p - starts[s]!) / FALL_DURATION;
        times[s] = t;
        const cx = centroids[s * 2]!;
        const cy = centroids[s * 2 + 1]!;
        if (t <= 0) {
          offsets[s * 2] = cx;
          offsets[s * 2 + 1] = cy;
          rotations[s * 2] = 1;
          rotations[s * 2 + 1] = 0;
          continue;
        }
        const tc = Math.min(1, t);
        const angle = spin[s]! * tc;
        offsets[s * 2] = cx + velX[s]! * tc;
        offsets[s * 2 + 1] = cy + velY[s]! * tc + GRAVITY * tc * tc;
        rotations[s * 2] = Math.cos(angle);
        rotations[s * 2 + 1] = Math.sin(angle);
      }
    };

    const customReveal = ({ gl, quad }: EngineHookContext): CustomRevealPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, SHARD_SHATTER_REVEAL_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uAspect = gl.getUniformLocation(program, "uAspect");
      const uProgress = gl.getUniformLocation(program, "uProgress");
      const uFront = gl.getUniformLocation(program, "uFront");
      const uImpulse = gl.getUniformLocation(program, "uImpulse");
      const uImpact = gl.getUniformLocation(program, "uImpact");
      const uSite = gl.getUniformLocation(program, "uSite");
      const uCentroid = gl.getUniformLocation(program, "uCentroid");
      const uOffset = gl.getUniformLocation(program, "uOffset");
      const uRot = gl.getUniformLocation(program, "uRot");
      const uT = gl.getUniformLocation(program, "uT");
      const uBias = gl.getUniformLocation(program, "uBias");
      return {
        render(f) {
          const progress = Math.max(0, f.progress);
          pack(progress);
          gl.bindFramebuffer(gl.FRAMEBUFFER, f.revealed.fbo);
          gl.viewport(0, 0, f.revealed.width, f.revealed.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, f.field.texture);
          gl.uniform1i(uField, 0);
          gl.uniform1f(uAspect, f.cssH / Math.max(1, f.cssW));
          gl.uniform1f(uProgress, Math.min(1.2, progress));
          gl.uniform1f(uFront, frame.front);
          gl.uniform1f(uImpulse, frame.impulse);
          gl.uniform2fv(uImpact, impact);
          gl.uniform2fv(uSite, sites);
          gl.uniform2fv(uCentroid, centroids);
          gl.uniform2fv(uOffset, offsets);
          gl.uniform2fv(uRot, rotations);
          gl.uniform1fv(uT, times);
          gl.uniform1fv(uBias, biases);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { customReveal } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      reveal: {
        ...DEFAULT_ENGINE_CONFIG.reveal,
        enabled: true,
        type: "custom",
        wave: { ...DEFAULT_ENGINE_CONFIG.reveal.wave, durationMs: DURATION_MS },
      },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
    });

    const replay = () => {
      generate();
      engine.triggerReveal();
    };

    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      engine.setSource(image);
      replay();
    };
    image.src = ctx.textureUrl;
    engine.start();

    return {
      engine,
      replay,
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
