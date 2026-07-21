import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMET_TRAIL,
  normalizeCometTrail,
  normalizeCursorTrail,
  normalizeEngineConfig,
} from "../config/normalize";
import { parseEngineConfig, serializeEngineConfig } from "../config/serialize";
import type { CometTrailConfig } from "../config/types";
import { cometCaps, cometScale, createCometState, stepComet, type CometState } from "./cometSim";

const CSS_W = 900;
const CSS_H = 600;
const FRAME_MS = 16;

function drive(
  config: CometTrailConfig,
  frames: number,
  cursorAt: (frame: number) => { x: number; y: number } | null,
  state: CometState = createCometState(cometCaps(config), config.seed),
): CometState {
  let now = 1000;
  for (let i = 0; i < frames; i++) {
    stepComet(state, config, cursorAt(i), CSS_W, CSS_H, now);
    now += FRAME_MS;
  }
  return state;
}

function chainSpan(state: CometState): number {
  const last = state.caps.nodeCount - 1;
  return Math.hypot(state.px[last] - state.px[0], state.py[last] - state.py[0]);
}

describe("cometCaps", () => {
  it("mirrors the baked shader array sizes", () => {
    expect(cometCaps(DEFAULT_COMET_TRAIL)).toEqual({ nodeCount: 13, maxEmbers: 210 });
    expect(cometCaps(normalizeCometTrail({ nodeCount: 1, emberMaxCount: 0 }))).toEqual({ nodeCount: 2, maxEmbers: 1 });
    expect(cometCaps(normalizeCometTrail({ nodeCount: 999, emberMaxCount: 9999 }))).toEqual({
      nodeCount: 48,
      maxEmbers: 512,
    });
  });
});

describe("cometScale", () => {
  it("scales with the short side and clamps", () => {
    expect(cometScale(600, 600)).toBeCloseTo(2, 5);
    expect(cometScale(4000, 4000)).toBe(2.5);
    expect(cometScale(60, 60)).toBe(0.5);
  });
});

describe("comet trail normalizer", () => {
  it("defaults to the tuned lab values and clamps out-of-range input", () => {
    expect(normalizeCometTrail({})).toEqual(DEFAULT_COMET_TRAIL);
    expect(normalizeCursorTrail({}).comet).toEqual(DEFAULT_COMET_TRAIL);
    expect(normalizeEngineConfig({}).cursorTrail.comet).toEqual(DEFAULT_COMET_TRAIL);
    expect(normalizeCometTrail({ stretchThinning: 4 }).stretchThinning).toBe(1);
    expect(normalizeCometTrail({ bodyPushPx: -8 }).bodyPushPx).toBe(0);
    expect(normalizeCometTrail({ nodeCount: 7.6 }).nodeCount).toBe(8);
  });

  it("keeps ember ranges ordered", () => {
    const c = normalizeCometTrail({
      emberSpeedMinPxPerSec: 400,
      emberSpeedMaxPxPerSec: 10,
      emberLifetimeMinMs: 2000,
      emberLifetimeMaxMs: 100,
    });
    expect(c.emberSpeedMaxPxPerSec).toBe(400);
    expect(c.emberLifetimeMaxMs).toBe(2000);
  });

  it("accepts comet as a cursor trail type", () => {
    expect(normalizeCursorTrail({ type: "comet" }).type).toBe("comet");
  });

  it("round-trips through serialize/parse", () => {
    const config = normalizeEngineConfig({
      cursorTrail: {
        enabled: true,
        type: "comet" as const,
        comet: normalizeCometTrail({ nodeCount: 20, emberMaxCount: 64, bodyBrightness: 0.5 }),
      },
    });
    const back = parseEngineConfig(serializeEngineConfig(config));
    expect(back.cursorTrail.type).toBe("comet");
    expect(back.cursorTrail.comet.nodeCount).toBe(20);
    expect(back.cursorTrail.comet.emberMaxCount).toBe(64);
    expect(back.cursorTrail.comet.bodyBrightness).toBe(0.5);
    expect(back.cursorTrail.comet).toEqual(config.cursorTrail.comet);
  });
});

