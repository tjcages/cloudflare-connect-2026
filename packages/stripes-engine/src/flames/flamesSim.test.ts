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
    const config = vortexConfig({ spawnIntervalMs: 5000 });
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

describe("vortex bits", () => {
  const bitsConfig = () =>
    normalizeFlames({
      enabled: true,
      direction: "vortexBits",
      maxActive: 20,
      swirlRate: 3,
      speedVariation: 0,
      opacityMin: 1,
      opacityMax: 1,
    });

  it("scatters pivots across the canvas instead of the center", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, bitsConfig(), DISPLAY, 1);
    const pivots = new Set(state.flames.map((f) => `${Math.round(f.pivotX)},${Math.round(f.pivotY)}`));
    expect(pivots.size).toBeGreaterThan(5);
  });

  it("keeps each bit at a constant orbit radius", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig();
    stepFlames(state, config, DISPLAY, 1);
    const before = state.flames[0].radius;
    stepFlames(state, config, DISPLAY, 201);
    expect(state.flames[0].radius).toBeCloseTo(before);
  });

  it("fades in from zero and expires after its lifetime", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig();
    stepFlames(state, config, DISPLAY, 1);
    const bit = state.flames[0];
    bit.bornMs = 0;
    bit.lifeMs = 1000;
    stepFlames(state, config, DISPLAY, 2);
    expect(state.flames[0].opacity).toBeLessThan(state.flames[0].baseOpacity);

    const identity = state.flames[0];
    stepFlames(state, config, DISPLAY, 5001);
    expect(state.flames).not.toContain(identity);
  });
});

describe("vortex lines", () => {
  const linesConfig = (o = {}) =>
    normalizeFlames({
      enabled: true,
      direction: "vortexLines",
      maxActive: 48,
      swirlRate: 2,
      speedVariation: 0,
      opacityMin: 1,
      opacityMax: 1,
      ...o,
    });

  it("emits snakes as ordered segment runs", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, linesConfig(), DISPLAY, 1);
    expect(state.flames.length).toBeGreaterThan(0);
    state.flames.forEach((f) => {
      expect(f.segCount).toBeGreaterThan(1);
      expect(f.segIndex).toBeLessThan(f.segCount);
    });
    const heads = state.flames.filter((f) => f.segIndex === 0);
    expect(heads.length).toBeGreaterThan(0);
  });

  it("groups each snake's segments on one shared pivot", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, linesConfig(), DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames.filter((f) => f.pivotX === head.pivotX && f.pivotY === head.pivotY);
    expect(mates.length).toBe(head.segCount);
  });

  it("tapers width and opacity from head to tail", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, linesConfig(), DISPLAY, 1);
    stepFlames(state, linesConfig(), DISPLAY, 60);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames
      .filter((f) => f.pivotX === head.pivotX && f.pivotY === head.pivotY)
      .sort((a, b) => a.segIndex - b.segIndex);
    const tail = mates[mates.length - 1];
    expect(tail.width).toBeLessThan(head.width);
    expect(tail.opacity).toBeLessThan(head.opacity);
  });

  it("trails the tail behind the head at a constant arc", () => {
    const state = createFlamesState(seededRandom());
    const config = linesConfig();
    stepFlames(state, config, DISPLAY, 1);
    stepFlames(state, config, DISPLAY, 200);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames
      .filter((f) => f.pivotX === head.pivotX && f.pivotY === head.pivotY)
      .sort((a, b) => a.segIndex - b.segIndex);
    for (let i = 1; i < mates.length; i++) {
      const gap = Math.abs(mates[i - 1].angle - mates[i].angle);
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan(1);
    }
  });

  it("trails the tail opposite the spin so segments sit where the head already passed", () => {
    const state = createFlamesState(seededRandom());
    const config = linesConfig();
    stepFlames(state, config, DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames
      .filter((f) => f.pivotX === head.pivotX && f.pivotY === head.pivotY)
      .sort((a, b) => a.segIndex - b.segIndex);
    const spinSign = Math.sign(head.angVel);
    expect(spinSign).not.toBe(0);
    for (let i = 1; i < mates.length; i++) {
      const stepSign = Math.sign(mates[i].angle - mates[i - 1].angle);
      expect(stepSign).toBe(-spinSign);
    }
  });

  it("expires a whole snake together", () => {
    const state = createFlamesState(seededRandom());
    const config = linesConfig({ spawnIntervalMs: 5000 });
    stepFlames(state, config, DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0);
    const pivotX = head.pivotX;
    stepFlames(state, config, DISPLAY, 9000);
    expect(state.flames.filter((f) => f.pivotX === pivotX).length).toBe(0);
  });

  it("honours the configured segment-count range", () => {
    const state = createFlamesState(seededRandom());
    const config = normalizeFlames({
      enabled: true,
      direction: "vortexLines",
      maxActive: 200,
      lines: { tailMin: 3, tailMax: 3, maxInstances: 6 },
    } as never);
    stepFlames(state, config, DISPLAY, 1);
    state.flames.forEach((f) => expect(f.segCount).toBe(3));
  });

  it("caps by snake instances, not segments", () => {
    const state = createFlamesState(seededRandom());
    const config = normalizeFlames({
      enabled: true,
      direction: "vortexLines",
      maxActive: 200,
      lines: { tailMin: 5, tailMax: 5, maxInstances: 4 },
    } as never);
    stepFlames(state, config, DISPLAY, 1);
    const pivots = new Set(state.flames.map((f) => `${f.pivotX},${f.pivotY}`));
    expect(pivots.size).toBe(4);
    expect(state.flames.length).toBe(20);
  });

  it("draws rotation speed from the configured range", () => {
    const state = createFlamesState(seededRandom());
    const config = normalizeFlames({
      enabled: true,
      direction: "vortexLines",
      lines: { speedMin: 3, speedMax: 3, maxInstances: 8 },
    } as never);
    stepFlames(state, config, DISPLAY, 1);
    state.flames.forEach((f) => expect(Math.abs(f.angVel)).toBeCloseTo(3, 5));
  });

  it("draws lifetime from the configured range", () => {
    const state = createFlamesState(seededRandom());
    const config = normalizeFlames({
      enabled: true,
      direction: "vortexLines",
      lines: { lifeMinMs: 1500, lifeMaxMs: 1500, maxInstances: 6 },
    } as never);
    stepFlames(state, config, DISPLAY, 1);
    state.flames.forEach((f) => expect(f.lifeMs).toBe(1500));
  });

  it("scales stroke and curl radius together", () => {
    const small = createFlamesState(seededRandom());
    const big = createFlamesState(seededRandom());
    const mk = (s: number) =>
      normalizeFlames({
        enabled: true,
        direction: "vortexLines",
        lines: { scaleMin: s, scaleMax: s, maxInstances: 6, tailMin: 5, tailMax: 5 },
      } as never);
    stepFlames(small, mk(0.03), DISPLAY, 1);
    stepFlames(big, mk(0.12), DISPLAY, 1);
    const sHead = small.flames.find((f) => f.segIndex === 0);
    const bHead = big.flames.find((f) => f.segIndex === 0);
    const ratioWidth = bHead.width / sHead.width;
    const ratioRadius = bHead.radius / sHead.radius;
    expect(ratioWidth).toBeGreaterThan(3);
    expect(ratioRadius).toBeCloseTo(ratioWidth, 1);
  });

  it("spawns on the configured interval range", () => {
    const state = createFlamesState(seededRandom());
    const config = normalizeFlames({
      enabled: true,
      direction: "vortexLines",
      lines: {
        intervalMinMs: 1000,
        intervalMaxMs: 1000,
        maxInstances: 40,
        tailMin: 3,
        tailMax: 3,
        lifeMinMs: 100000,
        lifeMaxMs: 100000,
      },
    } as never);
    stepFlames(state, config, DISPLAY, 1);
    const seeded = state.flames.length;
    stepFlames(state, config, DISPLAY, 2);
    expect(state.flames.length).toBe(seeded);
  });
});

