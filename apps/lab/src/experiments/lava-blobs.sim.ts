import { createSeededRng } from "@necatikcl/stripes-engine";

export const MAX_BLOBS = 12;

const BASE_BLOBS = 7;
const MAX_DT_SEC = 0.05;
const BUOYANCY_TAU_SEC = 2.4;
const WOBBLE_TAU_SEC = 1.3;
const DISSOLVE_SPAN = 0.16;
const EDGE_MARGIN = 0.1;
const EDGE_PUSH = 0.5;
const ATTRACT = 0.06;
const COUPLE = 1.2;
const MELT_SINK = 0.06;

type LavaBlob = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  riseSpeed: number;
  wobbleAmp: number;
  wobbleFreq: number;
  wobblePhase: number;
  breatheFreq: number;
  breathePhase: number;
  dissolveStart: number;
  extra: boolean;
};

export type LavaBlobsSim = {
  step: (nowMs: number, aspect: number) => void;
  writeBlobs: (target: Float32Array) => number;
  pulse: () => void;
};

const smooth01 = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

export function createLavaBlobsSim(seed: number): LavaBlobsSim {
  const rng = createSeededRng(seed);
  const blobs: LavaBlob[] = [];
  let lastMs = -1;
  let simTime = 0;

  const rollShape = (blob: LavaBlob, heated: boolean) => {
    const size = rng();
    blob.baseRadius = 0.07 + size * 0.075;
    blob.riseSpeed = (0.062 - size * 0.028) * (0.9 + rng() * 0.2) * (heated ? 1.55 : 1);
    blob.wobbleAmp = 0.02 + rng() * 0.045;
    blob.wobbleFreq = 0.25 + rng() * 0.3;
    blob.wobblePhase = rng() * Math.PI * 2;
    blob.breatheFreq = 0.3 + rng() * 0.4;
    blob.breathePhase = rng() * Math.PI * 2;
    blob.dissolveStart = 0.64 + rng() * 0.16;
  };

  const makeBlob = (extra: boolean): LavaBlob => {
    const blob: LavaBlob = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      baseRadius: 0,
      riseSpeed: 0,
      wobbleAmp: 0,
      wobbleFreq: 0,
      wobblePhase: 0,
      breatheFreq: 0,
      breathePhase: 0,
      dissolveStart: 0,
      extra,
    };
    rollShape(blob, extra);
    blob.x = 0.15 + rng() * 0.7;
    blob.y = -(blob.baseRadius * 1.6 + rng() * 0.12);
    blob.vy = blob.riseSpeed * 0.5;
    return blob;
  };

  const respawn = (blob: LavaBlob) => {
    rollShape(blob, false);
    blob.x = 0.15 + rng() * 0.7;
    blob.y = -(blob.baseRadius * 1.6 + rng() * 0.12);
    blob.vx = 0;
    blob.vy = blob.riseSpeed * 0.5;
  };

  for (let i = 0; i < BASE_BLOBS; i++) {
    const blob = makeBlob(false);
    blob.x = 0.08 + ((i + 0.5) / BASE_BLOBS) * 0.84 + (rng() - 0.5) * 0.08;
    blob.y = -0.16 + (((i * 3 + 1) % BASE_BLOBS) / (BASE_BLOBS - 1)) * 0.82 + (rng() - 0.5) * 0.08;
    blob.vy = blob.riseSpeed;
    blobs.push(blob);
  }

  return {
    step(nowMs, aspect) {
      if (lastMs < 0) lastMs = nowMs;
      const dt = Math.min(MAX_DT_SEC, Math.max(0, (nowMs - lastMs) / 1000));
      lastMs = nowMs;
      if (dt <= 0) return;
      simTime += dt;
      const safeAspect = Math.max(0.2, aspect);
      const buoyancyBlend = 1 - Math.exp(-dt / BUOYANCY_TAU_SEC);
      const wobbleBlend = 1 - Math.exp(-dt / WOBBLE_TAU_SEC);

      for (const blob of blobs) {
        const melt = smooth01((blob.y - blob.dissolveStart) / DISSOLVE_SPAN);
        const targetVy = blob.riseSpeed * (1 - 0.62 * melt);
        blob.vy += (targetVy - blob.vy) * buoyancyBlend;
        let targetVx = blob.wobbleAmp * blob.wobbleFreq * Math.cos(simTime * blob.wobbleFreq + blob.wobblePhase);
        if (blob.x < EDGE_MARGIN) targetVx += (EDGE_MARGIN - blob.x) * EDGE_PUSH;
        if (blob.x > 1 - EDGE_MARGIN) targetVx -= (blob.x - (1 - EDGE_MARGIN)) * EDGE_PUSH;
        blob.vx += (targetVx - blob.vx) * wobbleBlend;
      }

      for (let i = 0; i < blobs.length; i++) {
        for (let j = i + 1; j < blobs.length; j++) {
          const a = blobs[i];
          const b = blobs[j];
          const dx = (b.x - a.x) * safeAspect;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const reach = (a.baseRadius + b.baseRadius) * 1.45;
          if (dist >= reach || dist < 1e-4) continue;
          const overlap = 1 - dist / reach;
          const pull = overlap * overlap * ATTRACT * dt;
          const nx = dx / dist;
          a.vx += nx * pull;
          b.vx -= nx * pull;
          const settle = Math.min(0.5, overlap * COUPLE * dt);
          const dvy = b.vy - a.vy;
          a.vy += dvy * settle;
          b.vy -= dvy * settle;
        }
      }

      for (let i = blobs.length - 1; i >= 0; i--) {
        const blob = blobs[i];
        blob.x += (blob.vx / safeAspect) * dt;
        blob.y += blob.vy * dt;
        if (blob.y >= blob.dissolveStart + DISSOLVE_SPAN) {
          if (blob.extra) blobs.splice(i, 1);
          else respawn(blob);
        }
      }
    },
    writeBlobs(target) {
      let count = 0;
      for (const blob of blobs) {
        if (count >= MAX_BLOBS) break;
        const melt = smooth01((blob.y - blob.dissolveStart) / DISSOLVE_SPAN);
        const strength = 1 - melt;
        const breathe = 1 + 0.07 * Math.sin(simTime * blob.breatheFreq + blob.breathePhase);
        const o = count * 4;
        target[o] = blob.x;
        target[o + 1] = blob.y;
        target[o + 2] = blob.baseRadius * breathe * strength - melt * MELT_SINK;
        target[o + 3] = strength;
        count += 1;
      }
      return count;
    },
    pulse() {
      for (let i = 0; i < 2 && blobs.length < MAX_BLOBS; i++) {
        const blob = makeBlob(true);
        blob.x = 0.28 + rng() * 0.44;
        blob.y = -(blob.baseRadius * (1.3 + i * 1.6));
        blob.vy = blob.riseSpeed;
        blobs.push(blob);
      }
    },
  };
}
