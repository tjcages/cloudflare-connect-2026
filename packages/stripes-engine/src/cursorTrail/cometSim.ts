import type { CometTrailConfig } from "../config/types";
import { createSeededRng } from "../core/rng";
import type { CursorTrailPoint } from "./cursorTrailSim";

export const COMET_EMBER_FLOATS = 4;
export const COMET_EMBER_STRIDE_BYTES = COMET_EMBER_FLOATS * 4;

const SCALE_REF_PX = 300;
const SCALE_MIN = 0.5;
const SCALE_MAX = 2.5;
const MAX_SUBSTEP_SEC = 1 / 240;
const MAX_SUBSTEPS = 12;
const LINK_BOUNCE = 0.7;
const THIN_BASE = 1.16;
const THIN_MIN = 0.42;
const THIN_MAX = 1.22;
const THIN_SPAN_REF = 10;
const VELOCITY_RATE = 22;
const PRESENCE_SPEED_MIN = 12;
const PRESENCE_SPEED_RANGE = 130;
const PRESENCE_CURVE = 0.6;
const CORE_SPEED_MIN = 5;
const CORE_SPEED_RANGE = 70;
const CORE_RISE_RATIO = 19 / 15;
const CORE_FALL_RATIO = 3.2 / 2.6;
const EMBER_STRIDE = 7;
const EMBER_DRIVE_MIN = 34;
const EMBER_DRIVE_RANGE = 760;
const EMBER_BASE_RATE_FRACTION = 0.12;
const EMBER_ACCUM_CAP = 0.4;
const EMBER_SIZE_JITTER = 4.3 / 2.9;
const EMBER_SCATTER_PX = 10;
const EMBER_STAGGER_JITTER = 0.14;
const EMBER_MIN_AIM_SPEED = 8;
const GOLDEN = 0.618033988749895;
const TAU = Math.PI * 2;
const MAX_FRAME_MS = 50;
const MIN_FRAME_MS = 0.5;
const FIRST_FRAME_MS = 16.7;

export type CometCaps = { nodeCount: number; maxEmbers: number };

export type CometState = {
  caps: CometCaps;
  random: () => number;
  px: Float32Array;
  py: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  nodeData: Float32Array;
  radiusData: Float32Array;
  emberState: Float32Array;
  emberData: Float32Array;
  emberCount: number;
  emitAccum: number;
  lifePhase: number;
  x: number;
  y: number;
  velX: number;
  velY: number;
  presence: number;
  core: number;
  wasActive: boolean;
  lastNow: number;
};

export function cometCaps(config: CometTrailConfig): CometCaps {
  return {
    nodeCount: Math.max(2, Math.round(config.nodeCount)),
    maxEmbers: Math.max(1, Math.round(config.emberMaxCount)),
  };
}

export function cometScale(cssW: number, cssH: number): number {
  const raw = Math.min(cssW, cssH) / SCALE_REF_PX;
  return raw < SCALE_MIN ? SCALE_MIN : raw > SCALE_MAX ? SCALE_MAX : raw;
}

