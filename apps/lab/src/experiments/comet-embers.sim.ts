import { createSeededRng } from "@necatikcl/stripes-engine";

export const EMBER_PACK_FLOATS = 5;
export const EMBER_PACK_STRIDE_BYTES = EMBER_PACK_FLOATS * 4;

const MAX_EMBERS = 320;
const STRIDE = 8;
const GRAVITY = 260;
const DRAG = 3.1;
const SPEED_MIN = 330;
const SPEED_RANGE = 1500;
const MAX_RATE = 210;

export type EmberPack = { data: Float32Array; count: number };

export type EmberSim = {
  emit: (x0: number, y0: number, x1: number, y1: number, vx: number, vy: number, speed: number, dt: number) => void;
  step: (dtMs: number) => void;
  pack: () => EmberPack;
};

export function createEmberSim(seed: number): EmberSim {
  const rng = createSeededRng(seed);
  const state = new Float32Array(MAX_EMBERS * STRIDE);
  const packed = new Float32Array(MAX_EMBERS * EMBER_PACK_FLOATS);
  let count = 0;
  let accum = 0;

  const spawn = (x0: number, y0: number, x1: number, y1: number, vx: number, vy: number, speed: number) => {
    if (count >= MAX_EMBERS) return;
    const o = count * STRIDE;
    count += 1;
    const along = rng();
    const ang = rng() * Math.PI * 2;
    const kick = speed * (0.05 + rng() * 0.22);
    const keep = 0.06 + rng() * 0.26;
    state[o] = x0 + (x1 - x0) * along + (rng() - 0.5) * 6;
    state[o + 1] = y0 + (y1 - y0) * along + (rng() - 0.5) * 6;
    state[o + 2] = vx * keep + Math.cos(ang) * kick;
    state[o + 3] = vy * keep + Math.sin(ang) * kick - 30 - rng() * 70;
    state[o + 4] = 0;
    state[o + 5] = 560 + rng() * 860;
    state[o + 6] = 1.7 + rng() * 2.3;
    state[o + 7] = rng();
  };

  return {
    emit(x0, y0, x1, y1, vx, vy, speed, dt) {
      const drive = Math.min(1, Math.max(0, (speed - SPEED_MIN) / SPEED_RANGE));
      if (drive <= 0) {
        accum = Math.min(accum, 0.4);
        return;
      }
      accum += Math.pow(drive, 1.35) * MAX_RATE * dt;
      while (accum >= 1) {
        accum -= 1;
        spawn(x0, y0, x1, y1, vx, vy, speed);
      }
    },
    step(dtMs) {
      const dt = dtMs / 1000;
      const dragK = Math.exp(-DRAG * dt);
      let i = 0;
      while (i < count) {
        const o = i * STRIDE;
        const age = state[o + 4] + dtMs;
        if (age >= state[o + 5]) {
          count -= 1;
          const last = count * STRIDE;
          if (last !== o) state.copyWithin(o, last, last + STRIDE);
          continue;
        }
        state[o + 4] = age;
        let vx = state[o + 2];
        let vy = state[o + 3] + GRAVITY * dt;
        vx *= dragK;
        vy *= dragK;
        const emberSeed = state[o + 7];
        const sway = Math.sin(age * 0.005 * (0.7 + emberSeed) + emberSeed * 43.7) * 24 * dt;
        state[o] += vx * dt + sway;
        state[o + 1] += vy * dt;
        state[o + 2] = vx;
        state[o + 3] = vy;
        i += 1;
      }
    },
    pack() {
      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        const p = i * EMBER_PACK_FLOATS;
        const t = state[o + 4] / state[o + 5];
        packed[p] = state[o];
        packed[p + 1] = state[o + 1];
        packed[p + 2] = state[o + 6] * (1 - t * 0.45);
        packed[p + 3] = t;
        packed[p + 4] = state[o + 7];
      }
      return { data: packed, count };
    },
  };
}

function cubicBezierEase(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const sampleX = (u: number) => 3 * u * (1 - u) * (1 - u) * x1 + 3 * u * u * (1 - u) * x2 + u * u * u;
  const sampleY = (u: number) => 3 * u * (1 - u) * (1 - u) * y1 + 3 * u * u * (1 - u) * y2 + u * u * u;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let u = x;
    for (let i = 0; i < 26; i++) {
      const cx = sampleX(u);
      if (Math.abs(cx - x) < 0.0002) break;
      if (cx < x) lo = u;
      else hi = u;
      u = (lo + hi) * 0.5;
    }
    return sampleY(u);
  };
}

const STANDARD_EASE = cubicBezierEase(0.6, 0.6, 0, 1);

type ReplayPhase = {
  t0: number;
  t1: number;
  from: readonly [number, number];
  to: readonly [number, number];
  via?: readonly [number, number];
};

const REPLAY_PHASES: readonly ReplayPhase[] = [
  { t0: 0, t1: 1.0, from: [0.14, 0.72], via: [0.3, 0.28], to: [0.52, 0.42] },
  { t0: 1.12, t1: 1.3, from: [0.52, 0.42], to: [0.86, 0.64] },
  { t0: 1.46, t1: 1.64, from: [0.86, 0.64], to: [0.22, 0.5] },
];

export const REPLAY_DURATION_S = 2.1;

export function replayPoint(t: number): { x: number; y: number } {
  let held: readonly [number, number] = REPLAY_PHASES[0].from;
  for (const phase of REPLAY_PHASES) {
    if (t < phase.t0) break;
    if (t >= phase.t1) {
      held = phase.to;
      continue;
    }
    const u = STANDARD_EASE((t - phase.t0) / (phase.t1 - phase.t0));
    const { from, to, via } = phase;
    if (via) {
      const inv = 1 - u;
      return {
        x: inv * inv * from[0] + 2 * u * inv * via[0] + u * u * to[0],
        y: inv * inv * from[1] + 2 * u * inv * via[1] + u * u * to[1],
      };
    }
    return { x: from[0] + (to[0] - from[0]) * u, y: from[1] + (to[1] - from[1]) * u };
  }
  return { x: held[0], y: held[1] };
}
