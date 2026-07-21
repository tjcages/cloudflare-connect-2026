import { createSeededRng } from "@necatikcl/stripes-engine";

export const EMBER_PACK_FLOATS = 5;
export const EMBER_PACK_STRIDE_BYTES = EMBER_PACK_FLOATS * 4;

const MAX_EMBERS = 160;
const STRIDE = 8;
const BASE_RATE = 6.4;
const REFERENCE_WIDTH = 880;
const LIFE_MIN = 5200;
const LIFE_RANGE = 4400;
const RISE_MIN = 15;
const RISE_RANGE = 19;
const GOLDEN = 0.618033988749895;

function smoothstep01(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
}

export type EmberPack = { data: Float32Array; count: number };

export type EmberDriftSim = {
  setUpdraft: (value: number) => void;
  step: (dtMs: number, cssW: number, cssH: number) => void;
  pack: () => EmberPack;
};

export function createEmberDriftSim(seed: number): EmberDriftSim {
  const rng = createSeededRng(seed);
  const state = new Float32Array(MAX_EMBERS * STRIDE);
  const packed = new Float32Array(MAX_EMBERS * EMBER_PACK_FLOATS);
  let count = 0;
  let accum = 0;
  let lifePhase = rng();
  let updraft = 0;
  let primed = false;

  const spawn = (cssW: number, cssH: number, preAgeMs: number) => {
    if (count >= MAX_EMBERS) return;
    const o = count * STRIDE;
    count += 1;
    lifePhase = (lifePhase + GOLDEN) % 1;
    const stagger = (lifePhase + rng() * 0.16) % 1;
    const life = LIFE_MIN + stagger * LIFE_RANGE;
    const rise = -(RISE_MIN + rng() * RISE_RANGE);
    const drift = (rng() - 0.5) * 11;
    const age = Math.min(preAgeMs, life * 0.94);
    const x = rng() * cssW;
    const y = cssH * (0.66 + rng() * 0.42);
    state[o] = x + (drift * age) / 1000;
    state[o + 1] = y + (rise * age) / 1000;
    state[o + 2] = drift;
    state[o + 3] = rise;
    state[o + 4] = age;
    state[o + 5] = life;
    state[o + 6] = 5.4 + rng() * 6.6;
    state[o + 7] = rng();
  };

  return {
    setUpdraft(value) {
      updraft = value < 0 ? 0 : value > 1 ? 1 : value;
    },
    step(dtMs, cssW, cssH) {
      if (cssW < 2 || cssH < 2) return;
      const dt = dtMs / 1000;
      const widthScale = Math.min(1.7, Math.max(0.4, cssW / REFERENCE_WIDTH));

      if (!primed) {
        primed = true;
        const seedCount = Math.round(BASE_RATE * widthScale * ((LIFE_MIN + LIFE_RANGE * 0.5) / 1000));
        for (let i = 0; i < seedCount; i++) spawn(cssW, cssH, rng() * (LIFE_MIN + LIFE_RANGE));
      }

      accum += BASE_RATE * widthScale * (1 + updraft * 0.85) * dt;
      while (accum >= 1) {
        accum -= 1;
        spawn(cssW, cssH, 0);
      }

      const riseGain = 1 + updraft * 0.62;
      let i = 0;
      while (i < count) {
        const o = i * STRIDE;
        const age = state[o + 4] + dtMs;
        const emberSeed = state[o + 7];
        if (age >= state[o + 5] || state[o + 1] < -40 || state[o] < -60 || state[o] > cssW + 60) {
          count -= 1;
          const last = count * STRIDE;
          if (last !== o) state.copyWithin(o, last, last + STRIDE);
          continue;
        }
        state[o + 4] = age;
        const sway = Math.sin(age * 0.00098 * (0.62 + emberSeed) + emberSeed * 37.3) * 12.5;
        const turb = Math.sin(age * 0.00042 + emberSeed * 61.1) * 5.4;
        state[o] += (state[o + 2] + sway + turb) * dt;
        state[o + 1] += state[o + 3] * riseGain * dt;
        i += 1;
      }
    },
    pack() {
      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        const p = i * EMBER_PACK_FLOATS;
        const t = state[o + 4] / state[o + 5];
        const birth = 0.62 + 0.38 * smoothstep01(t / 0.2);
        const cool = 1 - 0.3 * t * t;
        packed[p] = state[o];
        packed[p + 1] = state[o + 1];
        packed[p + 2] = state[o + 6] * birth * cool;
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

const UPDRAFT_RISE_S = 1.1;
const UPDRAFT_HOLD_S = 0.7;
const UPDRAFT_FALL_S = 2.1;

export const REPLAY_DURATION_S = UPDRAFT_RISE_S + UPDRAFT_HOLD_S + UPDRAFT_FALL_S;

export function updraftAt(t: number): number {
  if (t <= 0) return 0;
  if (t < UPDRAFT_RISE_S) return STANDARD_EASE(t / UPDRAFT_RISE_S);
  if (t < UPDRAFT_RISE_S + UPDRAFT_HOLD_S) return 1;
  const fall = (t - UPDRAFT_RISE_S - UPDRAFT_HOLD_S) / UPDRAFT_FALL_S;
  if (fall >= 1) return 0;
  return 1 - STANDARD_EASE(fall);
}
