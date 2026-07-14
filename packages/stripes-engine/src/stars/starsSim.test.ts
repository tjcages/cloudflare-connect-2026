import { describe, it, expect } from "vitest";
import { createStarsState, starsTargetCount, stepStars } from "./starsSim";
import { mulberry32 } from "../core/rng";
import { smooth } from "../core/math";
import type { BackgroundStars } from "../config/types";

const BASE: BackgroundStars = {
  enabled: true,
  density: 50,
  sizePx: 8,
  sizeRandomness: 0.65,
  tiltAngleDeg: 0,
  twinkleSpeed: 1,
  twinkleAmount: 0.7,
  opacity: 0.8,
  color: 0xffffff,
};

describe("starsTargetCount", () => {
  it("returns 0 when disabled or degenerate", () => {
    expect(starsTargetCount({ ...BASE, enabled: false }, { width: 800, height: 600 })).toBe(0);
    expect(starsTargetCount({ ...BASE, density: 0 }, { width: 800, height: 600 })).toBe(0);
    expect(starsTargetCount({ ...BASE, opacity: 0 }, { width: 800, height: 600 })).toBe(0);
    expect(starsTargetCount({ ...BASE, sizePx: 0 }, { width: 800, height: 600 })).toBe(0);
  });
  it("follows round((4 + area*1.9) * density/100) with area = max(1, w*h/8000)", () => {
    const area = (800 * 600) / 8000;
    expect(starsTargetCount(BASE, { width: 800, height: 600 })).toBe(Math.round((4 + area * 1.9) * 0.5));
    expect(starsTargetCount({ ...BASE, density: 100 }, { width: 10, height: 10 })).toBe(Math.round(4 + 1.9));
  });
  it("clamps to 1..360", () => {
    expect(starsTargetCount({ ...BASE, density: 1 }, { width: 10, height: 10 })).toBe(1);
    expect(starsTargetCount({ ...BASE, density: 100 }, { width: 4000, height: 4000 })).toBe(360);
  });
});

describe("stepStars", () => {
  it("populates to the target count and backfills ages on the first step", () => {
    const state = createStarsState(mulberry32(1 ^ 173516199));
    const display = { width: 800, height: 600 };
    stepStars(state, BASE, display, 1000);
    expect(state.stars.length).toBe(starsTargetCount(BASE, display));
    expect(state.stars.some((s) => s.bornMs < 1000)).toBe(true);
    for (const s of state.stars) {
      expect(s.sizePx).toBeGreaterThanOrEqual(0.25);
      expect(s.lifeMs).toBeGreaterThan(0);
    }
  });
  it("clears state when disabled", () => {
    const state = createStarsState(mulberry32(7));
    stepStars(state, BASE, { width: 800, height: 600 }, 1000);
    expect(state.stars.length).toBeGreaterThan(0);
    stepStars(state, { ...BASE, enabled: false }, { width: 800, height: 600 }, 1016);
    expect(state.stars.length).toBe(0);
    expect(state.lastStepMs).toBe(1016);
  });
  it("maintains the population as stars expire", () => {
    const state = createStarsState(mulberry32(42));
    const display = { width: 400, height: 300 };
    stepStars(state, BASE, display, 0);
    for (let t = 16; t <= 5000; t += 16) stepStars(state, BASE, display, t);
    expect(state.stars.length).toBe(starsTargetCount(BASE, display));
  });
});

const SOLO_DISPLAY = { width: 10, height: 10 };

function createSingleStarStateWithBackfillDisabled(random: () => number): ReturnType<typeof createStarsState> {
  const state = createStarsState(random);
  state.lastStepMs = 1;
  return state;
}

