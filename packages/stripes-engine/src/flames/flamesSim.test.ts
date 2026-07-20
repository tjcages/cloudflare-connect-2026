import { describe, it, expect } from "vitest";
import {
  createFlamesState,
  stepFlames,
  flamesGradientStops,
  flamesSpeedRange,
  isVerticalFlamesDirection,
  isVortexFlamesDirection,
} from "./flamesSim";
import { mulberry32 } from "../core/rng";
import { normalizeFlames } from "../config/normalize";
import type { FlamesConfig } from "../config/types";

const BASE_CONFIG: FlamesConfig = {
  enabled: true,
  direction: "up",
  minWidthRatio: 0.02,
  maxWidthRatio: 0.05,
  minHeightRatio: 0.02,
  maxHeightRatio: 0.08,
  baseSpeedPxPerSec: 40,
  speedVariation: 1,
  spawnIntervalMs: 50,
  spawnJitterMs: 80,
  maxActive: 10,
  edgeSharpness: 1,
  opacityMin: 0.3,
  opacityMax: 1,
};

const DISPLAY = { width: 1000, height: 800 };

describe("mulberry32", () => {
  it("produces values in [0,1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic for a given seed", () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("differs across seeds", () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)());
  });
});

describe("createFlamesState", () => {
  it("returns empty flames and zero timestamps", () => {
    const state = createFlamesState(mulberry32(1));
    expect(state.flames).toHaveLength(0);
    expect(state.lastSpawnMs).toBe(0);
    expect(state.lastStepMs).toBe(0);
  });
});

describe("stepFlames — seeding", () => {
  it("first stepFlames seeds exactly maxActive flames", () => {
    const state = createFlamesState(mulberry32(1));
    stepFlames(state, BASE_CONFIG, DISPLAY, 0);
    expect(state.flames).toHaveLength(BASE_CONFIG.maxActive);
  });

  it("seeded flames are deterministic for the same seed", () => {
    const s1 = createFlamesState(mulberry32(1));
    const s2 = createFlamesState(mulberry32(1));
    stepFlames(s1, BASE_CONFIG, DISPLAY, 0);
    stepFlames(s2, BASE_CONFIG, DISPLAY, 0);
    expect(s1.flames).toEqual(s2.flames);
  });

  it("two different seeds produce different flame positions", () => {
    const s1 = createFlamesState(mulberry32(1));
    const s2 = createFlamesState(mulberry32(2));
    stepFlames(s1, BASE_CONFIG, DISPLAY, 0);
    stepFlames(s2, BASE_CONFIG, DISPLAY, 0);
    const pos1 = s1.flames.map((f) => f.y);
    const pos2 = s2.flames.map((f) => f.y);
    expect(pos1).not.toEqual(pos2);
  });

  it("first step returns without moving (seed only)", () => {
    const state = createFlamesState(mulberry32(1));
    stepFlames(state, BASE_CONFIG, DISPLAY, 500);
    expect(state.lastStepMs).toBe(500);
    expect(state.flames).toHaveLength(BASE_CONFIG.maxActive);
  });
});

describe("stepFlames — movement", () => {
  it("moves flames upward after +1000ms", () => {
    const state = createFlamesState(mulberry32(1));
    stepFlames(state, BASE_CONFIG, DISPLAY, 1);
    const snapshots = state.flames.map((f) => ({ ref: f, y0: f.y }));
    stepFlames(state, BASE_CONFIG, DISPLAY, 1001);
    const survivors = snapshots.filter(({ ref }) => state.flames.includes(ref));
    expect(survivors.length).toBeGreaterThan(0);
    const allMovedUp = survivors.every(({ ref, y0 }) => ref.y < y0);
    expect(allMovedUp).toBe(true);
  });

  it("never exceeds maxActive after a move step", () => {
    const state = createFlamesState(mulberry32(1));
    stepFlames(state, BASE_CONFIG, DISPLAY, 1);
    stepFlames(state, BASE_CONFIG, DISPLAY, 1001);
    expect(state.flames.length).toBeLessThanOrEqual(BASE_CONFIG.maxActive);
  });

  it("moves right-direction flames rightward", () => {
    const config: FlamesConfig = { ...BASE_CONFIG, direction: "right" };
    const state = createFlamesState(mulberry32(5));
    stepFlames(state, config, DISPLAY, 1);
    const snapshots = state.flames.map((f) => ({ ref: f, x0: f.x }));
    stepFlames(state, config, DISPLAY, 1001);
    const survivors = snapshots.filter(({ ref }) => state.flames.includes(ref));
    expect(survivors.length).toBeGreaterThan(0);
    const allMovedRight = survivors.every(({ ref, x0 }) => ref.x > x0);
    expect(allMovedRight).toBe(true);
  });
});

