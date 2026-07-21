import { createSeededRng } from "@necatikcl/stripes-engine";

export const EMBER_PACK_FLOATS = 4;
export const EMBER_PACK_STRIDE_BYTES = EMBER_PACK_FLOATS * 4;

const MAX_EMBERS = 210;
const STRIDE = 7;
const SPEED_MIN = 34;
const SPEED_RANGE = 760;
const MAX_RATE = 92;
const BASE_RATE_FRACTION = 0.12;
const LIFE_MIN = 560;
const LIFE_RANGE = 840;
const DRIFT_MIN = 26;
const DRIFT_RANGE = 30;
const DRIFT_SPREAD = 0.85;
const GOLDEN = 0.618033988749895;

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
  let lifePhase = rng();

  const spawn = (x0: number, y0: number, x1: number, y1: number, vx: number, vy: number, speed: number) => {
    if (count >= MAX_EMBERS) return;
    const o = count * STRIDE;
    count += 1;
    const along = rng();
    const back = speed > 8 ? Math.atan2(-vy, -vx) : rng() * Math.PI * 2;
    const ang = back + (rng() - 0.5) * 2 * DRIFT_SPREAD;
    const drift = DRIFT_MIN + rng() * DRIFT_RANGE;
    lifePhase = (lifePhase + GOLDEN) % 1;
    const stagger = (lifePhase + rng() * 0.14) % 1;
    state[o] = x0 + (x1 - x0) * along + (rng() - 0.5) * 10;
    state[o + 1] = y0 + (y1 - y0) * along + (rng() - 0.5) * 10;
    state[o + 2] = Math.cos(ang) * drift;
    state[o + 3] = Math.sin(ang) * drift;
    state[o + 4] = 0;
    state[o + 5] = LIFE_MIN + stagger * LIFE_RANGE;
    state[o + 6] = 2.9 + rng() * 4.3;
  };

  return {
    emit(x0, y0, x1, y1, vx, vy, speed, dt) {
      const drive = Math.min(1, Math.max(0, (speed - SPEED_MIN) / SPEED_RANGE));
      if (drive <= 0) {
        accum = Math.min(accum, 0.4);
        return;
      }
      accum += (BASE_RATE_FRACTION + (1 - BASE_RATE_FRACTION) * drive) * MAX_RATE * dt;
      while (accum >= 1) {
        accum -= 1;
        spawn(x0, y0, x1, y1, vx, vy, speed);
      }
    },
    step(dtMs) {
      const dt = dtMs / 1000;
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
        state[o] += state[o + 2] * dt;
        state[o + 1] += state[o + 3] * dt;
        i += 1;
      }
    },
    pack() {
      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        const p = i * EMBER_PACK_FLOATS;
        packed[p] = state[o];
        packed[p + 1] = state[o + 1];
        packed[p + 2] = state[o + 6];
        packed[p + 3] = state[o + 4] / state[o + 5];
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
  { t0: 0, t1: 0.95, from: [0.12, 0.74], via: [0.32, 0.2], to: [0.5, 0.44] },
  { t0: 1.05, t1: 1.26, from: [0.5, 0.44], to: [0.9, 0.68] },
  { t0: 1.4, t1: 1.6, from: [0.9, 0.68], to: [0.14, 0.5] },
  { t0: 1.74, t1: 2.08, from: [0.14, 0.5], via: [0.46, 0.9], to: [0.78, 0.32] },
];

export const REPLAY_DURATION_S = 2.7;

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