describe("updateStar via stepStars: scale/opacity smoothstep envelope windows", () => {
  it("matches smooth(0,0.28,t)*(1-smooth(0.62,1,t)) for scale and smooth(0,0.18,t)*(1-smooth(0.72,1,t))*baseOpacity for opacity, with twinkle neutralized (twinkleAmount 0)", () => {
    const config: BackgroundStars = { ...BASE, density: 1, twinkleAmount: 0, tiltAngleDeg: 0, opacity: 1 };
    const state = createSingleStarStateWithBackfillDisabled(mulberry32(9001));
    const bornAt = 5000;
    stepStars(state, config, SOLO_DISPLAY, bornAt);
    const star = state.stars[0];
    expect(star.bornMs).toBe(bornAt);
    const lifeMs = star.lifeMs;
    const baseOpacity = star.baseOpacity;
    for (const t of [0, 0.1, 0.18, 0.28, 0.45, 0.62, 0.72, 0.9, 0.99]) {
      stepStars(state, config, SOLO_DISPLAY, bornAt + t * lifeMs);
      const expectedScale = smooth(0, 0.28, t) * (1 - smooth(0.62, 1, t));
      const expectedOpacity = smooth(0, 0.18, t) * (1 - smooth(0.72, 1, t)) * baseOpacity;
      expect(state.stars[0].scale).toBeCloseTo(expectedScale, 9);
      expect(state.stars[0].opacity).toBeCloseTo(expectedOpacity, 9);
    }
  });
});

describe("updateStar via stepStars: twinkle modulation bounds at twinkleAmount 1", () => {
  it("scale factor tracks 0.78+0.22*tw and opacity factor tracks 0.65+0.35*tw (tw derived from the star's own phase) for ages 0.45..0.60 of lifeMs, a window inside both envelope plateaus [0.28,0.62] and [0.18,0.72] for any lifeMs, so envelope terms sit at 1 throughout", () => {
    const config: BackgroundStars = {
      ...BASE,
      density: 1,
      twinkleAmount: 1,
      twinkleSpeed: 1,
      tiltAngleDeg: 0,
      opacity: 1,
    };
    const state = createSingleStarStateWithBackfillDisabled(mulberry32(555));
    const bornAt = 2000;
    stepStars(state, config, SOLO_DISPLAY, bornAt);
    const star = state.stars[0];
    const lifeMs = star.lifeMs;
    const phase = star.phase;
    const baseOpacity = star.baseOpacity;
    const midFrac = 0.45;
    for (const fracOffset of [0, 0.05, 0.1, 0.15]) {
      const now = bornAt + (midFrac + fracOffset) * lifeMs;
      stepStars(state, config, SOLO_DISPLAY, now);
      const tw = 0.5 + 0.5 * Math.sin((now / 1000) * config.twinkleSpeed * Math.PI * 2 + phase);
      const expectedScale = 0.78 + 0.22 * tw;
      const expectedOpacity = baseOpacity * (0.65 + 0.35 * tw);
      expect(state.stars[0].scale).toBeCloseTo(expectedScale, 9);
      expect(state.stars[0].opacity).toBeCloseTo(expectedOpacity, 9);
      expect(state.stars[0].scale).toBeGreaterThanOrEqual(0.78 - 1e-9);
      expect(state.stars[0].scale).toBeLessThanOrEqual(1 + 1e-9);
      expect(state.stars[0].opacity).toBeGreaterThanOrEqual(baseOpacity * 0.65 - 1e-9);
      expect(state.stars[0].opacity).toBeLessThanOrEqual(baseOpacity * 1 + 1e-9);
    }
  });
});

