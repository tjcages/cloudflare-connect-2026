import { describe, it, expect } from "vitest";
import { detectBackgroundColor } from "./backgroundDetect";

function makeImage(
  width: number,
  height: number,
  fillRGBA: [number, number, number, number],
  centerFillRGBA?: [number, number, number, number],
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const isEdge = x === 0 || x === width - 1 || y === 0 || y === height - 1;
      const [r, g, b, a] = isEdge || !centerFillRGBA ? fillRGBA : centerFillRGBA;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
  return pixels;
}

describe("detectBackgroundColor", () => {
  it("uniform black border → 0x000000", () => {
    const pixels = makeImage(10, 10, [0, 0, 0, 255], [255, 255, 255, 255]);
    expect(detectBackgroundColor(pixels, 10, 10)).toBe(0x000000);
  });

  it("uniform white border → 0xffffff", () => {
    const pixels = makeImage(10, 10, [255, 255, 255, 255], [0, 0, 0, 255]);
    expect(detectBackgroundColor(pixels, 10, 10)).toBe(0xffffff);
  });

  it("uniform red border → approximately 0xff0000", () => {
    const pixels = makeImage(10, 10, [255, 0, 0, 255], [0, 255, 0, 255]);
    const result = detectBackgroundColor(pixels, 10, 10);
    const r = (result >> 16) & 0xff;
    const g = (result >> 8) & 0xff;
    const b = result & 0xff;
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(32);
    expect(b).toBeLessThan(32);
  });

  it("mostly-black border with one bright red pixel still detects black", () => {
    const pixels = makeImage(20, 20, [0, 0, 0, 255]);
    pixels[0] = 255;
    pixels[1] = 0;
    pixels[2] = 0;
    pixels[3] = 255;
    expect(detectBackgroundColor(pixels, 20, 20)).toBe(0x000000);
  });

  it("empty pixels → 0x000000", () => {
    expect(detectBackgroundColor(new Uint8ClampedArray(0), 0, 0)).toBe(0x000000);
  });

  it("width=0 → 0x000000", () => {
    expect(detectBackgroundColor(new Uint8ClampedArray(4), 0, 1)).toBe(0x000000);
  });

  it("height=0 → 0x000000", () => {
    expect(detectBackgroundColor(new Uint8ClampedArray(4), 1, 0)).toBe(0x000000);
  });

  it("undersized buffer → 0x000000", () => {
    expect(detectBackgroundColor(new Uint8ClampedArray(8), 10, 10)).toBe(0x000000);
  });

  it("deterministic: same input → same output", () => {
    const pixels = makeImage(15, 15, [128, 64, 32, 255], [200, 100, 50, 255]);
    const a = detectBackgroundColor(pixels, 15, 15);
    const b = detectBackgroundColor(pixels, 15, 15);
    expect(a).toBe(b);
  });

  it("Uint8Array accepted as well as Uint8ClampedArray", () => {
    const clamped = makeImage(10, 10, [0, 0, 0, 255], [255, 255, 255, 255]);
    const plain = new Uint8Array(clamped);
    expect(detectBackgroundColor(plain, 10, 10)).toBe(detectBackgroundColor(clamped, 10, 10));
  });

  it("ignores center: different center color does not change result", () => {
    const allBlack = makeImage(12, 12, [0, 0, 0, 255]);
    const blackBorderRedCenter = makeImage(12, 12, [0, 0, 0, 255], [255, 0, 0, 255]);
    expect(detectBackgroundColor(allBlack, 12, 12)).toBe(detectBackgroundColor(blackBorderRedCenter, 12, 12));
  });
});
