import { Texture } from "pixi.js";
import {
  resolveFlamesGradientStops,
  resolveFlamesSpeedRange,
  type PlaygroundFlamesConfig,
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

export function createPlaygroundFlamesState(random: () => number = Math.random): PlaygroundFlamesState {
  return {
    flames: [],
    lastSpawnMs: 0,
    lastStepMs: 0,
    random,
  };
}

export function createPlaygroundFlame(
  state: PlaygroundFlamesState,
  config: PlaygroundFlamesConfig,
  displayWidth: number,
  displayHeight: number,
  y = displayHeight,
): PlaygroundFlame {
  const width = randomBetween(
    state.random,
    displayWidth * config.minWidthRatio,
    displayWidth * config.maxWidthRatio,
  );
  const height = randomBetween(
    state.random,
    displayHeight * config.minHeightRatio,
    displayHeight * config.maxHeightRatio,
  );
  const maxX = Math.max(0, displayWidth - width);
  const x = randomBetween(state.random, 0, maxX);
  const speedRange = resolveFlamesSpeedRange(config);
  const speedPxPerSec = randomBetween(state.random, speedRange.minPxPerSec, speedRange.maxPxPerSec);
  return {
    x,
    y,
    width,
    height,
    speedPxPerSec,
  };
}

export function spawnPlaygroundFlame(
  state: PlaygroundFlamesState,
  config: PlaygroundFlamesConfig,
  displayWidth: number,
  displayHeight: number,
): PlaygroundFlame {
  return createPlaygroundFlame(state, config, displayWidth, displayHeight, displayHeight);
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
    flame.y = randomBetween(state.random, -flame.height, displayHeight);
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
    flame.y -= flame.speedPxPerSec * dtSec;
  }
  state.flames = state.flames.filter((flame) => flame.y + flame.height >= 0);
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
    const gradient = ctx.createLinearGradient(flame.x, flame.y, flame.x + flame.width, flame.y);
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
