import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  isDefaultPlaygroundCursorTrailConfig,
  normalizePlaygroundCursorTrailConfig,
  resolveCursorTrailEffectSize,
} from "./playgroundCursorTrailConfig";

describe("normalizePlaygroundCursorTrailConfig", () => {
  it("fills defaults and clamps designer-editable values", () => {
    expect(normalizePlaygroundCursorTrailConfig()).toEqual(DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG);

    expect(
      normalizePlaygroundCursorTrailConfig({
        particleAlpha: 2,
        particleSpacingPx: -1,
        maxEmitPerTick: 2.4,
        spreadMinPx: 20,
        spreadMaxPx: 5,
        pushStrengthPx: 200,
        trailScale: 2,
      }),
    ).toMatchObject({
      particleAlpha: 1,
      particleSpacingPx: 0.5,
      maxEmitPerTick: 2,
      spreadMinPx: 20,
      spreadMaxPx: 20,
      pushStrengthPx: 120,
      trailScale: 1,
    });
  });
});

describe("resolveCursorTrailEffectSize", () => {
  it("uses one pixel per stripe cell when trail scale is auto", () => {
    expect(resolveCursorTrailEffectSize(640, 360, DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG, 8, 8)).toEqual({
      width: 80,
      height: 45,
    });
  });

  it("uses an explicit trail scale when configured", () => {
    expect(
      resolveCursorTrailEffectSize(100, 50, { ...DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG, trailScale: 0.25 }, 8, 8),
    ).toEqual({
      width: 25,
      height: 13,
    });
  });
});

describe("isDefaultPlaygroundCursorTrailConfig", () => {
  it("detects default and modified trail config", () => {
    expect(isDefaultPlaygroundCursorTrailConfig(DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG)).toBe(true);
    expect(
      isDefaultPlaygroundCursorTrailConfig({
        ...DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
        pushStrengthPx: DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG.pushStrengthPx + 1,
      }),
    ).toBe(false);
  });
});
