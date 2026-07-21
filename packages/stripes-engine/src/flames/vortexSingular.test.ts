import { describe, it, expect } from "vitest";
import { createFlamesState, stepFlames } from "./flamesSim";
import { vortexSingularLifeEnvelope } from "./vortexSingular";
import { mulberry32 } from "../core/rng";
import { DEFAULT_VORTEX_SINGULAR } from "../config/normalize";
import type { FlamesConfig } from "../config/types";

const DISPLAY = { width: 1000, height: 800 };

function makeConfig(overrides: Partial<FlamesConfig["vortexSingular"]> = {}): FlamesConfig {
  return {
    enabled: true,
    direction: "vortexSingular",
    minWidthRatio: 0.02,
    maxWidthRatio: 0.05,
    minHeightRatio: 0.02,
    maxHeightRatio: 0.08,
    baseSpeedPxPerSec: 60,
    speedVariation: 0.5,
    spawnIntervalMs: 50,
    spawnJitterMs: 80,
    maxActive: 6,
    edgeSharpness: 1,
    opacityMin: 0.3,
    opacityMax: 1,
    vortexSingular: { ...DEFAULT_VORTEX_SINGULAR, ...overrides },
  };
}

function run(config: FlamesConfig, seconds: number, state = createFlamesState(mulberry32(7)), startMs = 1000) {
  stepFlames(state, config, DISPLAY, startMs);
  const steps = Math.round(seconds / 0.016);
  for (let i = 1; i <= steps; i++) {
    stepFlames(state, config, DISPLAY, startMs + i * 16);
  }
  return state;
}

