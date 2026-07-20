import type { FlamesConfig, FlamesDirection } from "../config/types";
import { lerp } from "../core/math";

export interface Flame {
  x: number;
  y: number;
  width: number;
  height: number;
  speedPxPerSec: number;
  opacity: number;
  colorSeed: number;
  direction: FlamesDirection;
  rot: number;
  pivotX: number;
  pivotY: number;
  radius: number;
  angle: number;
  angVel: number;
  radialSign: number;
  baseOpacity: number;
  bornMs: number;
  lifeMs: number;
}

export interface FlamesState {
  flames: Flame[];
  lastSpawnMs: number;
  lastStepMs: number;
  random: () => number;
}

export function createFlamesState(random: () => number): FlamesState {
  return {
    flames: [],
    lastSpawnMs: 0,
    lastStepMs: 0,
    random,
  };
}

function randomBetween(random: () => number, min: number, max: number): number {
  return lerp(min, max, random());
}

function randomFlameSpan(random: () => number, displaySize: number, minRatio: number, maxRatio: number): number {
  return randomBetween(random, displaySize * minRatio, displaySize * maxRatio);
}

function randomFlameCrossAxisPosition(random: () => number, displaySize: number, span: number): number {
  const max = Math.max(0, displaySize - span);
  return randomBetween(random, 0, max);
}

export function isVerticalFlamesDirection(d: FlamesDirection): boolean {
  return d === "up" || d === "down" || d === "upDown";
}

export function isVortexFlamesDirection(d: FlamesDirection): boolean {
  return d === "vortex" || d === "vortexBits";
}

function vortexMaxRadius(displayWidth: number, displayHeight: number): number {
  return 0.5 * Math.hypot(displayWidth, displayHeight);
}

function applyVortexTransform(flame: Flame): void {
  const cx = flame.pivotX + Math.cos(flame.angle) * flame.radius;
  const cy = flame.pivotY + Math.sin(flame.angle) * flame.radius;
  flame.x = cx - flame.width * 0.5;
  flame.y = cy - flame.height * 0.5;
  const radialVel = flame.radialSign * flame.speedPxPerSec;
  const tangentialVel = flame.radius * flame.angVel;
  flame.rot = flame.angle + Math.atan2(tangentialVel, radialVel);
}

function expandFlamesDirection(d: FlamesDirection): FlamesDirection[] {
  switch (d) {
    case "upDown":
      return ["up", "down"];
    case "leftRight":
      return ["left", "right"];
    default:
      return [d];
  }
}

function pickFlameDirection(state: FlamesState, direction: FlamesDirection): FlamesDirection {
  const options = expandFlamesDirection(direction);
  return options[Math.floor(state.random() * options.length) % options.length];
}

export function flamesGradientStops(sharpness: number): { inner: number; outer: number } {
  const clamped = Math.min(1, Math.max(0, sharpness));
  const halfBand = 0.4 + (0.06 - 0.4) * clamped;
  return { inner: 0.5 - halfBand, outer: 0.5 + halfBand };
}

export function flamesSpeedRange(config: FlamesConfig): { minPxPerSec: number; maxPxPerSec: number } {
  const spread = config.baseSpeedPxPerSec * 0.5 * config.speedVariation;
  return {
    minPxPerSec: Math.max(1, config.baseSpeedPxPerSec - spread),
    maxPxPerSec: config.baseSpeedPxPerSec + spread,
  };
}

