import type { FlamesConfig, FlamesDirection, FlamesSnakeConfig } from "../config/types";
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
  baseRadius: number;
  angle: number;
  angVel: number;
  radialSign: number;
  baseOpacity: number;
  bornMs: number;
  lifeMs: number;
  segIndex: number;
  segCount: number;
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
  return d === "vortex" || d === "vortexBits" || d === "vortexLines";
}

function isSnakeDirection(d: FlamesDirection): boolean {
  return d === "vortexBits" || d === "vortexLines";
}

function vortexMaxRadius(displayWidth: number, displayHeight: number): number {
  return 0.5 * Math.hypot(displayWidth, displayHeight);
}

const VORTEX_CORE_RATIO = 0.06;
const VORTEX_SPAWN_BAND = 0.04;
const VORTEX_FADE_RATIO = 0.22;

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
    baseRadius: 0,
    angle: 0,
    angVel: 0,
    radialSign: 1,
    baseOpacity: opacity,
    bornMs: 0,
    lifeMs: 0,
    segIndex: 0,
    segCount: 1,
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
  const rMin = rMax * VORTEX_CORE_RATIO;
  if (seeded) {
    const u = random();
    flame.radius = Math.sqrt(rMin * rMin + u * (rMax * rMax - rMin * rMin));
  } else if (config.inward) {
    flame.radius = rMax * randomBetween(random, 1, 1.08);
  } else {
    flame.radius = rMin + rMax * VORTEX_SPAWN_BAND * random();
  }
  applyVortexTransform(flame);
}

const SNAKE_SEG_ARC = 0.16;
const SNAKE_SEG_OVERLAP = 1.15;
const SNAKE_SEG_LEN_RATIO = 0.14;

function emitVortexSnake(
  state: FlamesState,
  config: FlamesConfig,
  snake: FlamesSnakeConfig,
  global: boolean,
  displayWidth: number,
  displayHeight: number,
  nowMs: number,
  seeded: boolean,
): Flame[] {
  const segCount = Math.round(randomBetween(state.random, snake.tailMin, snake.tailMax));
  const scale = randomBetween(state.random, snake.scaleMin, snake.scaleMax) * displayWidth;
  const thickness = Math.max(1, scale * snake.thickness);
  const lifeMs = randomBetween(state.random, snake.lifeMinMs, snake.lifeMaxMs);
  const spin = state.random() < 0.5 ? -1 : 1;

  let pivotX: number;
  let pivotY: number;
  let radius: number;
  let radialSign: number;
  let angVel: number;
  if (global) {
    const rMax = vortexMaxRadius(displayWidth, displayHeight);
    const rMin = rMax * VORTEX_CORE_RATIO;
    const u = state.random();
    pivotX = displayWidth * 0.5;
    pivotY = displayHeight * 0.5;
    radius = Math.sqrt(rMin * rMin + u * (rMax * rMax - rMin * rMin));
    radialSign = config.inward ? -1 : 1;
    angVel = randomBetween(state.random, snake.speedMin, snake.speedMax) * (config.inward ? -1 : 1);
  } else {
    pivotX = state.random() * displayWidth;
    pivotY = state.random() * displayHeight;
    radius = scale;
    radialSign = 0;
    angVel = spin * randomBetween(state.random, snake.speedMin, snake.speedMax);
  }

  const segLen = Math.max(1, scale * SNAKE_SEG_LEN_RATIO);
  const segArc = global ? segLen / Math.max(1, radius) : SNAKE_SEG_ARC;
  const headWidth = global
    ? Math.max(1, segLen * SNAKE_SEG_OVERLAP)
    : Math.max(1, radius * SNAKE_SEG_ARC * SNAKE_SEG_OVERLAP);
  const headAngle = state.random() * Math.PI * 2;
  const bornMs = seeded ? nowMs - state.random() * lifeMs : nowMs;
  const baseOpacity = randomBetween(state.random, config.opacityMin, config.opacityMax);
  const colorSeed = flameColorSeed(headWidth, thickness, Math.abs(angVel), baseOpacity);

  const segments: Flame[] = [];
  const dirSign = Math.sign(angVel);
  for (let i = 0; i < segCount; i++) {
    const along = 1 - i / segCount;
    const flame: Flame = {
      x: 0,
      y: 0,
      width: headWidth,
      height: Math.max(1, thickness * (0.35 + 0.65 * along)),
      speedPxPerSec: global ? Math.abs(angVel) * radius * 0.06 : 0,
      opacity: baseOpacity * (0.45 + 0.55 * along),
      colorSeed,
      direction: global ? "vortexBits" : "vortexLines",
      rot: 0,
      pivotX,
      pivotY,
      radius,
      baseRadius: radius,
      angle: headAngle - dirSign * i * segArc,
      angVel,
      radialSign,
      baseOpacity: baseOpacity * (0.45 + 0.55 * along),
      bornMs,
      lifeMs,
      segIndex: i,
      segCount,
    };
    applyVortexTransform(flame);
    segments.push(flame);
  }
  return segments;
}

