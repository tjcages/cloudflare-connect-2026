import { Texture } from "pixi.js";
import {
  isVerticalPlaygroundFlamesDirection,
  resolveFlamesGradientStops,
  resolveFlamesSpeedRange,
  type PlaygroundFlamesConfig,
  type PlaygroundFlamesDirection,
} from "./playgroundFlamesConfig";

export type PlaygroundFlame = {
  x: number;
  y: number;
  width: number;
  height: number;
  speedPxPerSec: number;
};

export type PlaygroundFlamesState = {
  flames: PlaygroundFlame[];
  lastSpawnMs: number;
  lastStepMs: number;
  random: () => number;
};

const PLAYGROUND_FLAMES_COLOR = "rgb(255, 255, 255)";
const PLAYGROUND_FLAMES_COLOR_TRANSPARENT = "rgba(255, 255, 255, 0)";

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

function randomBetween(random: () => number, min: number, max: number): number {
  return lerp(min, max, random());
}

function randomFlamesUnitInterval(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 2 ** 32;
}

export function createPlaygroundFlamesState(random: () => number = randomFlamesUnitInterval): PlaygroundFlamesState {
  return {
    flames: [],
    lastSpawnMs: 0,
    lastStepMs: 0,
    random,
  };
}

function randomFlameSpan(random: () => number, displaySize: number, minRatio: number, maxRatio: number): number {
  return randomBetween(random, displaySize * minRatio, displaySize * maxRatio);
}

function randomFlameCrossAxisPosition(random: () => number, displaySize: number, span: number): number {
  const max = Math.max(0, displaySize - span);
  return randomBetween(random, 0, max);
}

export function createPlaygroundFlame(
  state: PlaygroundFlamesState,
  config: PlaygroundFlamesConfig,
  displayWidth: number,
  displayHeight: number,
): PlaygroundFlame {
  const width = randomFlameSpan(state.random, displayWidth, config.minWidthRatio, config.maxWidthRatio);
  const height = randomFlameSpan(state.random, displayHeight, config.minHeightRatio, config.maxHeightRatio);
  const speedRange = resolveFlamesSpeedRange(config);
  const speedPxPerSec = randomBetween(state.random, speedRange.minPxPerSec, speedRange.maxPxPerSec);

  if (isVerticalPlaygroundFlamesDirection(config.direction)) {
    return {
      x: randomFlameCrossAxisPosition(state.random, displayWidth, width),
      y: 0,
      width,
      height,
      speedPxPerSec,
    };
  }

  return {
    x: 0,
    y: randomFlameCrossAxisPosition(state.random, displayHeight, height),
    width,
    height,
    speedPxPerSec,
  };
}