describe("updateStar via stepStars: tiltRad = clamp(tiltAngleDeg, -89, 89) * pi/180", () => {
  it("converts an in-range angle directly", () => {
    const config: BackgroundStars = { ...BASE, density: 1, tiltAngleDeg: 45 };
    const state = createSingleStarStateWithBackfillDisabled(mulberry32(21));
    stepStars(state, config, SOLO_DISPLAY, 1000);
    expect(state.stars[0].tiltRad).toBeCloseTo((45 * Math.PI) / 180, 12);
  });
  it("clamps angles above 89deg to 89deg before conversion", () => {
    const config: BackgroundStars = { ...BASE, density: 1, tiltAngleDeg: 200 };
    const state = createSingleStarStateWithBackfillDisabled(mulberry32(22));
    stepStars(state, config, SOLO_DISPLAY, 1000);
    expect(state.stars[0].tiltRad).toBeCloseTo((89 * Math.PI) / 180, 12);
  });
  it("clamps angles below -89deg to -89deg before conversion", () => {
    const config: BackgroundStars = { ...BASE, density: 1, tiltAngleDeg: -200 };
    const state = createSingleStarStateWithBackfillDisabled(mulberry32(23));
    stepStars(state, config, SOLO_DISPLAY, 1000);
    expect(state.stars[0].tiltRad).toBeCloseTo((-89 * Math.PI) / 180, 12);
  });
});

describe("updateStar via stepStars: opacity clamp01 (the lower bound is unreachable through stepStars because starsTargetCount zeroes the population whenever config.opacity<=0)", () => {
  it("clamps star.opacity to 1 when config.opacity*baseOpacity*envelope*twinkle overshoots 1 (config.opacity=5, mid-life, twinkle neutralized)", () => {
    const config: BackgroundStars = { ...BASE, density: 1, twinkleAmount: 0, opacity: 5 };
    const state = createSingleStarStateWithBackfillDisabled(mulberry32(11));
    const bornAt = 3000;
    stepStars(state, config, SOLO_DISPLAY, bornAt);
    const lifeMs = state.stars[0].lifeMs;
    stepStars(state, config, SOLO_DISPLAY, bornAt + 0.45 * lifeMs);
    expect(state.stars[0].opacity).toBe(1);
  });
});

describe("spawnStar via stepStars: sizeJitter floor at 0.12 and sizePx floor at 0.25", () => {
  it("floors sizeJitter to 0.12 when sizeRandomness=1 and random() returns 0 (lerp(0,2,0)=0 < 0.12)", () => {
    const config: BackgroundStars = { ...BASE, density: 1, sizeRandomness: 1, sizePx: 8 };
    const state = createSingleStarStateWithBackfillDisabled(() => 0);
    stepStars(state, config, SOLO_DISPLAY, 1000);
    expect(state.stars[0].sizePx).toBeCloseTo(8 * 0.12, 10);
  });
  it("floors sizePx to 0.25 when sizePx*flooredJitter would land below it", () => {
    const config: BackgroundStars = { ...BASE, density: 1, sizeRandomness: 1, sizePx: 0.1 };
    const state = createSingleStarStateWithBackfillDisabled(() => 0);
    stepStars(state, config, SOLO_DISPLAY, 1000);
    expect(state.stars[0].sizePx).toBe(0.25);
  });
});

describe("updateStar via stepStars: death and respawn on age<0 or age>=lifeMs", () => {
  it("kills and respawns the star when nowMs precedes its bornMs (age<0)", () => {
    const config: BackgroundStars = { ...BASE, density: 1 };
    const state = createSingleStarStateWithBackfillDisabled(mulberry32(31));
    stepStars(state, config, SOLO_DISPLAY, 5000);
    const original = state.stars[0];
    stepStars(state, config, SOLO_DISPLAY, original.bornMs - 1);
    expect(state.stars.length).toBe(1);
    expect(state.stars[0]).not.toBe(original);
  });
  it("kills and respawns the star once age reaches lifeMs exactly", () => {
    const config: BackgroundStars = { ...BASE, density: 1 };
    const state = createSingleStarStateWithBackfillDisabled(mulberry32(32));
    stepStars(state, config, SOLO_DISPLAY, 5000);
    const original = state.stars[0];
    stepStars(state, config, SOLO_DISPLAY, original.bornMs + original.lifeMs);
    expect(state.stars.length).toBe(1);
    expect(state.stars[0]).not.toBe(original);
  });
});
