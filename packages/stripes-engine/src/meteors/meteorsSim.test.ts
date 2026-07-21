import { describe, expect, it } from "vitest";
import { DEFAULT_BACKGROUND_METEORS, normalizeBackgroundMeteors } from "../config/normalize";
import { parseEngineConfig, serializeEngineConfig } from "../config/serialize";
import { normalizeEngineConfig } from "../config/normalize";
import type { BackgroundMeteors } from "../config/types";
import { createMeteorsState, meteorEnvelope, meteorsCaps, stepMeteors } from "./meteorsSim";

const CSS_W = 900;
const CSS_H = 600;
const FRAME_SEC = 1 / 60;

function enabled(patch: Partial<BackgroundMeteors> = {}): BackgroundMeteors {
  return normalizeBackgroundMeteors({ ...patch, enabled: true });
}

function run(config: BackgroundMeteors, seconds: number, sample?: (count: number, timeSec: number) => void) {
  const state = createMeteorsState(meteorsCaps(config), config.seed);
  const frames = Math.round(seconds / FRAME_SEC);
  for (let i = 1; i <= frames; i++) {
    const timeSec = i * FRAME_SEC;
    stepMeteors(state, config, CSS_W, CSS_H, timeSec);
    sample?.(state.count, timeSec);
  }
  return state;
}

describe("meteorsCaps", () => {
  it("mirrors maxActive as the baked shader array size", () => {
    expect(meteorsCaps(DEFAULT_BACKGROUND_METEORS)).toEqual({ maxActive: 36 });
    expect(meteorsCaps(normalizeBackgroundMeteors({ maxActive: 3 }))).toEqual({ maxActive: 3 });
    expect(meteorsCaps(normalizeBackgroundMeteors({ maxActive: 999 }))).toEqual({ maxActive: 64 });
  });
});

describe("meteorEnvelope", () => {
  it("eases in and out and is zero outside the lifetime", () => {
    expect(meteorEnvelope(-0.1, 2, 0.08, 0.58)).toBe(0);
    expect(meteorEnvelope(2.1, 2, 0.08, 0.58)).toBe(0);
    expect(meteorEnvelope(0.02, 2, 0.08, 0.58)).toBeLessThan(0.5);
    expect(meteorEnvelope(1, 2, 0.08, 0.58)).toBeCloseTo(1, 5);
    expect(meteorEnvelope(1.95, 2, 0.08, 0.58)).toBeLessThan(0.05);
  });

  it("treats zero fades as instant", () => {
    expect(meteorEnvelope(0, 2, 0, 0)).toBe(1);
    expect(meteorEnvelope(2, 2, 0, 0)).toBe(1);
  });
});

