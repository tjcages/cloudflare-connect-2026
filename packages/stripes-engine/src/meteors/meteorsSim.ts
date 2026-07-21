import type { BackgroundMeteors } from "../config/types";
import { createSeededRng } from "../core/rng";

const METEORS_SEED_XOR = 0x6d657465;
const MIN_INTERVAL_RATIO = 0.15;
const MAX_INTERVAL_RATIO = 11;
const RESYNC_LAG_SECONDS = 1.5;
const MAX_SPAWNS_PER_STEP = 12;
const SPAWN_MARGIN = 0.08;

export type MeteorsCaps = { maxActive: number };

export type Meteor = {
  spawnX: number;
  spawnY: number;
  bornAtSec: number;
  lifetimeSec: number;
  angleOffset: number;
  speedMul: number;
  lengthMul: number;
  thicknessMul: number;
};

export type MeteorsState = {
  caps: MeteorsCaps;
  random: () => number;
  meteors: Meteor[];
  nextArrivalSec: number;
  hasArrival: boolean;
  spawnCount: number;
  count: number;
  originData: Float32Array;
  shapeData: Float32Array;
};

export function meteorsCaps(config: BackgroundMeteors): MeteorsCaps {
  return { maxActive: Math.max(1, Math.round(config.maxActive)) };
}

export function createMeteorsState(caps: MeteorsCaps, seed: number): MeteorsState {
  return {
    caps,
    random: createSeededRng((seed ^ METEORS_SEED_XOR) >>> 0),
    meteors: [],
    nextArrivalSec: 0,
    hasArrival: false,
    spawnCount: 0,
    count: 0,
    originData: new Float32Array(caps.maxActive * 4),
    shapeData: new Float32Array(caps.maxActive * 4),
  };
}

function randomBetween(random: () => number, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * random();
}

function smooth01(u: number): number {
  const t = u < 0 ? 0 : u > 1 ? 1 : u;
  return t * t * (3 - 2 * t);
}

export function meteorInterval(state: MeteorsState, ratePerSec: number): number {
  const rate = Math.max(0.02, ratePerSec);
  const mean = 1 / rate;
  const uniform = Math.min(0.999999, Math.max(1e-6, state.random()));
  const exponential = -Math.log(1 - uniform) * mean;
  const minimum = mean * MIN_INTERVAL_RATIO;
  const maximum = mean * MAX_INTERVAL_RATIO;
  return exponential < minimum ? minimum : exponential > maximum ? maximum : exponential;
}

export function meteorEnvelope(ageSec: number, lifetimeSec: number, fadeInSec: number, fadeOutSec: number): number {
  if (ageSec < 0 || ageSec > lifetimeSec) return 0;
  const rise = fadeInSec > 0 ? smooth01(ageSec / fadeInSec) : 1;
  const fall = Math.min(fadeOutSec, lifetimeSec);
  const decay = fall > 0 ? 1 - smooth01((ageSec - (lifetimeSec - fall)) / fall) : 1;
  const value = rise * decay;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function spawnMeteor(
  state: MeteorsState,
  config: BackgroundMeteors,
  cssW: number,
  cssH: number,
  bornAtSec: number,
): void {
  const random = state.random;
  if (state.meteors.length >= state.caps.maxActive) {
    let oldest = 0;
    for (let index = 1; index < state.meteors.length; index++) {
      if (state.meteors[index].bornAtSec < state.meteors[oldest].bornAtSec) oldest = index;
    }
    state.meteors.splice(oldest, 1);
  }

  const radiant = (config.radiantAngleDeg * Math.PI) / 180;
  const dirX = Math.cos(radiant);
  const dirY = Math.sin(radiant);
  const verticalFlux = Math.abs(dirX) * Math.max(1, cssH);
  const horizontalFlux = Math.abs(dirY) * Math.max(1, cssW);
  const throughHorizontal = random() * (verticalFlux + horizontalFlux) < horizontalFlux;

  let spawnX: number;
  let spawnY: number;
  if (throughHorizontal) {
    spawnY = dirY > 0 ? -(SPAWN_MARGIN + random() * 0.32) : 1 + SPAWN_MARGIN + random() * 0.32;
    spawnX = (dirX > 0 ? -0.45 : -0.05) + random() * 1.5;
  } else {
    spawnX = dirX > 0 ? -(SPAWN_MARGIN + random() * 0.34) : 1 + SPAWN_MARGIN + random() * 0.34;
    spawnY = (dirY > 0 ? -0.05 : 0.3) + random() * 0.75;
  }

  const jitter = (config.angleJitterDeg * Math.PI) / 180;
  state.meteors.push({
    spawnX,
    spawnY,
    bornAtSec,
    lifetimeSec: randomBetween(random, config.lifetimeMinMs, config.lifetimeMaxMs) / 1000,
    angleOffset: randomBetween(random, -jitter, jitter),
    speedMul: config.speedScale * randomBetween(random, 1 - config.speedVariation, 1 + config.speedVariation),
    lengthMul:
      config.tailLengthScale * randomBetween(random, 1 - config.tailLengthVariation, 1 + config.tailLengthVariation),
    thicknessMul:
      config.thicknessScale * randomBetween(random, 1 - config.thicknessVariation, 1 + config.thicknessVariation),
  });
  state.spawnCount++;
}

export function stepMeteors(
  state: MeteorsState,
  config: BackgroundMeteors,
  cssW: number,
  cssH: number,
  timeSec: number,
): void {
  for (let index = state.meteors.length - 1; index >= 0; index--) {
    const meteor = state.meteors[index];
    if (timeSec - meteor.bornAtSec > meteor.lifetimeSec) state.meteors.splice(index, 1);
  }

  if (!state.hasArrival) {
    state.nextArrivalSec = timeSec + meteorInterval(state, config.ratePerSec) * 0.35;
    state.hasArrival = true;
  }
  if (timeSec - state.nextArrivalSec > RESYNC_LAG_SECONDS) state.nextArrivalSec = timeSec;

  let spawned = 0;
  while (timeSec >= state.nextArrivalSec && spawned < MAX_SPAWNS_PER_STEP) {
    spawnMeteor(state, config, cssW, cssH, state.nextArrivalSec);
    state.nextArrivalSec += meteorInterval(state, config.ratePerSec);
    spawned++;
  }

  const fadeInSec = config.fadeInMs / 1000;
  const fadeOutSec = config.fadeOutMs / 1000;
  state.originData.fill(0);
  state.shapeData.fill(0);
  let count = 0;
  for (const meteor of state.meteors) {
    if (count >= state.caps.maxActive) break;
    const age = timeSec - meteor.bornAtSec;
    const envelope = meteorEnvelope(age, meteor.lifetimeSec, fadeInSec, fadeOutSec);
    if (envelope <= 0) continue;
    const offset = count * 4;
    state.originData[offset] = meteor.spawnX;
    state.originData[offset + 1] = meteor.spawnY;
    state.originData[offset + 2] = age;
    state.originData[offset + 3] = envelope;
    state.shapeData[offset] = meteor.angleOffset;
    state.shapeData[offset + 1] = meteor.speedMul;
    state.shapeData[offset + 2] = meteor.lengthMul;
    state.shapeData[offset + 3] = meteor.thicknessMul;
    count++;
  }
  state.count = count;
}
