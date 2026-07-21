import type { DetonationClickConfig } from "../config/types";
import { createSeededRng } from "../core/rng";

const DETONATION_SEED_XOR = 0x6465746f;
const SEED_SPAN = 96;
const FLASH_BEZIER_STEPS = 22;

export type DetonationCaps = { maxConcurrent: number; debrisCount: number };

export type Detonation = {
  x: number;
  y: number;
  seed: number;
  bornAtSec: number;
};

export type DetonationState = {
  caps: DetonationCaps;
  random: () => number;
  detonations: Detonation[];
  count: number;
  spawnCount: number;
  centerData: Float32Array;
  lifeData: Float32Array;
};

export function detonationCaps(config: DetonationClickConfig): DetonationCaps {
  return {
    maxConcurrent: Math.max(1, Math.round(config.maxConcurrent)),
    debrisCount: Math.max(0, Math.round(config.debrisCount)),
  };
}

export function createDetonationState(caps: DetonationCaps, seed: number): DetonationState {
  return {
    caps,
    random: createSeededRng((seed ^ DETONATION_SEED_XOR) >>> 0),
    detonations: [],
    count: 0,
    spawnCount: 0,
    centerData: new Float32Array(caps.maxConcurrent * 2),
    lifeData: new Float32Array(caps.maxConcurrent * 4),
  };
}

export function detonationEventSeconds(config: DetonationClickConfig): number {
  const debris = (config.debrisLifetimeMs / 1000) * (1 + config.debrisLifetimeVariation);
  const ring = config.ringDurationMs / 1000;
  const crater = config.craterLifeMs / 1000;
  return Math.max(debris, ring, crater);
}

function bezierX(u: number): number {
  return 3 * u * (1 - u) * (1 - u) * 0.6 + u * u * u;
}

function bezierY(u: number): number {
  return 3 * u * (1 - u) * (1 - u) * 0.6 + 3 * u * u * (1 - u) + u * u * u;
}

export function detonationFlashEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let low = 0;
  let high = 1;
  let mid = t;
  for (let i = 0; i < FLASH_BEZIER_STEPS; i++) {
    mid = (low + high) * 0.5;
    if (bezierX(mid) < t) low = mid;
    else high = mid;
  }
  return bezierY(mid);
}

export function addDetonation(
  state: DetonationState,
  config: DetonationClickConfig,
  x: number,
  y: number,
  timeSec: number,
): void {
  const limit = Math.max(1, Math.min(state.caps.maxConcurrent, Math.round(config.maxConcurrent)));
  if (state.detonations.length >= limit) state.detonations.splice(0, state.detonations.length - limit + 1);
  state.detonations.push({ x, y, seed: 1 + state.random() * SEED_SPAN, bornAtSec: timeSec });
  state.spawnCount++;
}

export function stepDetonation(state: DetonationState, config: DetonationClickConfig, timeSec: number): void {
  const eventSec = detonationEventSeconds(config);
  for (let index = state.detonations.length - 1; index >= 0; index--) {
    if (timeSec - state.detonations[index].bornAtSec > eventSec) state.detonations.splice(index, 1);
  }

  const flashSec = config.flashDurationMs / 1000;
  state.centerData.fill(0);
  state.lifeData.fill(0);
  let count = 0;
  for (const detonation of state.detonations) {
    if (count >= state.caps.maxConcurrent) break;
    const age = Math.max(0, timeSec - detonation.bornAtSec);
    state.centerData[count * 2] = detonation.x;
    state.centerData[count * 2 + 1] = detonation.y;
    const offset = count * 4;
    state.lifeData[offset] = age;
    state.lifeData[offset + 1] = detonation.seed;
    state.lifeData[offset + 2] = detonationFlashEase(flashSec > 0 ? Math.min(1, age / flashSec) : 1);
    state.lifeData[offset + 3] = 1;
    count++;
  }
  state.count = count;
}

export function detonationScale(cssW: number, cssH: number): number {
  const raw = Math.min(Math.max(1, cssW), Math.max(1, cssH)) / 300;
  return raw < 0.5 ? 0.5 : raw > 2.5 ? 2.5 : raw;
}

export function detonationHash(value: number): number {
  let p = value * 0.1031;
  p -= Math.floor(p);
  p *= p + 33.33;
  p *= p + p;
  return p - Math.floor(p);
}

export function detonationRingReachPx(config: DetonationClickConfig, scale = 1): number {
  return config.ringReachPx * scale;
}

export function debrisReachPx(config: DetonationClickConfig, seed: number, index: number, scale = 1): number {
  const speedHash = detonationHash(seed + index * 3.71 + 11.7);
  const lifeHash = detonationHash(seed + index * 5.39 + 29.3);
  const dragHash = detonationHash(seed + index * 9.02 + 47.9);
  const speed = config.debrisSpeedPxPerSec * (1 + config.debrisSpeedVariation * speedHash * speedHash) * scale;
  const life = (config.debrisLifetimeMs / 1000) * (1 + config.debrisLifetimeVariation * lifeHash);
  const drag = config.debrisDrag * (1 + 0.1935 * dragHash);
  return (speed * (1 - Math.exp(-drag * life))) / drag;
}

export function debrisReachRatios(config: DetonationClickConfig, seed: number, scale = 1): number[] {
  const ring = detonationRingReachPx(config, scale);
  const ratios: number[] = [];
  const count = Math.max(0, Math.round(config.debrisCount));
  for (let index = 0; index < count; index++) {
    ratios.push(debrisReachPx(config, seed, index, scale) / Math.max(1e-6, ring));
  }
  return ratios;
}
