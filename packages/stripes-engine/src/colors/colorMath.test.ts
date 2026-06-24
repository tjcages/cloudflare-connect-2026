import { describe, it, expect } from "vitest";
import { colorDistanceLuminance, maxColorDistance, pixelLuminance, pixelSaturation } from "./colorMath";

function rgba(...px: number[][]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(px.length * 4);
  px.forEach(([r, g, b, a = 255], i) => {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  });
  return out;
}

describe("maxColorDistance", () => {
  it("uniform-background texture → 0", () => {
    const px = rgba([0, 0, 0], [0, 0, 0]);
    expect(maxColorDistance(px, 0x000000)).toBe(0);
  });

  it("black→white distance is sqrt(3) (theoretical max)", () => {
    const px = rgba([255, 255, 255]);
    expect(maxColorDistance(px, 0x000000)).toBeCloseTo(Math.sqrt(3), 5);
  });

  it("returns the largest distance present, not the theoretical max", () => {
    const px = rgba([32, 32, 32], [200, 20, 20]);
    const expected = Math.sqrt(200 * 200 + 20 * 20 + 20 * 20) / 255;
    expect(maxColorDistance(px, 0x000000)).toBeCloseTo(expected, 6);
    expect(maxColorDistance(px, 0x000000)).toBeLessThan(Math.sqrt(3));
  });

  it("is measured relative to the given background", () => {
    const px = rgba([255, 255, 255]);
    expect(maxColorDistance(px, 0xffffff)).toBeCloseTo(0, 6);
  });

  it("ignores near-transparent pixels", () => {
    const px = rgba([60, 60, 60, 255], [255, 255, 255, 0]);
    const expected = Math.sqrt(60 * 60 * 3) / 255;
    expect(maxColorDistance(px, 0x000000)).toBeCloseTo(expected, 6);
  });

  it("the most-distant pixel normalizes to a presence ratio of exactly 1", () => {
    // This is the load-bearing property: distance(maxColor, bg) / maxColorDistance === 1.
    const bg = 0x303030;
    const farthest = [210, 40, 60];
    const px = rgba([70, 70, 70], farthest, [120, 130, 140]);
    const norm = maxColorDistance(px, bg);
    const dr = farthest[0] - 0x30;
    const dg = farthest[1] - 0x30;
    const db = farthest[2] - 0x30;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db) / 255;
    expect(dist / norm).toBeCloseTo(1, 6);
  });
});

describe("pixelLuminance", () => {
  it("black → 0", () => {
    expect(pixelLuminance(0, 0, 0)).toBe(0);
  });

  it("white → 1", () => {
    expect(pixelLuminance(255, 255, 255)).toBeCloseTo(1, 5);
  });

  it("gray midtone matches rec709 formula", () => {
    const r = 128;
    const g = 128;
    const b = 128;
    const expected = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    expect(pixelLuminance(r, g, b)).toBeCloseTo(expected, 10);
  });

  it("pure green is brightest primary", () => {
    expect(pixelLuminance(0, 255, 0)).toBeGreaterThan(pixelLuminance(255, 0, 0));
    expect(pixelLuminance(0, 255, 0)).toBeGreaterThan(pixelLuminance(0, 0, 255));
  });
});

describe("pixelSaturation", () => {
  it("gray → 0", () => {
    expect(pixelSaturation(128, 128, 128)).toBe(0);
  });

  it("black → 0", () => {
    expect(pixelSaturation(0, 0, 0)).toBe(0);
  });

  it("white → 0", () => {
    expect(pixelSaturation(255, 255, 255)).toBe(0);
  });

  it("pure red → 1", () => {
    expect(pixelSaturation(255, 0, 0)).toBe(1);
  });

  it("pure green → 1", () => {
    expect(pixelSaturation(0, 255, 0)).toBe(1);
  });

  it("pure blue → 1", () => {
    expect(pixelSaturation(0, 0, 255)).toBe(1);
  });
});

describe("colorDistanceLuminance", () => {
  it("same color as background → 0", () => {
    expect(colorDistanceLuminance(0, 0, 0, 0x000000)).toBe(0);
  });

  it("max distance from black bg → 1", () => {
    expect(colorDistanceLuminance(255, 255, 255, 0x000000)).toBeCloseTo(1, 10);
  });

  it("white pixel on white bg → 0", () => {
    expect(colorDistanceLuminance(255, 255, 255, 0xffffff)).toBe(0);
  });

  it("black pixel on white bg → 1", () => {
    expect(colorDistanceLuminance(0, 0, 0, 0xffffff)).toBeCloseTo(1, 10);
  });

  it("partial distance is in (0, 1)", () => {
    const v = colorDistanceLuminance(128, 0, 0, 0x000000);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it("matches legacy formula exactly for known inputs", () => {
    const r = 200;
    const g = 100;
    const b = 50;
    const bg = 0x102030;
    const br = (bg >> 16) & 0xff;
    const bgc = (bg >> 8) & 0xff;
    const bb = bg & 0xff;
    const dr = r - br;
    const dg = g - bgc;
    const db = b - bb;
    const expected = Math.min(1, Math.sqrt(dr * dr + dg * dg + db * db) / (255 * Math.sqrt(3)));
    expect(colorDistanceLuminance(r, g, b, bg)).toBeCloseTo(expected, 10);
  });

  it("never exceeds 1", () => {
    expect(colorDistanceLuminance(255, 0, 255, 0x00ff00)).toBeLessThanOrEqual(1);
  });
});
