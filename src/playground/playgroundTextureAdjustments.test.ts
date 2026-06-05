import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  applyTextureLuminanceAdjustments,
  isDefaultPlaygroundTextureAdjustments,
  normalizePlaygroundTextureAdjustments,
} from "./playgroundTextureAdjustments";

describe("playground texture adjustments", () => {
  it("normalizes untrusted values into designer-safe bounds", () => {
    const adjusted = normalizePlaygroundTextureAdjustments({
      brightness: 2,
      exposure: -20,
      contrast: 99,
      blackPoint: -1,
      whitePoint: 2,
      gamma: Number.NaN,
      invert: true,
      posterizeLevels: 999,
      thresholdBias: -2,
      noiseAmount: 99,
      blurRadius: 99,
      sharpenAmount: 99,
    });

    expect(adjusted).toEqual({
      brightness: 1,
      exposure: -5,
      contrast: 4,
      blackPoint: 0,
      whitePoint: 1,
      gamma: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.gamma,
      invert: true,
      posterizeLevels: 16,
      thresholdBias: -1,
      noiseAmount: 1,
      blurRadius: 4,
      sharpenAmount: 4,
    });
  });

  it("detects default-equivalent adjustment configs", () => {
    expect(isDefaultPlaygroundTextureAdjustments(DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS)).toBe(true);
    expect(isDefaultPlaygroundTextureAdjustments({ ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, contrast: 1.2 })).toBe(
      false,
    );
  });

  it("applies tone controls in a stable order before stripe bucketing", () => {
    const adjusted = applyTextureLuminanceAdjustments(0.5, {
      ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      blackPoint: 0.25,
      whitePoint: 0.75,
      contrast: 2,
      brightness: 0.1,
      thresholdBias: -0.1,
      posterizeLevels: 4,
    });

    expect(adjusted).toBeCloseTo(2 / 3, 5);
  });

  it("can invert and add deterministic luma noise", () => {
    const a = applyTextureLuminanceAdjustments(
      0.2,
      {
        ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
        invert: true,
        noiseAmount: 0.25,
      },
      3,
      7,
    );
    const b = applyTextureLuminanceAdjustments(
      0.2,
      {
        ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
        invert: true,
        noiseAmount: 0.25,
      },
      3,
      7,
    );

    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  });
});
