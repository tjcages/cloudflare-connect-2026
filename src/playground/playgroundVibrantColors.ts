import { pixelLuminance } from "./colorWhiteness";

export type PlaygroundVibrantColor = { r: number; g: number; b: number };

export type ExtractVibrantColorsOptions = {
  maxColors?: number;
  stride?: number;
  dedupeDistance?: number;
};

const DEFAULT_MAX_COLORS = 24;
const DEFAULT_STRIDE = 6;
const DEFAULT_DEDUPE_DISTANCE = 32;

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function pixelSaturation(r: number, g: number, b: number): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  if (max <= 0) {
    return 0;
  }
  return (max - min) / max;
}

function pixelVibrancyScore(r: number, g: number, b: number): number {
  const saturation = pixelSaturation(r, g, b);
  if (saturation <= 0) {
    return 0;
  }
  const luma = pixelLuminance(r, g, b);
  const midToneWeight = 1 - Math.abs(luma - 0.5) * 2;
  return saturation * Math.max(0, midToneWeight);
}

function colorDistance(a: PlaygroundVibrantColor, b: PlaygroundVibrantColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function dedupeColors(colors: PlaygroundVibrantColor[], minDistance: number): PlaygroundVibrantColor[] {
  const kept: PlaygroundVibrantColor[] = [];
  for (const color of colors) {
    if (kept.every((existing) => colorDistance(existing, color) >= minDistance)) {
      kept.push(color);
    }
  }
  return kept;
}

function hslToRgb(h: number, s: number, l: number): PlaygroundVibrantColor {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: clampByte((r + m) * 255),
    g: clampByte((g + m) * 255),
    b: clampByte((b + m) * 255),
  };
}

/** Saturated fallback hues when the source has no vibrant pixels. */
export function createSyntheticVibrantPalette(count = 8): readonly PlaygroundVibrantColor[] {
  const colors: PlaygroundVibrantColor[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(hslToRgb((360 / count) * i, 0.85, 0.55));
  }
  return colors;
}

export function extractVibrantColors(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: ExtractVibrantColorsOptions = {},
): readonly PlaygroundVibrantColor[] {
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4) {
    return createSyntheticVibrantPalette();
  }

  const maxColors = options.maxColors ?? DEFAULT_MAX_COLORS;
  const stride = Math.max(1, options.stride ?? DEFAULT_STRIDE);
  const dedupeDistance = options.dedupeDistance ?? DEFAULT_DEDUPE_DISTANCE;

  const scored: { color: PlaygroundVibrantColor; score: number }[] = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx] ?? 0;
      const g = pixels[idx + 1] ?? 0;
      const b = pixels[idx + 2] ?? 0;
      const score = pixelVibrancyScore(r, g, b);
      if (score <= 0) {
        continue;
      }
      scored.push({ color: { r, g, b }, score });
    }
  }

  if (scored.length === 0) {
    return createSyntheticVibrantPalette();
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxColors * 3).map((entry) => entry.color);
  const deduped = dedupeColors(top, dedupeDistance);
  if (deduped.length === 0) {
    return createSyntheticVibrantPalette();
  }
  return deduped.slice(0, maxColors);
}

export function extractVibrantColorsFromImageData(
  imageData: ImageData,
  options?: ExtractVibrantColorsOptions,
): readonly PlaygroundVibrantColor[] {
  return extractVibrantColors(imageData.data, imageData.width, imageData.height, options);
}
