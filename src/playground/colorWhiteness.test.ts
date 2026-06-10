import { describe, expect, it } from "vitest";
import {
  applyTextureLuminanceGamma,
  colorDistanceLuminance,
  colorPixelPresence,
  detectTextureBackgroundColor,
  DEFAULT_TEXTURE_GAMMA,
  DEFAULT_TEXTURE_LUMINANCE_MODE,
  DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
  isNonBackgroundColorPixel,
  normalizeTextureGamma,
  normalizeTextureLuminanceMode,
  normalizeTextureLuminanceBackgroundColor,
  pixelSaturation,
  pixelTextureLuminance,
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

describe("colorPixelPresence", () => {
  it("returns zero for neutral pixels including background matches", () => {
    expect(colorPixelPresence(0, 0, 0, 0x000000)).toBe(0);
    expect(colorPixelPresence(255, 255, 255, 0xffffff)).toBe(0);
  });

  it("detects saturated and neutral foreground colors on a white background", () => {
    expect(colorPixelPresence(0, 0, 128, 0xffffff)).toBeGreaterThan(0.35);
    expect(colorPixelPresence(120, 40, 20, 0xffffff)).toBeGreaterThan(0.2);
    expect(colorPixelPresence(0, 0, 0, 0xffffff)).toBe(1);
    expect(isNonBackgroundColorPixel(0, 0, 128, 0xffffff)).toBe(true);
    expect(isNonBackgroundColorPixel(0, 0, 0, 0xffffff)).toBe(true);
    expect(isNonBackgroundColorPixel(200, 200, 200, 0xffffff)).toBe(true);
    expect(isNonBackgroundColorPixel(252, 252, 252, 0xffffff)).toBe(false);
  });

  it("uses pixelTextureLuminance in colors mode", () => {
    expect(pixelTextureLuminance(0, 0, 128, { mode: "colors", backgroundColor: 0xffffff })).toBeGreaterThan(0.2);
    expect(pixelTextureLuminance(255, 255, 255, { mode: "colors", backgroundColor: 0xffffff })).toBe(0);
    expect(pixelTextureLuminance(255, 255, 255, { mode: "luminance" })).toBeCloseTo(1);
  });
});

describe("detectTextureBackgroundColor", () => {
  it("picks the dominant edge color", () => {
    const data = new Uint8ClampedArray(3 * 3 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
    data[(1 * 3 + 1) * 4] = 20;
    data[(1 * 3 + 1) * 4 + 2] = 180;

    expect(detectTextureBackgroundColor(data, 3, 3)).toBe(0xffffff);
  });
});

describe("pixelSaturation", () => {
  it("returns zero for grayscale and one for pure primaries", () => {
    expect(pixelSaturation(128, 128, 128)).toBe(0);
    expect(pixelSaturation(255, 0, 0)).toBe(1);
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