describe("stepMeteors arrivals", () => {
  it("is a continuous Poisson process, not a batch scheduler", () => {
    const config = enabled();
    const state = createMeteorsState(meteorsCaps(config), config.seed);
    const births = new Set<number>();
    const arrivals: number[] = [];
    const frames = Math.round(60 / FRAME_SEC);
    for (let i = 1; i <= frames; i++) {
      stepMeteors(state, config, CSS_W, CSS_H, i * FRAME_SEC);
      for (const meteor of state.meteors) {
        if (births.has(meteor.bornAtSec)) continue;
        births.add(meteor.bornAtSec);
        arrivals.push(meteor.bornAtSec);
      }
    }
    arrivals.sort((a, b) => a - b);
    expect(arrivals.length).toBeGreaterThan(200);

    const onFrameBoundary = arrivals.filter((t) => Math.abs(t / FRAME_SEC - Math.round(t / FRAME_SEC)) < 1e-9);
    expect(onFrameBoundary.length / arrivals.length).toBeLessThan(0.05);

    const gaps: number[] = [];
    for (let i = 1; i < arrivals.length; i++) gaps.push(arrivals[i] - arrivals[i - 1]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((a, b) => a + (b - mean) * (b - mean), 0) / gaps.length;
    const spread = Math.sqrt(variance) / mean;
    expect(mean).toBeGreaterThan(0.1);
    expect(mean).toBeLessThan(0.35);
    expect(spread).toBeGreaterThan(0.4);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.2);
  });

  it("keeps meteors in flight for the whole run at the default rate", () => {
    const config = enabled();
    let emptyFrames = 0;
    let minCount = Infinity;
    run(config, 45, (count, timeSec) => {
      if (timeSec < 1) return;
      if (count === 0) emptyFrames++;
      minCount = Math.min(minCount, count);
    });
    expect(emptyFrames).toBe(0);
    expect(minCount).toBeGreaterThan(0);
  });

  it("increases population monotonically with ratePerSec", () => {
    const average = (ratePerSec: number) => {
      const config = enabled({ ratePerSec });
      let total = 0;
      let samples = 0;
      run(config, 40, (count, timeSec) => {
        if (timeSec < 3) return;
        total += count;
        samples++;
      });
      return total / samples;
    };
    const rates = [0.5, 2, 5, 12, 30];
    const populations = rates.map(average);
    for (let i = 1; i < populations.length; i++) expect(populations[i]).toBeGreaterThan(populations[i - 1]);
  });

  it("never exceeds maxActive and stays deterministic per seed", () => {
    const config = enabled({ ratePerSec: 60, maxActive: 8 });
    let peak = 0;
    const a = run(config, 20, (count) => {
      peak = Math.max(peak, count);
    });
    const b = run(config, 20);
    expect(peak).toBeLessThanOrEqual(8);
    expect(a.meteors.length).toBeLessThanOrEqual(8);
    expect(Array.from(a.originData)).toEqual(Array.from(b.originData));
    expect(run(enabled({ seed: 7 }), 8).spawnCount).not.toBe(run(enabled({ seed: 8 }), 8).spawnCount);
  });

  it("resyncs after a long hidden-tab time jump instead of dumping a batch", () => {
    const config = enabled();
    const state = createMeteorsState(meteorsCaps(config), config.seed);
    for (let i = 1; i <= 60; i++) stepMeteors(state, config, CSS_W, CSS_H, i * FRAME_SEC);
    const before = state.spawnCount;
    stepMeteors(state, config, CSS_W, CSS_H, 120);
    expect(state.spawnCount - before).toBeLessThanOrEqual(12);
    expect(state.count).toBeGreaterThanOrEqual(0);
  });

  it("spawns upstream of the radiant direction for any angle", () => {
    for (const radiantAngleDeg of [35, -35, 120, -150, 0, 90]) {
      const config = enabled({ radiantAngleDeg, angleJitterDeg: 0 });
      const state = run(config, 6);
      const radiant = (radiantAngleDeg * Math.PI) / 180;
      const dirX = Math.cos(radiant);
      const dirY = Math.sin(radiant);
      expect(state.spawnCount).toBeGreaterThan(0);
      for (const meteor of state.meteors) {
        const outside = meteor.spawnX < 0 || meteor.spawnX > 1 || meteor.spawnY < 0 || meteor.spawnY > 1;
        expect(outside).toBe(true);
        const towardX = dirX > 0 ? meteor.spawnX < 1 : dirX < 0 ? meteor.spawnX > 0 : true;
        const towardY = dirY > 0 ? meteor.spawnY < 1 : dirY < 0 ? meteor.spawnY > 0 : true;
        expect(towardX && towardY).toBe(true);
      }
    }
  });

  it("applies shape scales and variation to packed per-meteor data", () => {
    const config = enabled({
      speedScale: 2,
      speedVariation: 0,
      tailLengthScale: 0.5,
      tailLengthVariation: 0,
      thicknessScale: 3,
      thicknessVariation: 0,
      angleJitterDeg: 0,
    });
    const state = run(config, 4);
    expect(state.count).toBeGreaterThan(0);
    for (let i = 0; i < state.count; i++) {
      expect(state.shapeData[i * 4]).toBe(0);
      expect(state.shapeData[i * 4 + 1]).toBeCloseTo(2, 6);
      expect(state.shapeData[i * 4 + 2]).toBeCloseTo(0.5, 6);
      expect(state.shapeData[i * 4 + 3]).toBeCloseTo(3, 6);
      expect(state.originData[i * 4 + 3]).toBeGreaterThan(0);
    }
  });
});

describe("background.meteors config", () => {
  it("defaults and clamps", () => {
    expect(normalizeBackgroundMeteors({})).toEqual(DEFAULT_BACKGROUND_METEORS);
    expect(normalizeBackgroundMeteors(undefined)).toEqual(DEFAULT_BACKGROUND_METEORS);
    expect(normalizeEngineConfig({}).background.meteors).toEqual(DEFAULT_BACKGROUND_METEORS);
    expect(normalizeBackgroundMeteors({ ratePerSec: 0 }).ratePerSec).toBe(0.02);
    expect(normalizeBackgroundMeteors({ ratePerSec: 9999 }).ratePerSec).toBe(120);
    expect(normalizeBackgroundMeteors({ maxActive: 12.6 }).maxActive).toBe(13);
    expect(normalizeBackgroundMeteors({ pushPx: -4 }).pushPx).toBe(0);
    expect(normalizeBackgroundMeteors({ speedVariation: 3 }).speedVariation).toBe(1);
    expect(normalizeBackgroundMeteors({ lifetimeMinMs: 3000, lifetimeMaxMs: 500 }).lifetimeMaxMs).toBe(3000);
    expect(normalizeBackgroundMeteors({ radiantAngleDeg: 999 }).radiantAngleDeg).toBe(180);
  });

  it("round-trips through serialize/parse", () => {
    const config = normalizeEngineConfig({
      background: {
        meteors: { enabled: true, ratePerSec: 9.5, maxActive: 22, radiantAngleDeg: -120, pushPx: 3.25, seed: 42 },
      },
    });
    const back = parseEngineConfig(serializeEngineConfig(config));
    expect(back.background.meteors).toEqual(config.background.meteors);
    expect(back.background.meteors.ratePerSec).toBe(9.5);
    expect(back.background.meteors.maxActive).toBe(22);
    expect(back.background.meteors.seed).toBe(42);
  });
});