function flameColorSeed(width: number, height: number, speedPxPerSec: number, opacity: number): number {
  let h = Math.imul(Math.round(width * 977) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ Math.round(height * 1013), 0xc2b2ae35);
  h = Math.imul(h ^ Math.round(speedPxPerSec * 131), 0x27d4eb2f);
  h = Math.imul(h ^ Math.round(opacity * 100003), 0x165667b1);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function createFlame(
  state: FlamesState,
  config: FlamesConfig,
  displayWidth: number,
  displayHeight: number,
  direction: FlamesDirection,
): Flame {
  const width = randomFlameSpan(state.random, displayWidth, config.minWidthRatio, config.maxWidthRatio);
  const height = randomFlameSpan(state.random, displayHeight, config.minHeightRatio, config.maxHeightRatio);
  const speedRange = flamesSpeedRange(config);
  const speedPxPerSec = randomBetween(state.random, speedRange.minPxPerSec, speedRange.maxPxPerSec);
  const opacity = randomBetween(state.random, config.opacityMin, config.opacityMax);
  const colorSeed = flameColorSeed(width, height, speedPxPerSec, opacity);

  const base = {
    width,
    height,
    speedPxPerSec,
    opacity,
    colorSeed,
    direction,
    rot: 0,
    pivotX: 0,
    pivotY: 0,
    radius: 0,
    angle: 0,
    angVel: 0,
    radialSign: 1,
    baseOpacity: opacity,
    bornMs: 0,
    lifeMs: 0,
  };

  if (isVortexFlamesDirection(direction)) {
    return { ...base, x: 0, y: 0 };
  }

  if (isVerticalFlamesDirection(direction)) {
    return {
      ...base,
      x: randomFlameCrossAxisPosition(state.random, displayWidth, width),
      y: 0,
    };
  }

  return {
    ...base,
    x: 0,
    y: randomFlameCrossAxisPosition(state.random, displayHeight, height),
  };
}

function placeSpawnedFlame(
  flame: Flame,
  direction: FlamesDirection,
  displayWidth: number,
  displayHeight: number,
): void {
  switch (direction) {
    case "up":
      flame.y = displayHeight;
      break;
    case "down":
      flame.y = -flame.height;
      break;
    case "left":
      flame.x = displayWidth;
      break;
    case "right":
      flame.x = -flame.width;
      break;
  }
}

function placeSeededFlame(
  flame: Flame,
  direction: FlamesDirection,
  displayWidth: number,
  displayHeight: number,
  random: () => number,
): void {
  if (isVerticalFlamesDirection(direction)) {
    flame.y = randomBetween(random, -flame.height, displayHeight);
    return;
  }
  flame.x = randomBetween(random, -flame.width, displayWidth);
}

function placeVortexFlame(
  flame: Flame,
  config: FlamesConfig,
  displayWidth: number,
  displayHeight: number,
  random: () => number,
  seeded: boolean,
): void {
  flame.pivotX = displayWidth * 0.5;
  flame.pivotY = displayHeight * 0.5;
  flame.angle = random() * Math.PI * 2;
  flame.angVel = config.swirlRate * (1 + (random() - 0.5) * config.speedVariation);
  flame.radialSign = config.inward ? -1 : 1;

  const rMax = vortexMaxRadius(displayWidth, displayHeight);
  if (seeded) {
    flame.radius = randomBetween(random, 2, rMax);
  } else if (config.inward) {
    flame.radius = rMax * randomBetween(random, 1, 1.08);
  } else {
    flame.radius = randomBetween(random, 2, 8);
  }
  applyVortexTransform(flame);
}

function placeVortexBit(
  flame: Flame,
  config: FlamesConfig,
  displayWidth: number,
  displayHeight: number,
  random: () => number,
  nowMs: number,
  seeded: boolean,
): void {
  flame.pivotX = random() * displayWidth;
  flame.pivotY = random() * displayHeight;
  flame.angle = random() * Math.PI * 2;
  flame.radius = flame.width;
  flame.radialSign = 0;
  flame.angVel = config.swirlRate * (random() < 0.5 ? -1 : 1) * (1 + (random() - 0.5) * config.speedVariation);
  flame.lifeMs = randomBetween(random, 600, 1800);
  flame.bornMs = seeded ? nowMs - random() * flame.lifeMs : nowMs;
  applyVortexTransform(flame);
}

function vortexBitEnvelope(t: number): number {
  const fadeIn = smoothstep01(t / 0.25);
  const fadeOut = 1 - smoothstep01((t - 0.65) / 0.35);
  return fadeIn * fadeOut;
}

function smoothstep01(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

function spawnFlame(
  state: FlamesState,
  config: FlamesConfig,
  displayWidth: number,
  displayHeight: number,
  nowMs: number,
): Flame {
  const direction = pickFlameDirection(state, config.direction);
  const flame = createFlame(state, config, displayWidth, displayHeight, direction);
  if (flame.direction === "vortexBits") {
    placeVortexBit(flame, config, displayWidth, displayHeight, state.random, nowMs, false);
  } else if (flame.direction === "vortex") {
    placeVortexFlame(flame, config, displayWidth, displayHeight, state.random, false);
  } else {
    placeSpawnedFlame(flame, flame.direction, displayWidth, displayHeight);
  }
  return flame;
}

function seedFlames(
  state: FlamesState,
  config: FlamesConfig,
  displayWidth: number,
  displayHeight: number,
  nowMs: number,
): void {
  if (!config.enabled || state.flames.length > 0 || displayWidth <= 0 || displayHeight <= 0) {
    return;
  }

  for (let i = 0; i < config.maxActive; i++) {
    const direction = pickFlameDirection(state, config.direction);
    const flame = createFlame(state, config, displayWidth, displayHeight, direction);
    if (flame.direction === "vortexBits") {
      placeVortexBit(flame, config, displayWidth, displayHeight, state.random, nowMs, true);
    } else if (flame.direction === "vortex") {
      placeVortexFlame(flame, config, displayWidth, displayHeight, state.random, true);
    } else {
      placeSeededFlame(flame, flame.direction, displayWidth, displayHeight, state.random);
    }
    state.flames.push(flame);
  }
}

function isFlameVisible(flame: Flame, display: { width: number; height: number }, nowMs: number): boolean {
  switch (flame.direction) {
    case "up":
      return flame.y + flame.height >= 0;
    case "down":
      return flame.y <= display.height;
    case "left":
      return flame.x + flame.width >= 0;
    case "right":
      return flame.x <= display.width;
    case "vortex": {
      if (flame.radialSign < 0) return flame.radius > 4;
      const cull = 0.5 * Math.hypot(flame.width, flame.height);
      return flame.radius <= vortexMaxRadius(display.width, display.height) + cull;
    }
    case "vortexBits":
      return nowMs - flame.bornMs < flame.lifeMs;
    default:
      return false;
  }
}

export function stepFlames(
  state: FlamesState,
  config: FlamesConfig,
  display: { width: number; height: number },
  nowMs: number,
): void {
  if (!config.enabled || display.width <= 0 || display.height <= 0) {
    return;
  }

  if (state.lastStepMs <= 0) {
    state.lastStepMs = nowMs;
    state.lastSpawnMs = nowMs;
    seedFlames(state, config, display.width, display.height, nowMs);
    return;
  }

  const dtSec = Math.max(0, (nowMs - state.lastStepMs) / 1000);
  state.lastStepMs = nowMs;

  for (const flame of state.flames) {
    switch (flame.direction) {
      case "up":
        flame.y -= flame.speedPxPerSec * dtSec;
        break;
      case "down":
        flame.y += flame.speedPxPerSec * dtSec;
        break;
      case "left":
        flame.x -= flame.speedPxPerSec * dtSec;
        break;
      case "right":
        flame.x += flame.speedPxPerSec * dtSec;
        break;
      case "vortex":
        flame.radius += flame.radialSign * flame.speedPxPerSec * dtSec;
        flame.angle += flame.angVel * dtSec;
        applyVortexTransform(flame);
        break;
      case "vortexBits": {
        flame.angle += flame.angVel * dtSec;
        applyVortexTransform(flame);
        const t = flame.lifeMs > 0 ? (nowMs - flame.bornMs) / flame.lifeMs : 1;
        flame.opacity = flame.baseOpacity * vortexBitEnvelope(t);
        break;
      }
    }
  }

  state.flames = state.flames.filter((flame) => isFlameVisible(flame, display, nowMs));

  if (state.flames.length > config.maxActive) {
    state.flames.length = config.maxActive;
  }

  const spawnInterval =
    config.spawnIntervalMs + randomBetween(state.random, -config.spawnJitterMs, config.spawnJitterMs);
  if (state.flames.length < config.maxActive && nowMs - state.lastSpawnMs >= spawnInterval) {
    state.flames.push(spawnFlame(state, config, display.width, display.height, nowMs));
    state.lastSpawnMs = nowMs;
  }
}
