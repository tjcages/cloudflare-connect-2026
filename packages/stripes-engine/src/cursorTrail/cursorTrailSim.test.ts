import { describe, it, expect } from "vitest";
import {
  createCursorTrailState,
  setCursorTrailTarget,
  updateCursorTrail,
  seededUnit,
  MAX_DT_MS,
} from "./cursorTrailSim";
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

const FPS_SWEEP = [30, 60, 90, 120, 144, 240];

/** Reference-frame dt. Every per-frame constant in the trail is keyed to it. */
const REFERENCE_DT_MS = 16.67;

/**
 * Frames 30..35 of a fixed cursor path stepped at the reference frame, captured
 * from the frame-count-driven sim this replaced. Each row is the sample count
 * followed by (x, y, alpha, radius) for its first three samples. Nothing about
 * the 60fps look may move: this is the reference the whole fix preserves.
 */
const REFERENCE_FRAME_GOLDEN = [
  [
    75, 39.816889374, 117.064575619, 0.01780348, 24.638958055, 42.517091527, 112.822125005, 0.017974978, 23.724212709,
    15.392552059, 133.556473712, 0.016189806, 38.082586874,
  ],
  [
    77, 39.816889374, 117.064575619, 0.016692429, 24.079591091, 42.704877441, 112.863132007, 0.016827447, 23.172279131,
    15.027025923, 133.444704801, 0.015045796, 37.114877221,
  ],
  [
    79, 39.816889374, 117.064575619, 0.015617172, 23.520224127, 42.883914285, 112.908166297, 0.015717764, 22.620345553,
    14.679962382, 133.324843341, 0.013943699, 36.147167567,
  ],
  [
    82, 39.816889374, 117.064575619, 0.014577709, 22.960857163, 43.054427666, 112.956813898, 0.014645928, 22.068411975,
    14.350909727, 133.197822558, 0.012883515, 35.179457914,
  ],
  [
    84, 39.816889374, 117.064575619, 0.013574041, 22.401490199, 43.216646307, 113.008682786, 0.01361194, 21.516478397,
    14.039402779, 133.064526705, 0.011865246, 34.211748261,
  ],
  [
    87, 39.816889374, 117.064575619, 0.012606167, 21.842123235, 43.37080136, 113.063402202, 0.012615799, 20.964544819,
    13.744964865, 132.925792213, 0.01088889, 33.244038608,
  ],
];

/** Steps the golden path for `frames` frames of `dtMs`, digesting each frame the way the golden was captured. */
function digestPath(dtMs: number, frames: number): number[][] {
  const state = createCursorTrailState();
  const out: number[][] = [];
  for (let f = 0; f < frames; f++) {
    const tMs = f * dtMs;
    setCursorTrailTarget(state, { x: 40 + tMs * 0.22, y: 120 + Math.sin(tMs * 0.004) * 60 });
    const { samples } = updateCursorTrail(state, dtMs, ENABLED_CONFIG);
    out.push([samples.length, ...samples.slice(0, 3).flatMap((s) => [s.x, s.y, s.alpha, s.radius])]);
  }
  return out;
}

/** Emitted particles over one second of wall clock, cursor sweeping at 220px/s. */
function emittedPerSecond(fps: number): number {
  const state = createCursorTrailState();
  let emitted = 0;
  for (let f = 0; f < fps; f++) {
    setCursorTrailTarget(state, { x: 40 + ((f * 1000) / fps) * 0.22, y: 120 });
    const before = state.nextSeed;
    updateCursorTrail(state, 1000 / fps, ENABLED_CONFIG);
    emitted += state.nextSeed - before;
  }
  return emitted;
}

/**
 * How far a single particle coasts in one second. Emission is switched off after
 * the seed particle is placed, so the only thing under test is the damping.
 */