describe("stepComet chain", () => {
  it("settles every node onto a resting cursor", () => {
    const state = drive(DEFAULT_COMET_TRAIL, 120, () => ({ x: 400, y: 300 }));
    for (let i = 0; i < state.caps.nodeCount; i++) {
      expect(Math.hypot(state.px[i] - 400, state.py[i] - 300)).toBeLessThan(1);
    }
    expect(chainSpan(state)).toBeLessThan(1);
  });

  it("lags behind and stretches with cursor speed", () => {
    const slow = drive(DEFAULT_COMET_TRAIL, 60, (i) => ({ x: 100 + i * 1, y: 300 }));
    const fast = drive(DEFAULT_COMET_TRAIL, 60, (i) => ({ x: 100 + i * 14, y: 300 }));
    expect(chainSpan(fast)).toBeGreaterThan(chainSpan(slow));
    expect(Math.hypot(fast.px[0] - fast.x, fast.py[0] - fast.y)).toBeGreaterThan(0);
  });

  it("thins the body as it stretches and never exceeds the link limit", () => {
    const sc = cometScale(CSS_W, CSS_H);
    const slow = drive(DEFAULT_COMET_TRAIL, 60, (i) => ({ x: 100 + i, y: 300 }));
    const fast = drive(DEFAULT_COMET_TRAIL, 60, (i) => ({ x: 100 + i * 14, y: 300 }));
    expect(fast.radiusData[0]).toBeLessThan(slow.radiusData[0]);
    for (let i = 1; i < fast.caps.nodeCount; i++) {
      const link = Math.hypot(fast.px[i] - fast.px[i - 1], fast.py[i] - fast.py[i - 1]);
      expect(link).toBeLessThanOrEqual(DEFAULT_COMET_TRAIL.maxLinkPx * sc + 1e-3);
    }
  });

  it("raises presence while moving and decays it back at rest", () => {
    const state = drive(DEFAULT_COMET_TRAIL, 60, (i) => ({ x: 100 + i * 14, y: 300 }));
    expect(state.presence).toBeGreaterThan(0.5);
    drive(DEFAULT_COMET_TRAIL, 400, () => ({ x: 940, y: 300 }), state);
    expect(state.presence).toBeLessThan(0.01);
    expect(state.core).toBeLessThan(0.01);
  });

  it("decays presence to zero once the cursor leaves", () => {
    const state = drive(DEFAULT_COMET_TRAIL, 60, (i) => ({ x: 100 + i * 14, y: 300 }));
    drive(DEFAULT_COMET_TRAIL, 400, () => null, state);
    expect(state.presence).toBeLessThan(0.01);
  });
});

describe("stepComet embers", () => {
  it("sheds embers while moving and respects the cap", () => {
    const config = normalizeCometTrail({ emberMaxCount: 24 });
    const state = drive(config, 90, (i) => ({ x: 100 + i * 14, y: 300 }));
    expect(state.emberCount).toBeGreaterThan(0);
    expect(state.emberCount).toBeLessThanOrEqual(24);
  });

  it("emits more per second at a higher rate knob", () => {
    const slowRate = drive(normalizeCometTrail({ emberRatePerSec: 8 }), 40, (i) => ({ x: 100 + i * 14, y: 300 }));
    const fastRate = drive(normalizeCometTrail({ emberRatePerSec: 200 }), 40, (i) => ({ x: 100 + i * 14, y: 300 }));
    expect(fastRate.emberCount).toBeGreaterThan(slowRate.emberCount);
  });

  it("emits nothing when embers are disabled and expires them at rest", () => {
    const off = drive(normalizeCometTrail({ embersEnabled: false }), 90, (i) => ({ x: 100 + i * 14, y: 300 }));
    expect(off.emberCount).toBe(0);
    const state = drive(DEFAULT_COMET_TRAIL, 90, (i) => ({ x: 100 + i * 14, y: 300 }));
    expect(state.emberCount).toBeGreaterThan(0);
    drive(DEFAULT_COMET_TRAIL, 200, () => null, state);
    expect(state.emberCount).toBe(0);
  });

  it("packs live embers as position, size and normalized age", () => {
    const state = drive(DEFAULT_COMET_TRAIL, 90, (i) => ({ x: 100 + i * 14, y: 300 }));
    for (let i = 0; i < state.emberCount; i++) {
      const o = i * 4;
      expect(Number.isFinite(state.emberData[o])).toBe(true);
      expect(state.emberData[o + 2]).toBeGreaterThan(0);
      expect(state.emberData[o + 3]).toBeGreaterThanOrEqual(0);
      expect(state.emberData[o + 3]).toBeLessThan(1);
    }
  });

  it("is deterministic for a given seed", () => {
    const path = (i: number) => ({ x: 100 + i * 13, y: 300 + i * 2 });
    const a = drive(DEFAULT_COMET_TRAIL, 80, path);
    const b = drive(DEFAULT_COMET_TRAIL, 80, path);
    expect(a.emberCount).toBe(b.emberCount);
    expect([...a.emberData]).toEqual([...b.emberData]);
  });
});
