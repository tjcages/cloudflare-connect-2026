import { describe, expect, it } from "vitest";
import {
  applyTextureLuminanceGamma,
  DEFAULT_TEXTURE_GAMMA,
  normalizeTextureGamma,
  TEXTURE_GAMMA_MAX,
  TEXTURE_GAMMA_MIN,
} from "./colorWhiteness";

describe("applyTextureLuminanceGamma", () => {
  it("returns identity at gamma 1", () => {
    expect(applyTextureLuminanceGamma(0, 1)).toBe(0);
    expect(applyTextureLuminanceGamma(0.5, 1)).toBe(0.5);
    expect(applyTextureLuminanceGamma(1, 1)).toBe(1);
  });

  it("darkens midtones for positive gamma", () => {
    expect(applyTextureLuminanceGamma(0.5, 2)).toBeCloseTo(0.25);
  });

  it("inverts at gamma -1", () => {
    expect(applyTextureLuminanceGamma(0, -1)).toBe(1);
    expect(applyTextureLuminanceGamma(1, -1)).toBe(0);
    expect(applyTextureLuminanceGamma(0.25, -1)).toBeCloseTo(0.75);
  });

  it("applies inverted power curve for gamma below -1", () => {
    expect(applyTextureLuminanceGamma(0.5, -2)).toBeCloseTo(0.25);
  });

  it("clamps input luminance", () => {
    expect(applyTextureLuminanceGamma(-1, 2)).toBe(0);
    expect(applyTextureLuminanceGamma(2, -1)).toBe(0);
  });
});

describe("normalizeTextureGamma", () => {
  it("preserves finite values outside the slider range", () => {
    expect(normalizeTextureGamma(TEXTURE_GAMMA_MIN)).toBe(-5);
    expect(normalizeTextureGamma(TEXTURE_GAMMA_MAX)).toBe(5);
    expect(normalizeTextureGamma(-50)).toBe(-50);
    expect(normalizeTextureGamma(30)).toBe(30);
  });

  it("falls back to default for non-finite values", () => {
    expect(normalizeTextureGamma(Number.NaN)).toBe(DEFAULT_TEXTURE_GAMMA);
    expect(normalizeTextureGamma(Number.POSITIVE_INFINITY)).toBe(DEFAULT_TEXTURE_GAMMA);
  });
});
