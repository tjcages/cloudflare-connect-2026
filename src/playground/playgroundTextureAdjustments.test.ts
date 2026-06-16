import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  applyTextureLuminanceAdjustments,
  blurRgbaPixels,
  compositeRgbaOverBackground,
  isDefaultPlaygroundTextureAdjustments,
  normalizePlaygroundTextureAdjustments,
  renderAdjustedPreviewPixels,
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

  it("composites transparent pixels onto a background before blur can bleed", () => {
    const pixels = new Uint8ClampedArray(3 * 1 * 4);
    pixels[0] = 255;
    pixels[1] = 0;
    pixels[2] = 0;
    pixels[3] = 255;
    pixels[8] = 0;
    pixels[9] = 0;
    pixels[10] = 0;
    pixels[11] = 0;

    const composited = compositeRgbaOverBackground(pixels, 3, 1, 0xffffff);
    const blurred = blurRgbaPixels(composited, 3, 1, {
      ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      blurRadius: 1,
    });

    expect(composited[4]).toBe(255);
    expect(composited[5]).toBe(255);
    expect(blurred[1]).toBeGreaterThan(0);
    expect(blurred[5]).toBeLessThan(255);
  });

  it("blurs RGBA pixels so color bleeds into neighbors", () => {
    const pixels = new Uint8ClampedArray(3 * 1 * 4);
    pixels[0] = 255;
    pixels[1] = 255;
    pixels[2] = 255;
    pixels[3] = 255;
    pixels[4] = 255;
    pixels[5] = 0;
    pixels[6] = 0;
    pixels[7] = 255;
    pixels[8] = 0;
    pixels[9] = 0;
    pixels[10] = 0;
    pixels[11] = 255;

    const blurred = blurRgbaPixels(pixels, 3, 1, {
      ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      blurRadius: 1,
    });

    expect(blurred[0]).toBeGreaterThan(200);
    expect(blurred[1]).toBeLessThan(255);
    expect(blurred[2]).toBeLessThan(255);
  });

  it("renders an opaque preview with blur bleed and tone mapping", () => {
    const pixels = new Uint8ClampedArray(3 * 1 * 4);
    pixels[0] = 255;
    pixels[1] = 0;
    pixels[2] = 0;
    pixels[3] = 255;

    const preview = renderAdjustedPreviewPixels(
      pixels,
      3,
      1,
      {
        ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
        blurRadius: 1,
      },
      { mode: "colors", backgroundColor: 0xffffff },
    );

    expect(preview[3]).toBe(255);
    expect(preview[7]).toBe(255);
    expect(preview[11]).toBe(255);
    expect(preview[1]).toBeGreaterThan(0);
    expect(preview[5]).toBeLessThan(255);
  });

  it("passes opaque pixels through unchanged with default adjustments (overlay bake skip relies on this)", () => {
    const pixels = new Uint8ClampedArray([10, 200, 73, 255, 0, 0, 0, 255, 255, 128, 64, 255, 90, 91, 92, 255]);
    const preview = renderAdjustedPreviewPixels(pixels, 2, 2, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS);
    for (let i = 0; i < pixels.length; i += 4) {
      expect(Math.abs((preview[i] ?? 0) - (pixels[i] ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((preview[i + 1] ?? 0) - (pixels[i + 1] ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((preview[i + 2] ?? 0) - (pixels[i + 2] ?? 0))).toBeLessThanOrEqual(1);
      expect(preview[i + 3]).toBe(255);
    }
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
