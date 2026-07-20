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
  };

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

function spawnFlame(state: FlamesState, config: FlamesConfig, displayWidth: number, displayHeight: number): Flame {
  const direction = pickFlameDirection(state, config.direction);
  const flame = createFlame(state, config, displayWidth, displayHeight, direction);
  placeSpawnedFlame(flame, flame.direction, displayWidth, displayHeight);
  return flame;
}

function seedFlames(state: FlamesState, config: FlamesConfig, displayWidth: number, displayHeight: number): void {
  if (!config.enabled || state.flames.length > 0 || displayWidth <= 0 || displayHeight <= 0) {
    return;
  }

  for (let i = 0; i < config.maxActive; i++) {
    const direction = pickFlameDirection(state, config.direction);
    const flame = createFlame(state, config, displayWidth, displayHeight, direction);
    placeSeededFlame(flame, flame.direction, displayWidth, displayHeight, state.random);
    state.flames.push(flame);
  }
}

function isFlameVisible(flame: Flame, display: { width: number; height: number }): boolean {
  switch (flame.direction) {
    case "up":
      return flame.y + flame.height >= 0;
    case "down":
      return flame.y <= display.height;
    case "left":
      return flame.x + flame.width >= 0;
    case "right":
      return flame.x <= display.width;
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
    seedFlames(state, config, display.width, display.height);
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
    }
  }

  state.flames = state.flames.filter((flame) => isFlameVisible(flame, display));

  if (state.flames.length > config.maxActive) {
    state.flames.length = config.maxActive;
  }

  const spawnInterval =
    config.spawnIntervalMs + randomBetween(state.random, -config.spawnJitterMs, config.spawnJitterMs);
  const atCapacity = state.flames.length >= config.maxActive;
  if (!atCapacity && nowMs - state.lastSpawnMs >= spawnInterval) {
    state.flames.push(spawnFlame(state, config, display.width, display.height));
    state.lastSpawnMs = nowMs;
  }
}
