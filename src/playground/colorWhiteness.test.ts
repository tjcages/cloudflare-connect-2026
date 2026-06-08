import { describe, expect, it } from "vitest";
import {
  applyTextureLuminanceGamma,
  colorDistanceLuminance,
  DEFAULT_TEXTURE_GAMMA,
  DEFAULT_TEXTURE_LUMINANCE_MODE,
  DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
  normalizeTextureGamma,
  normalizeTextureLuminanceMode,
  normalizeTextureLuminanceBackgroundColor,
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

  it("clamps negative gamma to the positive minimum", () => {
    expect(applyTextureLuminanceGamma(0, -1)).toBe(0);
    expect(applyTextureLuminanceGamma(1, -1)).toBe(1);
    expect(applyTextureLuminanceGamma(0.25, -1)).toBeCloseTo(Math.pow(0.25, TEXTURE_GAMMA_MIN));
  });

  it("uses invert luminance instead of negative gamma for inversion", () => {
    expect(applyTextureLuminanceGamma(0.5, -2)).toBeCloseTo(Math.pow(0.5, TEXTURE_GAMMA_MIN));
  });

  it("clamps input luminance", () => {
    expect(applyTextureLuminanceGamma(-1, 2)).toBe(0);
    expect(applyTextureLuminanceGamma(2, -1)).toBe(1);
  });
});

describe("normalizeTextureGamma", () => {
  it("clamps finite values to positive gamma bounds", () => {
    expect(normalizeTextureGamma(TEXTURE_GAMMA_MIN)).toBe(TEXTURE_GAMMA_MIN);
    expect(normalizeTextureGamma(TEXTURE_GAMMA_MAX)).toBe(5);
    expect(normalizeTextureGamma(-50)).toBe(TEXTURE_GAMMA_MIN);
    expect(normalizeTextureGamma(30)).toBe(30);
  });

  it("falls back to default for non-finite values", () => {
    expect(normalizeTextureGamma(Number.NaN)).toBe(DEFAULT_TEXTURE_GAMMA);
    expect(normalizeTextureGamma(Number.POSITIVE_INFINITY)).toBe(DEFAULT_TEXTURE_GAMMA);
  });
});

describe("colorDistanceLuminance", () => {
  it("maps exact background color to 0 and black/white opposites to 1", () => {
    expect(colorDistanceLuminance(0, 0, 0, 0x000000)).toBe(0);
    expect(colorDistanceLuminance(255, 255, 255, 0x000000)).toBe(1);
    expect(colorDistanceLuminance(0, 0, 0, 0xffffff)).toBe(1);
    expect(colorDistanceLuminance(255, 255, 255, 0xffffff)).toBe(0);
  });

  it("uses normalized RGB distance for intermediate colors", () => {
    expect(colorDistanceLuminance(255, 0, 0, 0x000000)).toBeCloseTo(1 / Math.sqrt(3));
  });
});

describe("texture luminance mode normalization", () => {
  it("defaults to classic luminance mode", () => {
    expect(DEFAULT_TEXTURE_LUMINANCE_MODE).toBe("luminance");
    expect(normalizeTextureLuminanceMode(undefined)).toBe("luminance");
    expect(normalizeTextureLuminanceMode("colors")).toBe("colors");
    expect(normalizeTextureLuminanceMode("missing")).toBe("luminance");
  });

  it("normalizes texture luminance background color", () => {
    expect(DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR).toBe(0x000000);
    expect(normalizeTextureLuminanceBackgroundColor("#ffffff")).toBe(0xffffff);
    expect(normalizeTextureLuminanceBackgroundColor("bad")).toBe(DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR);
  });
});
