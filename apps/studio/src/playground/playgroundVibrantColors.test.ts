import { describe, expect, it } from "vitest";
import {
  createSyntheticVibrantPalette,
  extractVibrantColors,
  extractVibrantColorsFromImageData,
} from "./playgroundVibrantColors";

function createSolidImageData(width: number, height: number, rgb: [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    data[offset] = rgb[0];
    data[offset + 1] = rgb[1];
    data[offset + 2] = rgb[2];
    data[offset + 3] = 255;
  }
  return new ImageData(data, width, height);
}

describe("playgroundVibrantColors", () => {
  it("prefers saturated colors over grayscale pixels", () => {
    const width = 24;
    const height = 24;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const offset = i * 4;
      data[offset] = 128;
      data[offset + 1] = 128;
      data[offset + 2] = 128;
      data[offset + 3] = 255;
    }
    const center = (12 * width + 12) * 4;
    data[center] = 255;
    data[center + 1] = 40;
    data[center + 2] = 20;

    const palette = extractVibrantColors(data, width, height, { stride: 1, maxColors: 4 });
    expect(palette.length).toBeGreaterThan(0);
    expect(palette.some((color) => color.r > color.g && color.g > color.b)).toBe(true);
  });

  it("returns synthetic hues for fully grayscale textures", () => {
    const image = createSolidImageData(16, 16, [120, 120, 120]);
    const palette = extractVibrantColorsFromImageData(image);
    expect(palette.length).toBeGreaterThan(0);
    expect(palette.some((color) => color.r !== color.g || color.g !== color.b)).toBe(true);
  });

  it("createSyntheticVibrantPalette returns distinct saturated colors", () => {
    const palette = createSyntheticVibrantPalette(6);
    expect(palette).toHaveLength(6);
    const unique = new Set(palette.map((color) => `${color.r},${color.g},${color.b}`));
    expect(unique.size).toBe(6);
  });
});
