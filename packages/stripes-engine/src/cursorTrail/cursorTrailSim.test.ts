import { describe, it, expect } from "vitest";
import { createCursorTrailState, setCursorTrailTarget, updateCursorTrail, seededUnit } from "./cursorTrailSim";
import type { CursorTrailConfig } from "../config/types";

const ENABLED_CONFIG: CursorTrailConfig = {
  enabled: true,
  particleRadius: 40,
  particleAlpha: 0.07,
  particleLifeMs: 960,
  particleLifeJitterMs: 100,
  emitterVelocitySmoothing: 0.7,
  particleVelocityScale: 0.01,
  particleTangentVelocity: 1.65,
  particleDamping: 0.96,
  particleSpacingPx: 3,
  maxEmitPerTick: 10,
  spreadMinPx: 1.5,
  spreadMaxPx: 21,
  spinStrength: 0.039,
  densityRadiusMinScale: 0.2,
  densityRadiusLifeScale: 1,
  pushRadiusScale: 2.15,
  pushStrengthPx: 14,
  pushLagPx: 0,
  pushWobblePx: 12,
  pushLeadBlackAlpha: 0,
};

const DISABLED_CONFIG: CursorTrailConfig = { ...ENABLED_CONFIG, enabled: false };

function runSim(path: Array<{ x: number; y: number }>, dtMs: number, config: CursorTrailConfig = ENABLED_CONFIG) {
  const state = createCursorTrailState();
  const allSamples: Array<{ x: number; y: number; alpha: number; radius: number; seed: number; progress: number }[]> =
    [];
  const changedFlags: boolean[] = [];
  for (const pt of path) {
    setCursorTrailTarget(state, pt);
    const { samples, changed } = updateCursorTrail(state, dtMs, config);
    allSamples.push(samples);
    changedFlags.push(changed);
  }
  return { allSamples, changedFlags };
}

describe("seededUnit", () => {
  it("returns values in [0,1)", () => {
    for (let s = 1; s < 20; s++) {
      for (let salt = 1; salt <= 6; salt++) {
        const v = seededUnit(s, salt);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it("is deterministic", () => {
    expect(seededUnit(5, 3)).toBe(seededUnit(5, 3));
    expect(seededUnit(1, 1)).toBe(seededUnit(1, 1));
  });

  it("differs by seed and salt", () => {
    expect(seededUnit(1, 1)).not.toBe(seededUnit(2, 1));
    expect(seededUnit(1, 1)).not.toBe(seededUnit(1, 2));
  });
});

describe("createCursorTrailState", () => {
  it("starts with nextSeed=1 and no drops", () => {
    const state = createCursorTrailState();
    expect(state.nextSeed).toBe(1);
    expect(state.drops).toHaveLength(0);
    expect(state.hasPointer).toBe(false);
    expect(state.target).toBeNull();
    expect(state.clearFramesRemaining).toBe(0);
    expect(state.emitRemainder).toBe(0);
    expect(state.lastEmit).toBeNull();
  });
});

describe("setCursorTrailTarget", () => {
  it("sets hasPointer=true when target provided", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 100, y: 200 });
    expect(state.hasPointer).toBe(true);
    expect(state.target).toEqual({ x: 100, y: 200 });
  });

  it("sets hasPointer=false when null", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 100, y: 200 });
    setCursorTrailTarget(state, null);
    expect(state.hasPointer).toBe(false);
    expect(state.target).toBeNull();
  });

  it("snaps current to target on first pointer arrival", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 50, y: 80 });
    expect(state.current).toEqual({ x: 50, y: 80 });
    expect(state.velocity).toEqual({ x: 0, y: 0 });
    expect(state.lastEmit).toEqual({ x: 50, y: 80 });
  });

  it("does not snap current on subsequent calls", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 50, y: 80 });
    updateCursorTrail(state, 16.67, ENABLED_CONFIG);
    setCursorTrailTarget(state, { x: 100, y: 100 });
    expect(state.current).toEqual({ x: 50, y: 80 });
  });
});