export function createCometState(caps: CometCaps, seed: number): CometState {
  const random = createSeededRng(seed >>> 0);
  return {
    caps,
    random,
    px: new Float32Array(caps.nodeCount),
    py: new Float32Array(caps.nodeCount),
    vx: new Float32Array(caps.nodeCount),
    vy: new Float32Array(caps.nodeCount),
    nodeData: new Float32Array(caps.nodeCount * 2),
    radiusData: new Float32Array(caps.nodeCount),
    emberState: new Float32Array(caps.maxEmbers * EMBER_STRIDE),
    emberData: new Float32Array(caps.maxEmbers * COMET_EMBER_FLOATS),
    emberCount: 0,
    emitAccum: 0,
    lifePhase: random(),
    x: 0,
    y: 0,
    velX: 0,
    velY: 0,
    presence: 0,
    core: 0,
    wasActive: false,
    lastNow: -1,
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function resetChain(state: CometState, x: number, y: number): void {
  for (let i = 0; i < state.caps.nodeCount; i++) {
    state.px[i] = x;
    state.py[i] = y;
    state.vx[i] = 0;
    state.vy[i] = 0;
  }
}

function integrateChain(
  state: CometState,
  config: CometTrailConfig,
  h: number,
  targetX: number,
  targetY: number,
  maxLink: number,
): void {
  const { px, py, vx, vy } = state;
  const nodes = state.caps.nodeCount;
  vx[0] += (config.headStiffness * (targetX - px[0]) - config.headDamping * vx[0]) * h;
  vy[0] += (config.headStiffness * (targetY - py[0]) - config.headDamping * vy[0]) * h;
  px[0] += vx[0] * h;
  py[0] += vy[0] * h;

  for (let i = 1; i < nodes; i++) {
    vx[i] += (config.chainStiffness * (px[i - 1] - px[i]) - config.chainDamping * vx[i]) * h;
    vy[i] += (config.chainStiffness * (py[i - 1] - py[i]) - config.chainDamping * vy[i]) * h;
    px[i] += vx[i] * h;
    py[i] += vy[i] * h;

    const dx = px[i] - px[i - 1];
    const dy = py[i] - py[i - 1];
    const d = Math.hypot(dx, dy);
    if (d > maxLink && d > 1e-4) {
      const nx = dx / d;
      const ny = dy / d;
      px[i] = px[i - 1] + nx * maxLink;
      py[i] = py[i - 1] + ny * maxLink;
      const out = vx[i] * nx + vy[i] * ny;
      if (out > 0) {
        vx[i] -= nx * out * LINK_BOUNCE;
        vy[i] -= ny * out * LINK_BOUNCE;
      }
    }
  }
}

function packChain(state: CometState, config: CometTrailConfig, sc: number): void {
  const { px, py, nodeData, radiusData } = state;
  const nodes = state.caps.nodeCount;
  const links = nodes - 1;
  for (let i = 0; i < nodes; i++) {
    nodeData[i * 2] = px[i];
    nodeData[i * 2 + 1] = py[i];
  }
  for (let i = 0; i < nodes; i++) {
    const a = i === 0 ? 0 : i - 1;
    const b = i === links ? links : i + 1;
    const span = Math.hypot(px[b] - px[a], py[b] - py[a]) / (b - a || 1);
    const u = links > 0 ? i / links : 0;
    const base = (config.headRadiusPx + (config.tailRadiusPx - config.headRadiusPx) * u) * sc;
    const raw = THIN_BASE - (config.stretchThinning * span) / (THIN_SPAN_REF * sc);
    const thin = raw < THIN_MIN ? THIN_MIN : raw > THIN_MAX ? THIN_MAX : raw;
    radiusData[i] = base * thin;
  }
}

function spawnEmber(
  state: CometState,
  config: CometTrailConfig,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  velX: number,
  velY: number,
  speed: number,
): void {
  if (state.emberCount >= state.caps.maxEmbers) return;
  const rng = state.random;
  const o = state.emberCount * EMBER_STRIDE;
  state.emberCount += 1;
  const along = rng();
  const back = speed > EMBER_MIN_AIM_SPEED ? Math.atan2(-velY, -velX) : rng() * TAU;
  const ang = back + (rng() - 0.5) * 2 * config.emberSpreadRad;
  const drift = config.emberSpeedMinPxPerSec + rng() * (config.emberSpeedMaxPxPerSec - config.emberSpeedMinPxPerSec);
  state.lifePhase = (state.lifePhase + GOLDEN) % 1;
  const stagger = (state.lifePhase + rng() * EMBER_STAGGER_JITTER) % 1;
  state.emberState[o] = x0 + (x1 - x0) * along + (rng() - 0.5) * EMBER_SCATTER_PX;
  state.emberState[o + 1] = y0 + (y1 - y0) * along + (rng() - 0.5) * EMBER_SCATTER_PX;
  state.emberState[o + 2] = Math.cos(ang) * drift;
  state.emberState[o + 3] = Math.sin(ang) * drift;
  state.emberState[o + 4] = 0;
  state.emberState[o + 5] =
    config.emberLifetimeMinMs + stagger * (config.emberLifetimeMaxMs - config.emberLifetimeMinMs);
  state.emberState[o + 6] = config.emberSizePx * (1 + rng() * EMBER_SIZE_JITTER);
}

function emitEmbers(
  state: CometState,
  config: CometTrailConfig,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  velX: number,
  velY: number,
  speed: number,
  dt: number,
): void {
  const drive = clamp01((speed - EMBER_DRIVE_MIN) / EMBER_DRIVE_RANGE);
  if (drive <= 0) {
    if (state.emitAccum > EMBER_ACCUM_CAP) state.emitAccum = EMBER_ACCUM_CAP;
    return;
  }
  state.emitAccum += (EMBER_BASE_RATE_FRACTION + (1 - EMBER_BASE_RATE_FRACTION) * drive) * config.emberRatePerSec * dt;
  while (state.emitAccum >= 1) {
    state.emitAccum -= 1;
    spawnEmber(state, config, x0, y0, x1, y1, velX, velY, speed);
  }
}

function stepEmbers(state: CometState, dtMs: number): void {
  const dt = dtMs / 1000;
  const data = state.emberState;
  let i = 0;
  while (i < state.emberCount) {
    const o = i * EMBER_STRIDE;
    const age = data[o + 4] + dtMs;
    if (age >= data[o + 5]) {
      state.emberCount -= 1;
      const last = state.emberCount * EMBER_STRIDE;
      if (last !== o) data.copyWithin(o, last, last + EMBER_STRIDE);
      continue;
    }
    data[o + 4] = age;
    data[o] += data[o + 2] * dt;
    data[o + 1] += data[o + 3] * dt;
    i += 1;
  }
}

function packEmbers(state: CometState): void {
  const data = state.emberState;
  for (let i = 0; i < state.emberCount; i++) {
    const o = i * EMBER_STRIDE;
    const p = i * COMET_EMBER_FLOATS;
    state.emberData[p] = data[o];
    state.emberData[p + 1] = data[o + 1];
    state.emberData[p + 2] = data[o + 6];
    state.emberData[p + 3] = data[o + 4] / data[o + 5];
  }
}

export function stepComet(
  state: CometState,
  config: CometTrailConfig,
  cursor: CursorTrailPoint | null,
  cssW: number,
  cssH: number,
  now: number,
): void {
  const rawMs = state.lastNow < 0 ? FIRST_FRAME_MS : now - state.lastNow;
  const dtMs = rawMs < MIN_FRAME_MS ? MIN_FRAME_MS : rawMs > MAX_FRAME_MS ? MAX_FRAME_MS : rawMs;
  state.lastNow = now;
  const dt = dtMs / 1000;
  const sc = cometScale(cssW, cssH);
  const active = cursor !== null;

  if (cursor && !state.wasActive) {
    state.x = cursor.x;
    state.y = cursor.y;
    state.velX = 0;
    state.velY = 0;
    resetChain(state, cursor.x, cursor.y);
  }
  const prevX = state.x;
  const prevY = state.y;
  if (cursor) {
    state.x = cursor.x;
    state.y = cursor.y;
  }

  const instVX = (state.x - prevX) / dt;
  const instVY = (state.y - prevY) / dt;
  const instSpeed = Math.hypot(instVX, instVY);
  const blend = 1 - Math.exp(-dt * VELOCITY_RATE);
  state.velX += (instVX - state.velX) * blend;
  state.velY += (instVY - state.velY) * blend;
  const smoothSpeed = Math.hypot(state.velX, state.velY);

  const drive = clamp01((smoothSpeed - PRESENCE_SPEED_MIN) / PRESENCE_SPEED_RANGE);
  const target = active ? Math.pow(drive, PRESENCE_CURVE) : 0;
  const rate = target > state.presence ? config.presenceRiseRate : config.presenceFallRate;
  state.presence += (target - state.presence) * (1 - Math.exp(-dt * rate));
  const coreDrive = clamp01((smoothSpeed - CORE_SPEED_MIN) / CORE_SPEED_RANGE);
  const coreTarget = active ? Math.pow(coreDrive, PRESENCE_CURVE) : 0;
  const coreRate =
    coreTarget > state.core ? config.presenceRiseRate * CORE_RISE_RATIO : config.presenceFallRate * CORE_FALL_RATIO;
  state.core += (coreTarget - state.core) * (1 - Math.exp(-dt * coreRate));

  if (active && state.wasActive && config.embersEnabled) {
    emitEmbers(state, config, prevX, prevY, state.x, state.y, instVX, instVY, instSpeed, dt);
  }
  state.wasActive = active;
  stepEmbers(state, dtMs);
  packEmbers(state);

  const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(dt / MAX_SUBSTEP_SEC)));
  const h = dt / steps;
  const maxLink = config.maxLinkPx * sc;
  for (let s = 0; s < steps; s++) integrateChain(state, config, h, state.x, state.y, maxLink);
  packChain(state, config, sc);
}