function placeSpawnedPlaygroundFlame(
  flame: PlaygroundFlame,
  direction: PlaygroundFlamesDirection,
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

function placeSeededPlaygroundFlame(
  flame: PlaygroundFlame,
  direction: PlaygroundFlamesDirection,
  displayWidth: number,
  displayHeight: number,
  random: () => number,
): void {
  if (isVerticalPlaygroundFlamesDirection(direction)) {
    flame.y = randomBetween(random, -flame.height, displayHeight);
    return;
  }
  flame.x = randomBetween(random, -flame.width, displayWidth);
}

export function spawnPlaygroundFlame(
  state: PlaygroundFlamesState,
  config: PlaygroundFlamesConfig,
  displayWidth: number,
  displayHeight: number,
): PlaygroundFlame {
  const flame = createPlaygroundFlame(state, config, displayWidth, displayHeight);
  placeSpawnedPlaygroundFlame(flame, config.direction, displayWidth, displayHeight);
  return flame;
}

function seedPlaygroundFlames(
  state: PlaygroundFlamesState,
  config: PlaygroundFlamesConfig,
  displayWidth: number,
  displayHeight: number,
): void {
  if (!config.enabled || state.flames.length > 0 || displayWidth <= 0 || displayHeight <= 0) {
    return;
  }

  for (let i = 0; i < config.maxActive; i++) {
    const flame = createPlaygroundFlame(state, config, displayWidth, displayHeight);
    placeSeededPlaygroundFlame(flame, config.direction, displayWidth, displayHeight, state.random);
    state.flames.push(flame);
  }
}

export function stepPlaygroundFlames(
  state: PlaygroundFlamesState,
  config: PlaygroundFlamesConfig,
  display: { width: number; height: number },
  nowMs: number,
): void {
  if (!config.enabled || display.width <= 0 || display.height <= 0) {
    return;
  }

  if (state.lastStepMs <= 0) {
    state.lastStepMs = nowMs;
    state.lastSpawnMs = nowMs;
    seedPlaygroundFlames(state, config, display.width, display.height);
    return;
  }

  const dtSec = Math.max(0, (nowMs - state.lastStepMs) / 1000);
  state.lastStepMs = nowMs;

  for (const flame of state.flames) {
    switch (config.direction) {
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
  state.flames = state.flames.filter((flame) => isPlaygroundFlameVisible(flame, config.direction, display));
  if (state.flames.length > config.maxActive) {
    state.flames.length = config.maxActive;
  }

  const spawnInterval =
    config.spawnIntervalMs + randomBetween(state.random, -config.spawnJitterMs, config.spawnJitterMs);
  if (state.flames.length < config.maxActive && nowMs - state.lastSpawnMs >= spawnInterval) {
    state.flames.push(spawnPlaygroundFlame(state, config, display.width, display.height));
    state.lastSpawnMs = nowMs;
  }
}

function isPlaygroundFlameVisible(
  flame: PlaygroundFlame,
  direction: PlaygroundFlamesDirection,
  display: { width: number; height: number },
): boolean {
  switch (direction) {
    case "up":
      return flame.y + flame.height >= 0;
    case "down":
      return flame.y <= display.height;
    case "left":
      return flame.x + flame.width >= 0;
    case "right":
      return flame.x <= display.width;
  }
}

export function drawPlaygroundFlames(
  ctx: CanvasRenderingContext2D,
  state: PlaygroundFlamesState,
  config: PlaygroundFlamesConfig,
  _displayWidth: number,
  _displayHeight: number,
): void {
  if (!config.enabled || state.flames.length === 0) {
    return;
  }

  const { inner, outer } = resolveFlamesGradientStops(config.edgeSharpness);
  const previousComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";

  for (const flame of state.flames) {
    const gradient = isVerticalPlaygroundFlamesDirection(config.direction)
      ? ctx.createLinearGradient(flame.x, flame.y, flame.x + flame.width, flame.y)
      : ctx.createLinearGradient(flame.x, flame.y, flame.x, flame.y + flame.height);
    gradient.addColorStop(0, PLAYGROUND_FLAMES_COLOR_TRANSPARENT);
    gradient.addColorStop(inner, PLAYGROUND_FLAMES_COLOR);
    gradient.addColorStop(outer, PLAYGROUND_FLAMES_COLOR);
    gradient.addColorStop(1, PLAYGROUND_FLAMES_COLOR_TRANSPARENT);
    ctx.fillStyle = gradient;
    ctx.fillRect(flame.x, flame.y, flame.width, flame.height);
  }

  ctx.globalCompositeOperation = previousComposite;
}

export class PlaygroundFlamesOverlay {
  readonly texture: Texture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("2D canvas context unavailable for flames overlay.");
    }
    this.ctx = ctx;
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = "linear";
  }

  resize(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }
    this.canvas.width = width;
    this.canvas.height = height;
    this.texture.source.update();
  }

  sync(state: PlaygroundFlamesState | null, config: PlaygroundFlamesConfig): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    if (state && config.enabled) {
      drawPlaygroundFlames(this.ctx, state, config, width, height);
    }
    this.texture.source.update();
  }

  destroy(): void {
    this.texture.destroy(true);
  }
}
