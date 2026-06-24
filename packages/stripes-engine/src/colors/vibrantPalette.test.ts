import { describe, it, expect } from "vitest";
import {
  extractVibrantColors,
  createSyntheticVibrantPalette,
  pixelVibrancyScore,
  type VibrantColor,
} from "./vibrantPalette";

function fill(pixels: Uint8ClampedArray, r: number, g: number, b: number): void {
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  }
}

describe("pixelVibrancyScore", () => {
  it("gray has zero score (no saturation)", () => {
    expect(pixelVibrancyScore(128, 128, 128)).toBe(0);
  });

  it("black and white have zero score", () => {
    expect(pixelVibrancyScore(0, 0, 0)).toBe(0);
    expect(pixelVibrancyScore(255, 255, 255)).toBe(0);
  });

  it("a saturated midtone scores higher than a saturated near-black", () => {
    const mid = pixelVibrancyScore(220, 30, 30);
    const dark = pixelVibrancyScore(40, 0, 0);
    expect(mid).toBeGreaterThan(dark);
  });

  it("score is positive for a vivid midtone", () => {
    expect(pixelVibrancyScore(200, 40, 120)).toBeGreaterThan(0);
  });
});

describe("createSyntheticVibrantPalette", () => {
  it("returns the requested count", () => {
    expect(createSyntheticVibrantPalette(8)).toHaveLength(8);
    expect(createSyntheticVibrantPalette(3)).toHaveLength(3);
  });

  it("defaults to 8 colors", () => {
    expect(createSyntheticVibrantPalette()).toHaveLength(8);
  });

  it("produces distinct, in-range colors", () => {
    const palette = createSyntheticVibrantPalette(6);
    const seen = new Set<string>();
    for (const c of palette) {
      expect(c.r).toBeGreaterThanOrEqual(0);
      expect(c.r).toBeLessThanOrEqual(255);
      expect(c.g).toBeGreaterThanOrEqual(0);
      expect(c.g).toBeLessThanOrEqual(255);
      expect(c.b).toBeGreaterThanOrEqual(0);
      expect(c.b).toBeLessThanOrEqual(255);
      seen.add(`${c.r},${c.g},${c.b}`);
    }
    expect(seen.size).toBe(6);
  });

  it("is deterministic", () => {
    expect(createSyntheticVibrantPalette(5)).toEqual(createSyntheticVibrantPalette(5));
  });
});

describe("extractVibrantColors", () => {
  it("falls back to synthetic when dimensions are invalid", () => {
    const px = new Uint8ClampedArray(0);
    expect(extractVibrantColors(px, 0, 0)).toEqual(createSyntheticVibrantPalette());
  });

  it("falls back to synthetic when the buffer is too small", () => {
    const px = new Uint8ClampedArray(4);
    expect(extractVibrantColors(px, 4, 4)).toEqual(createSyntheticVibrantPalette());
  });

  it("falls back to synthetic for an all-gray (zero-vibrancy) image", () => {
    const w = 8;
    const h = 8;
    const px = new Uint8ClampedArray(w * h * 4);
    fill(px, 128, 128, 128);
    expect(extractVibrantColors(px, w, h)).toEqual(createSyntheticVibrantPalette());
  });

  it("extracts a vivid color from a saturated image", () => {
    const w = 8;
    const h = 8;
    const px = new Uint8ClampedArray(w * h * 4);
    fill(px, 220, 30, 30);
    const palette = extractVibrantColors(px, w, h, { stride: 1 });
    expect(palette.length).toBeGreaterThan(0);
    const [first] = palette;
    expect(first.r).toBe(220);
    expect(first.g).toBe(30);
    expect(first.b).toBe(30);
  });

  it("dedupes near-identical colors and respects maxColors", () => {
    const w = 16;
    const h = 16;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const left = x < w / 2;
        px[i] = left ? 220 : 40;
        px[i + 1] = left ? 40 : 210;
        px[i + 2] = left ? 40 : 60;
        px[i + 3] = 255;
      }
    }
    const palette = extractVibrantColors(px, w, h, { stride: 1, maxColors: 64 });
    expect(palette.length).toBe(2);
    const keys = new Set(palette.map((c: VibrantColor) => `${c.r},${c.g},${c.b}`));
    expect(keys.size).toBe(palette.length);
  });
});
