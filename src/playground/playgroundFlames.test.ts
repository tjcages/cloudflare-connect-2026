import { describe, expect, it } from "vitest";
import {
  createPlaygroundFlamesState,
  drawPlaygroundFlames,
  spawnPlaygroundFlame,
  stepPlaygroundFlames,
} from "./playgroundFlames";
import {
  DEFAULT_PLAYGROUND_FLAMES_CONFIG,
  resolveFlamesSpeedRange,
  type PlaygroundFlamesConfig,
} from "./playgroundFlamesConfig";

function createSeededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

const config: PlaygroundFlamesConfig = DEFAULT_PLAYGROUND_FLAMES_CONFIG;
const speedRange = resolveFlamesSpeedRange(config);

describe("playgroundFlames", () => {
  it("spawns a flame at the bottom edge with random width and x", () => {
    const state = createPlaygroundFlamesState(createSeededRandom(42));
    const flame = spawnPlaygroundFlame(state, config, 400, 300);

    expect(flame.y).toBe(300);
    expect(flame.x).toBeGreaterThanOrEqual(0);
    expect(flame.x + flame.width).toBeLessThanOrEqual(400);
    expect(flame.width).toBeGreaterThanOrEqual(400 * config.minWidthRatio);
    expect(flame.width).toBeLessThanOrEqual(400 * config.maxWidthRatio);
    expect(flame.height).toBeGreaterThanOrEqual(300 * config.minHeightRatio);
    expect(flame.height).toBeLessThanOrEqual(300 * config.maxHeightRatio);
    expect(flame.speedPxPerSec).toBeGreaterThanOrEqual(speedRange.minPxPerSec);
    expect(flame.speedPxPerSec).toBeLessThanOrEqual(speedRange.maxPxPerSec);
  });

  it("assigns independent random speeds to each flame", () => {
    const state = createPlaygroundFlamesState(createSeededRandom(99));
    stepPlaygroundFlames(state, config, { width: 400, height: 300 }, 1000);

    const speeds = new Set(state.flames.map((flame) => flame.speedPxPerSec));
    expect(speeds.size).toBeGreaterThan(1);
  });

  it("seeds flames across the canvas on first step so they are visible immediately", () => {
    const state = createPlaygroundFlamesState(createSeededRandom(11));

    stepPlaygroundFlames(state, config, { width: 400, height: 300 }, 1000);

    expect(state.flames).toHaveLength(config.maxActive);
    expect(state.flames.some((flame) => flame.y < 300)).toBe(true);
    expect(state.flames.some((flame) => flame.y < 150)).toBe(true);
  });

  it("moves flames upward over time", () => {
    const state = createPlaygroundFlamesState(createSeededRandom(7));
    state.flames.push(spawnPlaygroundFlame(state, config, 400, 300));

    stepPlaygroundFlames(state, config, { width: 400, height: 300 }, 1000);
    const initialY = state.flames[0]!.y;

    stepPlaygroundFlames(state, config, { width: 400, height: 300 }, 1500);
    expect(state.flames[0]!.y).toBeLessThan(initialY);
  });

  it("removes flames once they rise above the canvas", () => {
    const state = createPlaygroundFlamesState(createSeededRandom(3));
    state.flames.push({
      x: 10,
      y: -50,
      width: 80,
      height: 40,
      speedPxPerSec: 120,
    });
    state.lastStepMs = 1000;
    state.lastSpawnMs = 10_000;

    stepPlaygroundFlames(state, config, { width: 400, height: 300 }, 1100);

    expect(state.flames).toHaveLength(0);
  });

  it("drawPlaygroundFlames does not throw on an empty pool", () => {
    const state = createPlaygroundFlamesState();
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");
    expect(ctx).not.toBeNull();

    expect(() => drawPlaygroundFlames(ctx!, state, config, 100, 80)).not.toThrow();
  });

  it("does not step when flames are disabled", () => {
    const state = createPlaygroundFlamesState(createSeededRandom(5));
    const disabled = { ...config, enabled: false };

    stepPlaygroundFlames(state, disabled, { width: 400, height: 300 }, 1000);

    expect(state.flames).toHaveLength(0);
  });
});