export function vortexBitEnvelope(t: number): number {
  const fadeIn = smoothstep01(t / 0.12);
  const fadeOut = 1 - smoothstep01((t - 0.86) / 0.14);
  return fadeIn * fadeOut;
}

function smoothstep01(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

function spawnFlame(state: FlamesState, config: FlamesConfig, displayWidth: number, displayHeight: number): Flame {
  const direction = pickFlameDirection(state, config.direction);
  const flame = createFlame(state, config, displayWidth, displayHeight, direction);
  if (flame.direction === "vortex") {
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

  if (isSnakeDirection(config.direction)) {
    const snake = config.direction === "vortexBits" ? config.bits : config.lines;
    const global = config.direction === "vortexBits";
    for (let i = 0; i < snake.maxInstances; i++) {
      state.flames.push(...emitVortexSnake(state, config, snake, global, displayWidth, displayHeight, nowMs, true));
    }
    return;
  }

  for (let i = 0; i < config.maxActive; i++) {
    const direction = pickFlameDirection(state, config.direction);
    const flame = createFlame(state, config, displayWidth, displayHeight, direction);
    if (flame.direction === "vortex") {
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
    case "vortexLines":
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
      case "vortex": {
        flame.radius += flame.radialSign * flame.speedPxPerSec * dtSec;
        flame.angle += flame.angVel * dtSec;
        applyVortexTransform(flame);
        const rMaxV = vortexMaxRadius(display.width, display.height);
        const t = rMaxV > 0 ? flame.radius / (rMaxV * VORTEX_FADE_RATIO) : 1;
        flame.opacity = flame.baseOpacity * smoothstep01(t);
        break;
      }
      case "vortexBits": {
        flame.baseRadius += flame.radialSign * flame.speedPxPerSec * dtSec;
        flame.angle += flame.angVel * dtSec;
        flame.radius = flame.baseRadius;
        applyVortexTransform(flame);
        const t = flame.lifeMs > 0 ? (nowMs - flame.bornMs) / flame.lifeMs : 1;
        flame.opacity = flame.baseOpacity * vortexBitEnvelope(t);
        break;
      }
      case "vortexLines": {
        flame.angle += flame.angVel * dtSec;
        flame.radius = flame.baseRadius;
        applyVortexTransform(flame);
        const t = flame.lifeMs > 0 ? (nowMs - flame.bornMs) / flame.lifeMs : 1;
        flame.opacity = flame.baseOpacity * vortexBitEnvelope(t);
        break;
      }
    }
  }

  state.flames = state.flames.filter((flame) => isFlameVisible(flame, display, nowMs));

  const isSnake = isSnakeDirection(config.direction);

  if (!isSnake && state.flames.length > config.maxActive) {
    state.flames.length = config.maxActive;
  }

  const snake = config.direction === "vortexBits" ? config.bits : config.lines;

  if (isSnake) {
    const global = config.direction === "vortexBits";
    let headCount = state.flames.filter((f) => f.segIndex === 0).length;
    let lastSpawnMs = state.lastSpawnMs;
    while (headCount < snake.maxInstances) {
      const spawnInterval = randomBetween(state.random, snake.intervalMinMs, snake.intervalMaxMs);
      if (nowMs - lastSpawnMs < spawnInterval) break;
      state.flames.push(...emitVortexSnake(state, config, snake, global, display.width, display.height, nowMs, false));
      headCount++;
      lastSpawnMs += spawnInterval;
    }
    state.lastSpawnMs = lastSpawnMs;
    return;
  }

  const spawnInterval =
    config.spawnIntervalMs + randomBetween(state.random, -config.spawnJitterMs, config.spawnJitterMs);
  const atCapacity = state.flames.length >= config.maxActive;
  if (!atCapacity && nowMs - state.lastSpawnMs >= spawnInterval) {
    state.flames.push(spawnFlame(state, config, display.width, display.height));
    state.lastSpawnMs = nowMs;
  }
}