describe("stepVortexSingular", () => {
  it("seeds maxActive tails on first step", () => {
    const state = run(makeConfig(), 0);
    expect(state.tails).toHaveLength(6);
  });

  it("emits up to segCount segments per tail once trails are long enough", () => {
    const state = run(makeConfig(), 20);
    expect(state.flames.length).toBeGreaterThan(0);
    expect(state.flames.length).toBeLessThanOrEqual(6 * DEFAULT_VORTEX_SINGULAR.segCount);
    const perTail = new Map<number, number>();
    for (const f of state.flames) {
      perTail.set(f.colorSeed, (perTail.get(f.colorSeed) ?? 0) + 1);
    }
    for (const count of perTail.values()) {
      expect(count).toBeLessThanOrEqual(DEFAULT_VORTEX_SINGULAR.segCount);
    }
  });

  it("always turns and never settles into a fixed-rate circle", () => {
    const config = makeConfig({ lifeMinMs: 60000, lifeMaxMs: 60000 });
    const state = createFlamesState(mulberry32(7));
    stepFlames(state, config, DISPLAY, 1000);
    const tail = state.tails[0];
    const deltas: number[] = [];
    let prev = tail.heading;
    for (let i = 1; i <= 200; i++) {
      stepFlames(state, config, DISPLAY, 1000 + i * 16);
      deltas.push(tail.heading - prev);
      prev = tail.heading;
    }
    for (const d of deltas) expect(d).not.toBe(0);
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const variance = deltas.reduce((a, b) => a + (b - mean) * (b - mean), 0) / deltas.length;
    expect(Math.sqrt(variance)).toBeGreaterThan(1e-5);
  });

  it("keeps segments at constant arc-length spacing", () => {
    const cfg = makeConfig({ lifeMinMs: 60000, lifeMaxMs: 60000, visibleMinMs: 60000, visibleMaxMs: 60000 });
    const state = run(cfg, 20);
    const first = state.flames.filter((f) => f.colorSeed === state.flames[0].colorSeed);
    expect(first.length).toBeGreaterThan(3);
    for (let i = 1; i < first.length; i++) {
      const a = first[i - 1];
      const b = first[i];
      const d = Math.hypot(a.x + a.width * 0.5 - (b.x + b.width * 0.5), a.y + a.height * 0.5 - (b.y + b.height * 0.5));
      expect(d).toBeGreaterThan(cfg.vortexSingular.segSpacingPx * 0.5);
      expect(d).toBeLessThan(cfg.vortexSingular.segSpacingPx * 1.5);
    }
  });

  it("respawns dead tails so the population holds", () => {
    const config = makeConfig({ lifeMinMs: 1000, lifeMaxMs: 1000 });
    const state = run(config, 3);
    expect(state.tails).toHaveLength(6);
    for (const tail of state.tails) {
      expect(state.lastStepMs - tail.bornMs).toBeLessThan(1100);
    }
  });

  it("steers heads back inside the viewport", () => {
    const state = run(makeConfig(), 60);
    const margin = DEFAULT_VORTEX_SINGULAR.edgeMarginRatio * Math.min(DISPLAY.width, DISPLAY.height);
    for (const tail of state.tails) {
      expect(tail.x).toBeGreaterThan(-2 * margin);
      expect(tail.x).toBeLessThan(DISPLAY.width + 2 * margin);
      expect(tail.y).toBeGreaterThan(-2 * margin);
      expect(tail.y).toBeLessThan(DISPLAY.height + 2 * margin);
    }
  });

  it("keeps moving while hidden and emits no segments", () => {
    const config = makeConfig({
      segCount: 5,
      segSpacingPx: 4,
      visibleMinMs: 600,
      visibleMaxMs: 600,
      hiddenMinMs: 800,
      hiddenMaxMs: 800,
      lifeMinMs: 60000,
      lifeMaxMs: 60000,
    });
    const state = createFlamesState(mulberry32(7));
    stepFlames(state, config, DISPLAY, 1000);
    const tail = state.tails[0];
    let sawHidden = false;
    let movedWhileHidden = false;
    let prevX = tail.x;
    let prevY = tail.y;
    for (let i = 1; i <= 400; i++) {
      stepFlames(state, config, DISPLAY, 1000 + i * 16);
      if (tail.hidden) {
        sawHidden = true;
        if (Math.hypot(tail.x - prevX, tail.y - prevY) > 0) movedWhileHidden = true;
        expect(state.flames.some((f) => f.colorSeed === tail.colorSeed)).toBe(false);
      }
      prevX = tail.x;
      prevY = tail.y;
    }
    expect(sawHidden).toBe(true);
    expect(movedWhileHidden).toBe(true);
  });

  it("regrows from the head after reappearing", () => {
    const config = makeConfig({
      segCount: 8,
      segSpacingPx: 6,
      visibleMinMs: 600,
      visibleMaxMs: 600,
      hiddenMinMs: 400,
      hiddenMaxMs: 400,
      lifeMinMs: 60000,
      lifeMaxMs: 60000,
    });
    const state = createFlamesState(mulberry32(7));
    stepFlames(state, config, DISPLAY, 1000);
    const tail = state.tails[0];
    let wasHidden = false;
    let reappearedAt = 0;
    for (let i = 1; i <= 600 && !reappearedAt; i++) {
      stepFlames(state, config, DISPLAY, 1000 + i * 16);
      if (tail.hidden) wasHidden = true;
      else if (wasHidden) reappearedAt = i;
    }
    expect(reappearedAt).toBeGreaterThan(0);
    const countFor = () => state.flames.filter((f) => f.colorSeed === tail.colorSeed).length;
    const early = countFor();
    for (let j = 1; j <= 40; j++) {
      stepFlames(state, config, DISPLAY, 1000 + (reappearedAt + j) * 16);
    }
    const later = countFor();
    expect(later).toBeGreaterThan(early);
    expect(later).toBeLessThanOrEqual(8);
  });
});

describe("vortexSingularLifeEnvelope", () => {
  it("holds full then fades out at end of life", () => {
    expect(vortexSingularLifeEnvelope(0, 10000)).toBe(1);
    expect(vortexSingularLifeEnvelope(5000, 10000)).toBe(1);
    expect(vortexSingularLifeEnvelope(9400, 10000)).toBe(1);
    expect(vortexSingularLifeEnvelope(10000, 10000)).toBe(0);
  });
});