function coastDistancePx(fps: number, v0: number): number {
  const state = createCursorTrailState();
  setCursorTrailTarget(state, { x: 0, y: 0 });
  updateCursorTrail(state, REFERENCE_DT_MS, ENABLED_CONFIG);
  const drop = state.drops[0] as unknown as Record<string, number>;
  drop.x = 0;
  drop.y = 0;
  drop.vx = v0;
  drop.vy = 0;
  drop.spin = 0;
  drop.ageMs = 0;
  drop.lifeMs = 1e9;
  state.drops = [state.drops[0]];
  setCursorTrailTarget(state, null);
  state.target = null;
  for (let f = 0; f < fps; f++) updateCursorTrail(state, 1000 / fps, ENABLED_CONFIG);
  return (state.drops[0] as unknown as Record<string, number>).x;
}

/** Smoothed emitter velocity after 100ms at a constant 600px/s, in px per reference frame. */
function emitterVelocityAfter100ms(fps: number): number {
  const state = createCursorTrailState();
  setCursorTrailTarget(state, { x: 0, y: 0 });
  updateCursorTrail(state, 1000 / fps, ENABLED_CONFIG);
  const frames = Math.round(fps * 0.1);
  for (let f = 1; f <= frames; f++) {
    setCursorTrailTarget(state, { x: (600 * f) / fps, y: 0 });
    updateCursorTrail(state, 1000 / fps, ENABLED_CONFIG);
  }
  return state.velocity.x;
}

describe("updateCursorTrail — the reference frame is unchanged", () => {
  it("reproduces the captured 60fps stream exactly", () => {
    const run = digestPath(REFERENCE_DT_MS, 40).slice(30, 36);
    expect(run).toHaveLength(REFERENCE_FRAME_GOLDEN.length);
    for (let i = 0; i < REFERENCE_FRAME_GOLDEN.length; i++) {
      expect(run[i]).toHaveLength(REFERENCE_FRAME_GOLDEN[i].length);
      for (let j = 0; j < REFERENCE_FRAME_GOLDEN[i].length; j++) {
        expect(run[i][j]).toBeCloseTo(REFERENCE_FRAME_GOLDEN[i][j], 6);
      }
    }
  });
});

describe("updateCursorTrail — frame-rate independence", () => {
  it("emits the same particles per second at every frame rate", () => {
    const reference = emittedPerSecond(60);
    for (const fps of FPS_SWEEP) {
      expect(Math.abs(emittedPerSecond(fps) - reference) / reference).toBeLessThan(0.05);
    }
  });

  it("coasts a particle the same distance per second at every frame rate", () => {
    const v0 = 100;
    const reference = coastDistancePx(60, v0);
    for (const fps of FPS_SWEEP) {
      // The residual is explicit-Euler error, bounded well under one reference
      // frame of travel at the launch speed.
      expect(Math.abs(coastDistancePx(fps, v0) - reference)).toBeLessThan(v0);
    }
  });

  it("holds one emitter-velocity time constant at every frame rate", () => {
    const reference = emitterVelocityAfter100ms(60);
    for (const fps of FPS_SWEEP) {
      expect(Math.abs(emitterVelocityAfter100ms(fps) - reference) / reference).toBeLessThan(0.02);
    }
  });

  it("caps a stalled frame instead of teleporting the trail", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 0, y: 0 });
    updateCursorTrail(state, REFERENCE_DT_MS, ENABLED_CONFIG);
    setCursorTrailTarget(state, { x: 400, y: 0 });
    const stalled = updateCursorTrail(state, 5000, ENABLED_CONFIG);
    const capped = createCursorTrailState();
    setCursorTrailTarget(capped, { x: 0, y: 0 });
    updateCursorTrail(capped, REFERENCE_DT_MS, ENABLED_CONFIG);
    setCursorTrailTarget(capped, { x: 400, y: 0 });
    const clamped = updateCursorTrail(capped, MAX_DT_MS, ENABLED_CONFIG);
    expect(stalled.samples.length).toBe(clamped.samples.length);
  });
});