describe("stepFlames — disabled / edge cases", () => {
  it("does nothing when config.enabled is false", () => {
    const config: FlamesConfig = { ...BASE_CONFIG, enabled: false };
    const state = createFlamesState(mulberry32(1));
    stepFlames(state, config, DISPLAY, 0);
    expect(state.flames).toHaveLength(0);
  });

  it("does nothing when display has zero width", () => {
    const state = createFlamesState(mulberry32(1));
    stepFlames(state, BASE_CONFIG, { width: 0, height: 800 }, 0);
    expect(state.flames).toHaveLength(0);
  });

  it("does nothing when display has zero height", () => {
    const state = createFlamesState(mulberry32(1));
    stepFlames(state, BASE_CONFIG, { width: 1000, height: 0 }, 0);
    expect(state.flames).toHaveLength(0);
  });
});

describe("flamesGradientStops", () => {
  it("sharpness=1 → inner≈0.44, outer≈0.56", () => {
    const { inner, outer } = flamesGradientStops(1);
    expect(inner).toBeCloseTo(0.44);
    expect(outer).toBeCloseTo(0.56);
  });

  it("sharpness=0 → inner≈0.1, outer≈0.9", () => {
    const { inner, outer } = flamesGradientStops(0);
    expect(inner).toBeCloseTo(0.1);
    expect(outer).toBeCloseTo(0.9);
  });
});

describe("flamesSpeedRange", () => {
  it("{base:40,variation:1} → {min:20,max:60}", () => {
    const config: FlamesConfig = { ...BASE_CONFIG, baseSpeedPxPerSec: 40, speedVariation: 1 };
    const { minPxPerSec, maxPxPerSec } = flamesSpeedRange(config);
    expect(minPxPerSec).toBe(20);
    expect(maxPxPerSec).toBe(60);
  });

  it("min is at least 1", () => {
    const config: FlamesConfig = { ...BASE_CONFIG, baseSpeedPxPerSec: 1, speedVariation: 1 };
    const { minPxPerSec } = flamesSpeedRange(config);
    expect(minPxPerSec).toBeGreaterThanOrEqual(1);
  });
});

describe("isVerticalFlamesDirection", () => {
  it("up and down are vertical", () => {
    expect(isVerticalFlamesDirection("up")).toBe(true);
    expect(isVerticalFlamesDirection("down")).toBe(true);
  });

  it("left and right are not vertical", () => {
    expect(isVerticalFlamesDirection("left")).toBe(false);
    expect(isVerticalFlamesDirection("right")).toBe(false);
  });
});

const DISPLAY_VORTEX = { width: 800, height: 600 };

function vortexConfig(overrides = {}) {
  return normalizeFlames({
    enabled: true,
    direction: "vortex",
    maxActive: 12,
    baseSpeedPxPerSec: 100,
    speedVariation: 0,
    swirlRate: 2,
    ...overrides,
  });
}

function seededRandom() {
  let s = 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("isVortexFlamesDirection", () => {
  it("is true only for the vortex family", () => {
    expect(isVortexFlamesDirection("vortex")).toBe(true);
    expect(isVortexFlamesDirection("vortexBits")).toBe(true);
    expect(isVortexFlamesDirection("up")).toBe(false);
    expect(isVortexFlamesDirection("leftRight")).toBe(false);
  });
});

describe("vortex motion", () => {
  it("seeds particles and grows their radius outward", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig();
    stepFlames(state, config, DISPLAY_VORTEX, 1);
    expect(state.flames.length).toBe(12);
    const before = state.flames.map((f) => f.radius);
    stepFlames(state, config, DISPLAY_VORTEX, 101);
    state.flames.forEach((f, i) => {
      expect(f.radius).toBeGreaterThan(before[i]);
    });
  });

  it("shrinks radius when inward", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig({ inward: true, spawnIntervalMs: 5000 });
    stepFlames(state, config, DISPLAY_VORTEX, 1);
    const before = state.flames.map((f) => f.radius);
    stepFlames(state, config, DISPLAY_VORTEX, 51);
    state.flames.forEach((f, i) => {
      expect(f.radius).toBeLessThan(before[i]);
    });
  });

  it("advances the angle so the path curves", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig();
    stepFlames(state, config, DISPLAY_VORTEX, 1);
    const before = state.flames[0].angle;
    stepFlames(state, config, DISPLAY_VORTEX, 501);
    expect(state.flames[0].angle).not.toBeCloseTo(before);
  });

  it("keeps rot at zero for linear directions", () => {
    const state = createFlamesState(seededRandom());
    const config = normalizeFlames({ enabled: true, direction: "up", maxActive: 5 });
    stepFlames(state, config, DISPLAY_VORTEX, 0);
    state.flames.forEach((f) => expect(f.rot).toBe(0));
  });

  it("culls outward particles once past the rim", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig({ baseSpeedPxPerSec: 500, spawnIntervalMs: 5000 });
    stepFlames(state, config, DISPLAY_VORTEX, 1);
    stepFlames(state, config, DISPLAY_VORTEX, 3001);
    expect(state.flames.length).toBe(0);
  });
});
