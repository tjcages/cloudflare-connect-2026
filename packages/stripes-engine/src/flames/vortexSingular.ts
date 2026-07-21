import type { FlamesConfig, VortexSingularConfig } from "../config/types";
import { lerp } from "../core/math";
import type { Flame, FlamesState } from "./flamesSim";

export interface VortexTail {
  x: number;
  y: number;
  heading: number;
  speedPxPerSec: number;
  thickness: number;
  turnDir: number;
  turnFreq1: number;
  turnFreq2: number;
  turnPhase1: number;
  turnPhase2: number;
  fadeSeed1: number;
  fadeSeed2: number;
  fadePhase1: number;
  fadePhase2: number;
  bornMs: number;
  lifeMs: number;
  baseOpacity: number;
  colorSeed: number;
  trailX: number[];
  trailY: number[];
}

const SEG_OVERLAP = 1.35;
const TAIL_MIN_SIZE = 0.35;
const HEAD_MIN_OPACITY = 0.45;
const LIFE_FADE_MS = 600;
const STEER_GAIN = 3;
const MIN_TRAIL_STEP_PX = 0.2;
const GOLDEN = 1.618;

function smoothstep01(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

export function vortexSingularLifeEnvelope(ageMs: number, lifeMs: number): number {
  if (lifeMs <= 0) return 0;
  const fade = Math.min(LIFE_FADE_MS, lifeMs * 0.25);
  return Math.max(0, Math.min(smoothstep01(ageMs / fade), smoothstep01((lifeMs - ageMs) / fade)));
}

export function vortexSingularFade(tail: VortexTail, tSec: number, cfg: VortexSingularConfig): number {
  const w = Math.PI * 2 * cfg.fadeCycleRate;
  const n =
    0.5 +
    0.25 * Math.sin(tSec * w * tail.fadeSeed1 + tail.fadePhase1) +
    0.25 * Math.sin(tSec * w * tail.fadeSeed2 + tail.fadePhase2);
  const raw = smoothstep01((n - 0.35) / 0.3);
  return 1 - cfg.fadeDepth * (1 - raw);
}

function turnRateAt(tail: VortexTail, tSec: number, cfg: VortexSingularConfig): number {
  const wave =
    Math.sin(tSec * tail.turnFreq1 + tail.turnPhase1) + 0.6 * Math.sin(tSec * tail.turnFreq2 + tail.turnPhase2);
  return cfg.turnRate * tail.turnDir * (1 + cfg.turnVariation * wave);
}

function boundarySteer(tail: VortexTail, width: number, height: number, margin: number): number {
  if (margin <= 0) return 0;
  const distEdge = Math.min(tail.x, tail.y, width - tail.x, height - tail.y);
  if (distEdge >= margin) return 0;
  const p = Math.min(1, (margin - distEdge) / margin);
  const toCenter = Math.atan2(height * 0.5 - tail.y, width * 0.5 - tail.x);
  const diff = Math.atan2(Math.sin(toCenter - tail.heading), Math.cos(toCenter - tail.heading));
  return p * p * STEER_GAIN * diff;
}

function spawnTail(
  random: () => number,
  config: FlamesConfig,
  display: { width: number; height: number },
  nowMs: number,
  seeded: boolean,
): VortexTail {
  const cfg = config.vortexSingular;
  const spread = config.baseSpeedPxPerSec * 0.5 * config.speedVariation;
  const speedPxPerSec = lerp(
    Math.max(1, config.baseSpeedPxPerSec - spread),
    config.baseSpeedPxPerSec + spread,
    random(),
  );
  const lifeMs = lerp(cfg.lifeMinMs, cfg.lifeMaxMs, random());
  const x = random() * display.width;
  const y = random() * display.height;
  return {
    x,
    y,
    heading: random() * Math.PI * 2,
    speedPxPerSec,
    thickness: Math.max(1, lerp(config.minWidthRatio, config.maxWidthRatio, random()) * display.width),
    turnDir: random() < 0.5 ? -1 : 1,
    turnFreq1: lerp(0.15, 0.4, random()),
    turnFreq2: lerp(0.15, 0.4, random()) * GOLDEN,
    turnPhase1: random() * Math.PI * 2,
    turnPhase2: random() * Math.PI * 2,
    fadeSeed1: lerp(0.7, 1.3, random()),
    fadeSeed2: lerp(0.7, 1.3, random()) * 1.7,
    fadePhase1: random() * Math.PI * 2,
    fadePhase2: random() * Math.PI * 2,
    bornMs: seeded ? nowMs - random() * lifeMs * 0.8 : nowMs,
    lifeMs,
    baseOpacity: lerp(config.opacityMin, config.opacityMax, random()),
    colorSeed: random(),
    trailX: [x],
    trailY: [y],
  };
}

function trimTrail(tail: VortexTail, cfg: VortexSingularConfig): void {
  const needed = cfg.segCount * cfg.segSpacingPx * 1.25 + 40;
  const xs = tail.trailX;
  const ys = tail.trailY;
  let acc = 0;
  for (let i = xs.length - 1; i > 0; i--) {
    acc += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    if (acc > needed) {
      if (i > 1) {
        xs.splice(0, i - 1);
        ys.splice(0, i - 1);
      }
      return;
    }
  }
}

function appendSegments(out: Flame[], tail: VortexTail, cfg: VortexSingularConfig, visibility: number): void {
  const xs = tail.trailX;
  const ys = tail.trailY;
  const segW = cfg.segSpacingPx * SEG_OVERLAP;
  let seg = 0;
  let acc = 0;
  for (let i = xs.length - 1; i > 0 && seg < cfg.segCount; i--) {
    const ax = xs[i];
    const ay = ys[i];
    const bx = xs[i - 1];
    const by = ys[i - 1];
    const d = Math.hypot(bx - ax, by - ay);
    if (d <= 0) continue;
    const angle = Math.atan2(ay - by, ax - bx);
    while (seg < cfg.segCount && seg * cfg.segSpacingPx <= acc + d) {
      const t = (seg * cfg.segSpacingPx - acc) / d;
      const along = 1 - seg / cfg.segCount;
      const height = Math.max(1, tail.thickness * (TAIL_MIN_SIZE + (1 - TAIL_MIN_SIZE) * along));
      out.push({
        x: lerp(ax, bx, t) - segW * 0.5,
        y: lerp(ay, by, t) - height * 0.5,
        width: segW,
        height,
        speedPxPerSec: tail.speedPxPerSec,
        opacity: tail.baseOpacity * (HEAD_MIN_OPACITY + (1 - HEAD_MIN_OPACITY) * along) * visibility,
        colorSeed: tail.colorSeed,
        direction: "vortexSingular",
        rot: angle,
      });
      seg++;
    }
    acc += d;
  }
}

function rebuildFlames(state: FlamesState, config: FlamesConfig, nowMs: number): void {
  const cfg = config.vortexSingular;
  const flames: Flame[] = [];
  for (const tail of state.tails) {
    trimTrail(tail, cfg);
    const ageMs = nowMs - tail.bornMs;
    const visibility = vortexSingularLifeEnvelope(ageMs, tail.lifeMs) * vortexSingularFade(tail, ageMs / 1000, cfg);
    if (visibility <= 0.001) continue;
    appendSegments(flames, tail, cfg, visibility);
  }
  state.flames = flames;
}

export function stepVortexSingular(
  state: FlamesState,
  config: FlamesConfig,
  display: { width: number; height: number },
  nowMs: number,
): void {
  const cfg = config.vortexSingular;

  if (state.lastStepMs <= 0) {
    state.lastStepMs = nowMs;
    state.lastSpawnMs = nowMs;
    state.tails = [];
    for (let i = 0; i < config.maxActive; i++) {
      state.tails.push(spawnTail(state.random, config, display, nowMs, true));
    }
    rebuildFlames(state, config, nowMs);
    return;
  }

  const dtSec = Math.min(0.1, Math.max(0, (nowMs - state.lastStepMs) / 1000));
  state.lastStepMs = nowMs;

  while (state.tails.length < config.maxActive) {
    state.tails.push(spawnTail(state.random, config, display, nowMs, false));
  }
  if (state.tails.length > config.maxActive) state.tails.length = config.maxActive;

  const margin = cfg.edgeMarginRatio * Math.min(display.width, display.height);
  for (let i = 0; i < state.tails.length; i++) {
    let tail = state.tails[i];
    if (nowMs - tail.bornMs >= tail.lifeMs) {
      tail = spawnTail(state.random, config, display, nowMs, false);
      state.tails[i] = tail;
    }
    const tSec = (nowMs - tail.bornMs) / 1000;
    const omega = turnRateAt(tail, tSec, cfg) + boundarySteer(tail, display.width, display.height, margin);
    tail.heading += omega * dtSec;
    tail.x += Math.cos(tail.heading) * tail.speedPxPerSec * dtSec;
    tail.y += Math.sin(tail.heading) * tail.speedPxPerSec * dtSec;
    const lastIdx = tail.trailX.length - 1;
    if (Math.hypot(tail.x - tail.trailX[lastIdx], tail.y - tail.trailY[lastIdx]) >= MIN_TRAIL_STEP_PX) {
      tail.trailX.push(tail.x);
      tail.trailY.push(tail.y);
    }
  }

  rebuildFlames(state, config, nowMs);
}
