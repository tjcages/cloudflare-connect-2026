import { describe, expect, it } from "vitest";
import { DEFAULT_CLICK_WAVE, DEFAULT_DETONATION_CLICK, normalizeDetonationClick } from "../config/normalize";
import { normalizeEngineConfig } from "../config/normalize";
import { parseEngineConfig, serializeEngineConfig } from "../config/serialize";
import type { DetonationClickConfig } from "../config/types";
import {
  addDetonation,
  createDetonationState,
  debrisReachRatios,
  detonationCaps,
  detonationEventSeconds,
  detonationFlashEase,
  detonationScale,
  stepDetonation,
} from "./detonationSim";

function detonation(patch: Partial<DetonationClickConfig> = {}): DetonationClickConfig {
  return normalizeDetonationClick(patch);
}

function stateFor(config: DetonationClickConfig) {
  return createDetonationState(detonationCaps(config), config.seed);
}

function quantile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(p * (sorted.length - 1))];
}

describe("detonationCaps", () => {
  it("mirrors the knobs that bake shader array sizes", () => {
    expect(detonationCaps(DEFAULT_DETONATION_CLICK)).toEqual({ maxConcurrent: 4, debrisCount: 24 });
    expect(detonationCaps(detonation({ maxConcurrent: 2, debrisCount: 8 }))).toEqual({
      maxConcurrent: 2,
      debrisCount: 8,
    });
    expect(detonationCaps(detonation({ maxConcurrent: 999, debrisCount: 999 }))).toEqual({
      maxConcurrent: 16,
      debrisCount: 96,
    });
  });
});