describe("vortex center density", () => {
  it("seeds area-uniformly rather than radius-uniformly", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig({ maxActive: 400, spawnIntervalMs: 5000 });
    stepFlames(state, config, DISPLAY, 1);
    const rMax = 0.5 * Math.hypot(DISPLAY.width, DISPLAY.height);
    const inner = state.flames.filter((f) => f.radius < rMax * 0.5).length;
    const ratio = inner / state.flames.length;
    expect(ratio).toBeGreaterThan(0.15);
    expect(ratio).toBeLessThan(0.35);
  });

  it("never seeds a particle on top of the center", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig({ maxActive: 300, spawnIntervalMs: 5000 });
    stepFlames(state, config, DISPLAY, 1);
    const rMax = 0.5 * Math.hypot(DISPLAY.width, DISPLAY.height);
    state.flames.forEach((f) => expect(f.radius).toBeGreaterThan(rMax * 0.02));
  });

  it("spawns onto a ring, not a point", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig({ maxActive: 60, spawnIntervalMs: 20, spawnJitterMs: 0 });
    stepFlames(state, config, DISPLAY, 1);
    const before = new Set(state.flames);
    stepFlames(state, config, DISPLAY, 400);
    const spawned = state.flames.filter((f) => !before.has(f));
    const rMax = 0.5 * Math.hypot(DISPLAY.width, DISPLAY.height);
    expect(spawned.length).toBeGreaterThan(0);
    spawned.forEach((f) => expect(f.radius).toBeGreaterThan(rMax * 0.02));
  });

  it("fades a vortex particle in near the core", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig({ maxActive: 40, opacityMin: 1, opacityMax: 1 });
    stepFlames(state, config, DISPLAY, 1);
    stepFlames(state, config, DISPLAY, 40);
    const rMax = 0.5 * Math.hypot(DISPLAY.width, DISPLAY.height);
    const nearest = state.flames.reduce((a, b) => (a.radius < b.radius ? a : b));
    if (nearest.radius < rMax * 0.25) {
      expect(nearest.opacity).toBeLessThan(nearest.baseOpacity);
    }
    const far = state.flames.filter((f) => f.radius > rMax * 0.6);
    far.forEach((f) => expect(f.opacity).toBeCloseTo(f.baseOpacity, 5));
  });
});