describe("updateCursorTrail — disabled config", () => {
  it("returns empty samples when disabled", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 100, y: 100 });
    const { samples } = updateCursorTrail(state, 16.67, DISABLED_CONFIG);
    expect(samples).toHaveLength(0);
  });

  it("clears drops when disabled", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 0, y: 0 });
    updateCursorTrail(state, 16.67, ENABLED_CONFIG);
    setCursorTrailTarget(state, { x: 100, y: 0 });
    updateCursorTrail(state, 16.67, ENABLED_CONFIG);
    expect(state.drops.length).toBeGreaterThan(0);
    updateCursorTrail(state, 16.67, DISABLED_CONFIG);
    expect(state.drops).toHaveLength(0);
  });

  it("changed=true for CLEAR_REBUILD_FRAMES after drops cleared, then false", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 0, y: 0 });
    updateCursorTrail(state, 16.67, ENABLED_CONFIG);
    setCursorTrailTarget(state, { x: 100, y: 0 });
    updateCursorTrail(state, 16.67, ENABLED_CONFIG);
    updateCursorTrail(state, 16.67, DISABLED_CONFIG);
    const { changed: c1 } = updateCursorTrail(state, 16.67, DISABLED_CONFIG);
    expect(c1).toBe(true);
    for (let i = 0; i < 8; i++) {
      updateCursorTrail(state, 16.67, DISABLED_CONFIG);
    }
    const { changed: cFinal } = updateCursorTrail(state, 16.67, DISABLED_CONFIG);
    expect(cFinal).toBe(false);
  });
});

describe("updateCursorTrail — determinism", () => {
  it("same path → identical samples each run", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ];
    const a = runSim(path, 16.67);
    const b = runSim(path, 16.67);
    expect(a.allSamples).toEqual(b.allSamples);
  });

  it("different path → different samples", () => {
    const path1 = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ];
    const path2 = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 0, y: 100 },
    ];
    const a = runSim(path1, 16.67);
    const b = runSim(path2, 16.67);
    expect(a.allSamples).not.toEqual(b.allSamples);
  });
});

describe("updateCursorTrail — emit count respects maxEmitPerTick", () => {
  it("never emits more than maxEmitPerTick particles per step", () => {
    const state = createCursorTrailState();
    const config: CursorTrailConfig = { ...ENABLED_CONFIG, maxEmitPerTick: 3, particleSpacingPx: 0.5 };
    setCursorTrailTarget(state, { x: 0, y: 0 });
    updateCursorTrail(state, 16.67, config);
    const dropsAfterFirst = state.drops.length;
    expect(dropsAfterFirst).toBeLessThanOrEqual(3);
    setCursorTrailTarget(state, { x: 1000, y: 0 });
    const prevCount = state.drops.length;
    updateCursorTrail(state, 16.67, config);
    const newDrops = state.drops.length - prevCount;
    expect(newDrops).toBeLessThanOrEqual(3);
  });
});

describe("updateCursorTrail — alpha = particleAlpha * life²", () => {
  it("samples have alpha proportional to particleAlpha * life²", () => {
    const state = createCursorTrailState();
    const config: CursorTrailConfig = {
      ...ENABLED_CONFIG,
      particleAlpha: 0.5,
      particleLifeMs: 1000,
      particleLifeJitterMs: 0,
    };
    setCursorTrailTarget(state, { x: 0, y: 0 });
    updateCursorTrail(state, 16.67, config);
    setCursorTrailTarget(state, { x: 10, y: 0 });
    const { samples } = updateCursorTrail(state, 16.67, config);
    for (const s of samples) {
      const life = 1 - s.progress;
      const expectedAlpha = config.particleAlpha * life * life;
      expect(s.alpha).toBeCloseTo(expectedAlpha, 10);
    }
  });
});

describe("updateCursorTrail — moving target produces samples", () => {
  it("produces non-empty samples after moving the cursor", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 0, y: 0 });
    updateCursorTrail(state, 16.67, ENABLED_CONFIG);
    setCursorTrailTarget(state, { x: 100, y: 0 });
    const { samples } = updateCursorTrail(state, 16.67, ENABLED_CONFIG);
    expect(samples.length).toBeGreaterThan(0);
  });

  it("sample positions are near the cursor path", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 0, y: 0 });
    updateCursorTrail(state, 16.67, ENABLED_CONFIG);
    setCursorTrailTarget(state, { x: 50, y: 0 });
    const { samples } = updateCursorTrail(state, 16.67, ENABLED_CONFIG);
    expect(samples.length).toBeGreaterThan(0);
    for (const s of samples) {
      expect(s.x).toBeGreaterThanOrEqual(-30);
      expect(s.x).toBeLessThanOrEqual(80);
    }
  });
});

describe("updateCursorTrail — no pointer, no samples", () => {
  it("returns no samples when target is null", () => {
    const state = createCursorTrailState();
    const { samples, changed } = updateCursorTrail(state, 16.67, ENABLED_CONFIG);
    expect(samples).toHaveLength(0);
    expect(changed).toBe(false);
  });
});
