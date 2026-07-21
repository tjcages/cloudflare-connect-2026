import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTELLATION_TRAIL, normalizeConstellationTrail } from "../config/normalize";
import {
  CONSTELLATION_BASE_STAR_COUNT,
  constellationCaps,
  constellationStarCount,
  createConstellationState,
  stepConstellation,
} from "./constellationSim";

const CSS_W = 800;
const CSS_H = 500;

function run(config = DEFAULT_CONSTELLATION_TRAIL, frames = 40, cursor: { x: number; y: number } | null = null) {
  const caps = constellationCaps(config);
  const state = createConstellationState(caps);
  let now = 1000;
  for (let i = 0; i < frames; i++) {
    stepConstellation(state, config, cursor, CSS_W, CSS_H, now);
    now += 16;
  }
  return state;
}

describe("constellationCaps", () => {
  it("derives a pulse cap from maxLinks", () => {
    expect(constellationCaps(DEFAULT_CONSTELLATION_TRAIL)).toEqual({ maxStars: 64, maxLinks: 48, maxPulses: 20 });
    expect(constellationCaps(normalizeConstellationTrail({ maxLinks: 80 })).maxPulses).toBe(24);
    expect(constellationCaps(normalizeConstellationTrail({ maxLinks: 4 })).maxPulses).toBe(4);
  });
});

describe("constellationStarCount", () => {
  it("scales the base count by starDensity and respects maxStars", () => {
    const caps = constellationCaps(DEFAULT_CONSTELLATION_TRAIL);
    expect(constellationStarCount(DEFAULT_CONSTELLATION_TRAIL, caps)).toBe(CONSTELLATION_BASE_STAR_COUNT);
    expect(constellationStarCount(normalizeConstellationTrail({ starDensity: 0.5 }), caps)).toBe(22);
    expect(constellationStarCount(normalizeConstellationTrail({ starDensity: 4 }), caps)).toBe(caps.maxStars);
  });
});

describe("stepConstellation", () => {
  it("builds a deterministic star set inside the canvas", () => {
    const a = run();
    const b = run();
    expect(a.starCount).toBe(CONSTELLATION_BASE_STAR_COUNT);
    expect([...a.starsX.slice(0, a.starCount)]).toEqual([...b.starsX.slice(0, b.starCount)]);
    for (let i = 0; i < a.starCount; i++) {
      expect(a.starsX[i]).toBeGreaterThan(0);
      expect(a.starsX[i]).toBeLessThan(1);
      expect(a.starsY[i]).toBeGreaterThan(0);
      expect(a.starsY[i]).toBeLessThan(1);
    }
  });

  it("emits no links without a cursor", () => {
    expect(run().lineCount).toBe(0);
  });

  it("forms links around the cursor and dissolves them after it leaves", () => {
    const config = DEFAULT_CONSTELLATION_TRAIL;
    const caps = constellationCaps(config);
    const state = createConstellationState(caps);
    let now = 1000;
    for (let i = 0; i < 60; i++) {
      stepConstellation(state, config, { x: CSS_W / 2, y: CSS_H / 2 }, CSS_W, CSS_H, now);
      now += 16;
    }
    expect(state.lineCount).toBeGreaterThan(0);
    expect(state.lineCount).toBeLessThanOrEqual(caps.maxLinks);
    expect(Math.max(...state.starAct.slice(0, state.starCount))).toBeGreaterThan(0.1);

    for (let i = 0; i < 120; i++) {
      stepConstellation(state, config, null, CSS_W, CSS_H, now);
      now += 16;
    }
    expect(state.lineCount).toBe(0);
    expect(state.pulseCount).toBe(0);
  });

  it("holds links for linkHoldMs before dissolving", () => {
    const config = normalizeConstellationTrail({ linkHoldMs: 4000 });
    const caps = constellationCaps(config);
    const state = createConstellationState(caps);
    let now = 1000;
    for (let i = 0; i < 60; i++) {
      stepConstellation(state, config, { x: CSS_W / 2, y: CSS_H / 2 }, CSS_W, CSS_H, now);
      now += 16;
    }
    const held = state.lineCount;
    for (let i = 0; i < 60; i++) {
      stepConstellation(state, config, null, CSS_W, CSS_H, now);
      now += 16;
    }
    expect(state.lineCount).toBe(held);
  });

  it("emits no pulses when pulses are disabled", () => {
    const config = normalizeConstellationTrail({ pulseEnabled: false });
    const caps = constellationCaps(config);
    const state = createConstellationState(caps);
    let now = 1000;
    for (let i = 0; i < 200; i++) {
      stepConstellation(state, config, { x: CSS_W / 2, y: CSS_H / 2 }, CSS_W, CSS_H, now);
      now += 16;
    }
    expect(state.pulseCount).toBe(0);
  });

  it("keeps link topology stable when only the cursor radius changes", () => {
    const wide = run(normalizeConstellationTrail({ radiusScale: 1.5 }), 4);
    const narrow = run(normalizeConstellationTrail({ radiusScale: 0.05 }), 4);
    expect(wide.graph?.edges.length).toBe(narrow.graph?.edges.length);
    expect(wide.graph?.edges.map((e) => `${e.a}-${e.b}`)).toEqual(narrow.graph?.edges.map((e) => `${e.a}-${e.b}`));
  });

  it("scales the lit cluster extent with the cursor radius", () => {
    const cursor = { x: CSS_W / 2, y: CSS_H / 2 };
    const reach = (radiusScale: number) => {
      const state = run(normalizeConstellationTrail({ radiusScale }), 90, cursor);
      let far = 0;
      for (let i = 0; i < state.lineCount; i++) {
        const ax = state.segData[i * 4] * CSS_W;
        const ay = state.segData[i * 4 + 1] * CSS_H;
        const bx = state.segData[i * 4 + 2] * CSS_W;
        const by = state.segData[i * 4 + 3] * CSS_H;
        far = Math.max(far, Math.hypot(ax - cursor.x, ay - cursor.y), Math.hypot(bx - cursor.x, by - cursor.y));
      }
      return { far, lines: state.lineCount };
    };
    const tight = reach(0.12);
    const mid = reach(0.35);
    const wide = reach(0.8);
    expect(tight.lines).toBeGreaterThan(0);
    expect(mid.lines).toBeGreaterThan(tight.lines);
    expect(wide.lines).toBeGreaterThan(mid.lines);
    expect(mid.far).toBeGreaterThan(tight.far * 1.5);
    expect(wide.far).toBeGreaterThan(mid.far * 1.5);
  });

  it("flashes closed polygons while the cursor sits inside a loop", () => {
    const flashPeak = (config = normalizeConstellationTrail({ radiusScale: 0.6 })) => {
      const caps = constellationCaps(config);
      const state = createConstellationState(caps);
      let now = 1000;
      let peak = 0;
      for (let i = 0; i < 300; i++) {
        stepConstellation(state, config, { x: CSS_W / 2, y: CSS_H / 2 }, CSS_W, CSS_H, now);
        for (let k = 0; k < state.lineCount; k++) peak = Math.max(peak, state.fxData[k * 2 + 1]);
        now += 16;
      }
      return { peak, polygons: state.graph?.polygons.length ?? 0 };
    };
    const on = flashPeak();
    expect(on.polygons).toBeGreaterThan(8);
    expect(on.peak).toBeGreaterThan(0.9);
    const off = flashPeak(normalizeConstellationTrail({ radiusScale: 0.6, polygonFlashEnabled: false }));
    expect(off.peak).toBe(0);
  });
});