describe("detonationFlashEase", () => {
  it("is a clamped monotonic ease from 0 to 1", () => {
    expect(detonationFlashEase(-1)).toBe(0);
    expect(detonationFlashEase(0)).toBe(0);
    expect(detonationFlashEase(1)).toBe(1);
    expect(detonationFlashEase(2)).toBe(1);
    let previous = 0;
    for (let i = 1; i <= 20; i++) {
      const value = detonationFlashEase(i / 20);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
    expect(detonationFlashEase(0.5)).toBeGreaterThan(0.5);
  });
});

describe("detonationScale", () => {
  it("scales with the short edge and clamps", () => {
    expect(detonationScale(300, 300)).toBeCloseTo(1, 6);
    expect(detonationScale(600, 900)).toBeCloseTo(2, 6);
    expect(detonationScale(60, 60)).toBe(0.5);
    expect(detonationScale(4000, 4000)).toBe(2.5);
  });
});

describe("stepDetonation", () => {
  it("packs age, seed and flash for each live detonation", () => {
    const config = detonation();
    const state = stateFor(config);
    addDetonation(state, config, 120, 80, 0);
    stepDetonation(state, config, 0.04);
    expect(state.count).toBe(1);
    expect(state.centerData[0]).toBe(120);
    expect(state.centerData[1]).toBe(80);
    expect(state.lifeData[0]).toBeCloseTo(0.04, 6);
    expect(state.lifeData[1]).toBeGreaterThan(1);
    expect(state.lifeData[2]).toBeGreaterThan(0);
    expect(state.lifeData[2]).toBeLessThan(1);
    stepDetonation(state, config, 0.2);
    expect(state.lifeData[2]).toBe(1);
  });

  it("retires a detonation once the longest layer has finished", () => {
    const config = detonation();
    const state = stateFor(config);
    addDetonation(state, config, 10, 10, 0);
    const eventSec = detonationEventSeconds(config);
    expect(eventSec).toBeCloseTo(3.4, 6);
    stepDetonation(state, config, eventSec - 0.05);
    expect(state.count).toBe(1);
    stepDetonation(state, config, eventSec + 0.05);
    expect(state.count).toBe(0);
    expect(state.detonations.length).toBe(0);
  });

  it("never packs more than maxConcurrent and keeps the newest clicks", () => {
    const config = detonation({ maxConcurrent: 3 });
    const state = stateFor(config);
    for (let i = 0; i < 9; i++) addDetonation(state, config, i * 10, 0, i * 0.01);
    expect(state.detonations.length).toBe(3);
    stepDetonation(state, config, 0.1);
    expect(state.count).toBe(3);
    expect(state.centerData[0]).toBe(60);
    expect(state.centerData[4]).toBe(80);
    expect(state.spawnCount).toBe(9);
  });

  it("is deterministic per seed and differs across seeds", () => {
    const run = (seed: number) => {
      const config = detonation({ seed });
      const state = stateFor(config);
      for (let i = 0; i < 4; i++) addDetonation(state, config, i, i, i * 0.05);
      stepDetonation(state, config, 0.3);
      return Array.from(state.lifeData);
    };
    expect(run(1)).toEqual(run(1));
    expect(run(1)).not.toEqual(run(2));
  });
});

describe("debris ballistics", () => {
  it("lands debris out near the ring reach", () => {
    const config = detonation();
    const ratios: number[] = [];
    for (let i = 0; i < 200; i++) ratios.push(...debrisReachRatios(config, 1 + (i / 200) * 96));
    expect(quantile(ratios, 0.5)).toBeGreaterThan(0.98);
    expect(quantile(ratios, 0.5)).toBeLessThan(1.12);
    expect(quantile(ratios, 0.1)).toBeGreaterThan(0.9);
    expect(quantile(ratios, 0.9)).toBeLessThan(1.28);
    expect(Math.min(...ratios)).toBeGreaterThan(0.8);
    expect(Math.max(...ratios)).toBeLessThan(1.5);
  });

  it("holds the ring-relative reach when everything is resolution scaled", () => {
    const config = detonation();
    const unit = debrisReachRatios(config, 12.5, 1);
    const scaled = debrisReachRatios(config, 12.5, 2.5);
    for (let i = 0; i < unit.length; i++) expect(scaled[i]).toBeCloseTo(unit[i], 6);
  });

  it("moves reach with speed, drag and lifetime", () => {
    const base = quantile(debrisReachRatios(detonation(), 12.5), 0.5);
    expect(quantile(debrisReachRatios(detonation({ debrisSpeedPxPerSec: 600 }), 12.5), 0.5)).toBeGreaterThan(base);
    expect(quantile(debrisReachRatios(detonation({ debrisDrag: 4 }), 12.5), 0.5)).toBeLessThan(base);
    expect(quantile(debrisReachRatios(detonation({ debrisLifetimeMs: 300 }), 12.5), 0.5)).toBeLessThan(base);
    expect(quantile(debrisReachRatios(detonation({ ringReachPx: 400 }), 12.5), 0.5)).toBeLessThan(base);
  });

  it("emits nothing when debris are switched off", () => {
    expect(debrisReachRatios(detonation({ debrisCount: 0 }), 12.5)).toEqual([]);
  });
});

describe("clickWave.detonation config", () => {
  it("defaults and clamps", () => {
    expect(normalizeDetonationClick({})).toEqual(DEFAULT_DETONATION_CLICK);
    expect(normalizeDetonationClick(undefined)).toEqual(DEFAULT_DETONATION_CLICK);
    expect(normalizeEngineConfig({}).clickWave.detonation).toEqual(DEFAULT_DETONATION_CLICK);
    expect(normalizeEngineConfig({}).clickWave.type).toBe("default");
    expect(DEFAULT_CLICK_WAVE.detonation).toEqual(DEFAULT_DETONATION_CLICK);
    expect(normalizeDetonationClick({ maxConcurrent: 4.6 }).maxConcurrent).toBe(5);
    expect(normalizeDetonationClick({ debrisCount: -5 }).debrisCount).toBe(0);
    expect(normalizeDetonationClick({ debrisSpeedVariation: 3 }).debrisSpeedVariation).toBe(1);
    expect(normalizeDetonationClick({ ringRefractionPx: -20 }).ringRefractionPx).toBe(0);
    expect(normalizeDetonationClick({ craterLifeMs: 99_999 }).craterLifeMs).toBe(20_000);
    expect(normalizeDetonationClick({ seed: 7.4 }).seed).toBe(7);
  });

  it("keeps unknown click wave types on default and accepts detonation", () => {
    expect(normalizeEngineConfig({ clickWave: { type: "nope" } as never }).clickWave.type).toBe("default");
    expect(normalizeEngineConfig({ clickWave: { type: "detonation" } }).clickWave.type).toBe("detonation");
  });

  it("round-trips through serialize/parse", () => {
    const config = normalizeEngineConfig({
      clickWave: {
        enabled: true,
        type: "detonation",
        detonation: { maxConcurrent: 6, debrisCount: 40, ringReachPx: 240, craterDepth: 1.6, seed: 42 },
      },
    });
    const back = parseEngineConfig(serializeEngineConfig(config));
    expect(back.clickWave).toEqual(config.clickWave);
    expect(back.clickWave.type).toBe("detonation");
    expect(back.clickWave.detonation.maxConcurrent).toBe(6);
    expect(back.clickWave.detonation.debrisCount).toBe(40);
    expect(back.clickWave.detonation.ringReachPx).toBe(240);
    expect(back.clickWave.detonation.craterDepth).toBe(1.6);
    expect(back.clickWave.detonation.seed).toBe(42);
  });
});
