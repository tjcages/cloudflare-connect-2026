import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  isDefaultPlaygroundCursorTrailConfig,
  normalizePlaygroundCursorTrailConfig,
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
      }),
    ).toMatchObject({
      particleAlpha: 1,
      particleSpacingPx: 0.5,
      maxEmitPerTick: 2,
      spreadMinPx: 20,
      spreadMaxPx: 20,
      pushStrengthPx: 120,
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
