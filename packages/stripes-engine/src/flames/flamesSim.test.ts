import { describe, it, expect } from "vitest";
import {
  createFlamesState,
  stepFlames,
  flamesGradientStops,
  flamesSpeedRange,
  isVerticalFlamesDirection,
  isVortexFlamesDirection,
  vortexBitEnvelope,
} from "./flamesSim";
import type { FlamesState } from "./flamesSim";
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

describe("vortex bits (global snakes)", () => {
  const bitsConfig = (o = {}) =>
    normalizeFlames({
      enabled: true,
      direction: "vortexBits",
      opacityMin: 1,
      opacityMax: 1,
      bits: { maxInstances: 10, tailMin: 5, tailMax: 5, ...o },
    } as never);

  it("emits snakes, not single bars", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, bitsConfig(), DISPLAY, 1);
    expect(state.flames.length).toBeGreaterThan(0);
    state.flames.forEach((f) => expect(f.segCount).toBe(5));
  });

  it("places the pivot on its own orbit ring around the canvas centre", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, bitsConfig(), DISPLAY, 1);
    const cx = DISPLAY.width / 2;
    const cy = DISPLAY.height / 2;
    state.flames.forEach((f) => {
      expect(f.pivotX).toBeCloseTo(cx + Math.cos(f.orbitAngle) * f.orbitRadius, 5);
      expect(f.pivotY).toBeCloseTo(cy + Math.sin(f.orbitAngle) * f.orbitRadius, 5);
    });
  });

  it("spreads snakes across distinct orbit radii", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, bitsConfig(), DISPLAY, 1);
    const radii = new Set(state.flames.map((f) => Math.round(f.orbitRadius)));
    expect(radii.size).toBeGreaterThan(3);
  });

  it("caps by snake instances", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, bitsConfig({ maxInstances: 4, tailMin: 6, tailMax: 6 }), DISPLAY, 1);
    expect(state.flames.length).toBe(24);
  });

  it("caps snake instances across many spawn-gated steps, not just at seed", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig({
      maxInstances: 4,
      tailMin: 3,
      tailMax: 3,
      intervalMinMs: 10,
      intervalMaxMs: 10,
      lifeMinMs: 20000,
      lifeMaxMs: 20000,
    });
    stepFlames(state, config, DISPLAY, 1);
    let now = 1;
    for (let i = 0; i < 40; i++) {
      now += 50;
      stepFlames(state, config, DISPLAY, now);
      const heads = state.flames.filter((f) => f.segIndex === 0).length;
      expect(heads).toBeLessThanOrEqual(4);
    }
    const heads = state.flames.filter((f) => f.segIndex === 0).length;
    expect(heads).toBe(4);
  });

  it("tapers head to tail", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, bitsConfig(), DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames.filter((f) => f.radius === head.radius).sort((a, b) => a.segIndex - b.segIndex);
    expect(mates[mates.length - 1].height).toBeLessThan(head.height);
  });

  it("keeps every segment the same length so the body has no gaps", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig({ tailMin: 12, tailMax: 12 });
    stepFlames(state, config, DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames.filter((f) => f.bornMs === head.bornMs);
    const widths = mates.map((m) => m.width);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(0.001);
  });

  it("still tapers thickness from head to tail", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig({ tailMin: 12, tailMax: 12 });
    stepFlames(state, config, DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames.filter((f) => f.bornMs === head.bornMs).sort((a, b) => a.segIndex - b.segIndex);
    expect(mates[mates.length - 1].height).toBeLessThan(mates[0].height);
    expect(mates[mates.length - 1].height).toBeGreaterThan(0);
  });

  it("curls at its own radius, not its orbit radius", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig({ tailMin: 10, tailMax: 10, scaleMin: 0.05, scaleMax: 0.05 });
    stepFlames(state, config, DISPLAY, 1);
    const heads = state.flames.filter((f) => f.segIndex === 0);
    const radii = heads.map((h) => h.radius);
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.001);
    const orbits = heads.map((h) => h.orbitRadius);
    expect(Math.max(...orbits) - Math.min(...orbits)).toBeGreaterThan(20);
  });

  it("moves the whole snake rigidly along the vortex", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig({ tailMin: 8, tailMax: 8, lifeMinMs: 20000, lifeMaxMs: 20000 });
    stepFlames(state, config, DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0);
    const key = head.bornMs;
    const before = state.flames.filter((f) => f.bornMs === key).map((f) => f.orbitAngle);
    stepFlames(state, config, DISPLAY, 400);
    const after = state.flames.filter((f) => f.bornMs === key).map((f) => f.orbitAngle);
    expect(after[0]).not.toBeCloseTo(before[0], 4);
    after.forEach((a) => expect(a).toBeCloseTo(after[0], 6));
  });

  it("keeps the joint angle small at any scale", () => {
    for (const s of [0.02, 0.2]) {
      const st = createFlamesState(seededRandom());
      const config = bitsConfig({ tailMin: 10, tailMax: 10, scaleMin: s, scaleMax: s });
      stepFlames(st, config, DISPLAY, 1);
      const head = st.flames.find((f) => f.segIndex === 0);
      const mates = st.flames.filter((f) => f.bornMs === head.bornMs).sort((a, b) => a.segIndex - b.segIndex);
      for (let i = 1; i < mates.length; i++) {
        expect(Math.abs(mates[i].angle - mates[i - 1].angle)).toBeLessThan(0.1);
      }
    }
  });

  it("trails the tail opposite the spin when inward, global bits", () => {
    const state = createFlamesState(seededRandom());
    const config = normalizeFlames({
      enabled: true,
      direction: "vortexBits",
      opacityMin: 1,
      opacityMax: 1,
      inward: true,
      bits: { maxInstances: 6, tailMin: 6, tailMax: 6 },
    } as never);
    stepFlames(state, config, DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0)!;
    const mates = state.flames.filter((f) => f.radius === head.radius).sort((a, b) => a.segIndex - b.segIndex);
    const spinSign = Math.sign(head.angVel);
    expect(spinSign).not.toBe(0);
    for (let i = 1; i < mates.length; i++) {
      const stepSign = Math.sign(mates[i].angle - mates[i - 1].angle);
      expect(stepSign).toBe(-spinSign);
    }
  });

  it("trails the tail opposite the spin when outward, global bits", () => {
    const state = createFlamesState(seededRandom());
    const config = normalizeFlames({
      enabled: true,
      direction: "vortexBits",
      opacityMin: 1,
      opacityMax: 1,
      inward: false,
      bits: { maxInstances: 6, tailMin: 6, tailMax: 6 },
    } as never);
    stepFlames(state, config, DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0)!;
    const mates = state.flames.filter((f) => f.radius === head.radius).sort((a, b) => a.segIndex - b.segIndex);
    const spinSign = Math.sign(head.angVel);
    expect(spinSign).not.toBe(0);
    for (let i = 1; i < mates.length; i++) {
      const stepSign = Math.sign(mates[i].angle - mates[i - 1].angle);
      expect(stepSign).toBe(-spinSign);
    }
  });

  it("drifts radially so the population reads as a spiral", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig({ lifeMinMs: 9000, lifeMaxMs: 9000 });
    stepFlames(state, config, DISPLAY, 1);
    const before = state.flames[0].orbitRadius;
    stepFlames(state, config, DISPLAY, 600);
    expect(state.flames[0].orbitRadius).not.toBeCloseTo(before, 3);
  });

  it("expires a whole snake together", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig({ lifeMinMs: 300, lifeMaxMs: 300, intervalMinMs: 5000, intervalMaxMs: 5000 });
    stepFlames(state, config, DISPLAY, 1);
    expect(state.flames.length).toBeGreaterThan(0);
    stepFlames(state, config, DISPLAY, 4000);
    expect(state.flames.length).toBe(0);
  });

  it("scale genuinely drives global snake size", () => {
    const small = createFlamesState(seededRandom());
    const big = createFlamesState(seededRandom());
    const mk = (s: number) => bitsConfig({ scaleMin: s, scaleMax: s, maxInstances: 8, tailMin: 5, tailMax: 5 });
    stepFlames(small, mk(0.02), DISPLAY, 1);
    stepFlames(big, mk(0.08), DISPLAY, 1);
    const avgHeadWidth = (state: FlamesState) => {
      const heads = state.flames.filter((f) => f.segIndex === 0);
      return heads.reduce((sum, f) => sum + f.width, 0) / heads.length;
    };
    const widthRatio = avgHeadWidth(big) / avgHeadWidth(small);
    const scaleRatio = 0.08 / 0.02;
    expect(widthRatio).toBeGreaterThan(scaleRatio * 0.8);
    expect(widthRatio).toBeLessThan(scaleRatio * 1.2);
  });

  it("segment width no longer tracks orbit radius at a fixed scale", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig({ scaleMin: 0.05, scaleMax: 0.05, maxInstances: 14, tailMin: 5, tailMax: 5 });
    stepFlames(state, config, DISPLAY, 1);
    const heads = state.flames.filter((f) => f.segIndex === 0);
    const radii = heads.map((f) => f.orbitRadius);
    const widths = heads.map((f) => f.width);
    const radiusSpread = Math.max(...radii) / Math.min(...radii);
    const widthSpread = Math.max(...widths) / Math.min(...widths);
    expect(radiusSpread).toBeGreaterThan(2);
    expect(widthSpread).toBeLessThan(1.05);
  });

  it("keeps the angular step per segment small enough to read as a curve", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig({ tailMin: 10, tailMax: 10, scaleMin: 0.06, scaleMax: 0.06 });
    stepFlames(state, config, DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames.filter((f) => f.bornMs === head.bornMs).sort((a, b) => a.segIndex - b.segIndex);
    for (let i = 1; i < mates.length; i++) {
      expect(Math.abs(mates[i].angle - mates[i - 1].angle)).toBeLessThan(0.12);
    }
  });

  it("holds full brightness across most of a snake's life", () => {
    expect(vortexBitEnvelope(0.5)).toBeCloseTo(1, 5);
    expect(vortexBitEnvelope(0.2)).toBeCloseTo(1, 5);
    expect(vortexBitEnvelope(0.8)).toBeCloseTo(1, 5);
    expect(vortexBitEnvelope(0)).toBeCloseTo(0, 5);
    expect(vortexBitEnvelope(1)).toBeCloseTo(0, 5);
  });

  it("sustains a full population so the count does not dip", () => {
    const state = createFlamesState(seededRandom());
    const config = normalizeFlames({ enabled: true, direction: "vortexBits" } as never);
    let t = 1;
    stepFlames(state, config, DISPLAY, t);
    let min = Infinity;
    for (let i = 0; i < 600; i++) {
      t += 16.67;
      stepFlames(state, config, DISPLAY, t);
      if (i > 120) min = Math.min(min, state.flames.filter((f) => f.segIndex === 0).length);
    }
    expect(min).toBeGreaterThanOrEqual(config.bits.maxInstances - 1);
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

  it("tapers thickness and opacity from head to tail", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, linesConfig(), DISPLAY, 1);
    stepFlames(state, linesConfig(), DISPLAY, 60);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames
      .filter((f) => f.pivotX === head.pivotX && f.pivotY === head.pivotY)
      .sort((a, b) => a.segIndex - b.segIndex);
    const tail = mates[mates.length - 1];
    expect(tail.height).toBeLessThan(head.height);
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

  it("caps snake instances across many spawn-gated steps, not just at seed", () => {
    const state = createFlamesState(seededRandom());
    const config = normalizeFlames({
      enabled: true,
      direction: "vortexLines",
      maxActive: 200,
      lines: {
        tailMin: 3,
        tailMax: 3,
        maxInstances: 4,
        intervalMinMs: 10,
        intervalMaxMs: 10,
        lifeMinMs: 20000,
        lifeMaxMs: 20000,
      },
    } as never);
    stepFlames(state, config, DISPLAY, 1);
    let now = 1;
    for (let i = 0; i < 40; i++) {
      now += 50;
      stepFlames(state, config, DISPLAY, now);
      const heads = state.flames.filter((f) => f.segIndex === 0).length;
      expect(heads).toBeLessThanOrEqual(4);
    }
    const heads = state.flames.filter((f) => f.segIndex === 0).length;
    expect(heads).toBe(4);
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

  it("more segments span a strictly larger total angular arc, not a fixed one", () => {
    const shortState = createFlamesState(seededRandom());
    const longState = createFlamesState(seededRandom());
    const mk = (tail: number) =>
      normalizeFlames({
        enabled: true,
        direction: "vortexLines",
        lines: { scaleMin: 0.08, scaleMax: 0.08, maxInstances: 6, tailMin: tail, tailMax: tail },
      } as never);
    stepFlames(shortState, mk(4), DISPLAY, 1);
    stepFlames(longState, mk(16), DISPLAY, 1);

    const spanOf = (state: FlamesState) => {
      const head = state.flames.find((f) => f.segIndex === 0)!;
      const mates = state.flames.filter((f) => f.pivotX === head.pivotX && f.pivotY === head.pivotY);
      const tail = mates.reduce((a, b) => (a.segIndex > b.segIndex ? a : b));
      return Math.abs(head.angle - tail.angle);
    };

    const shortSpan = spanOf(shortState);
    const longSpan = spanOf(longState);
    expect(longSpan).toBeGreaterThan(shortSpan);
    const ratio = longSpan / shortSpan;
    expect(ratio).toBeGreaterThan(4);
    expect(ratio).toBeLessThan(6);
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
