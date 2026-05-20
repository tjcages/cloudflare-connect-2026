import type { Rgb01 } from "./stripeFilterOptions";

/** How "white" a color reads: 0 = black, 1 = pure white. Uses min(R,G,B). */
export function pixelWhiteness(r: number, g: number, b: number): number {
  return Math.min(r, g, b) / 255;
}

export function applyGamma01(value01: number, gamma: number): number {
  if (gamma === 1) {
    return value01;
  }
  return Math.pow(Math.max(0, Math.min(1, value01)), gamma);
}

function gammaCorrectRgb01(color: Rgb01, gamma: number): Rgb01 {
  if (gamma <= 0) {
    const peak = Math.max(color[0], color[1], color[2]);
    return peak > 0 ? [1, 1, 1] : [0, 0, 0];
  }
  return [applyGamma01(color[0], gamma), applyGamma01(color[1], gamma), applyGamma01(color[2], gamma)];
}

/** Max channel distance from a reference color in 0–1 space (optional gamma before compare). */
export function pixelDistanceFromReference(r: number, g: number, b: number, reference: Rgb01, gamma = 1): number {
  const pixel = gammaCorrectRgb01([r / 255, g / 255, b / 255], gamma);
  const ref = gammaCorrectRgb01(reference, gamma);
  return Math.max(Math.abs(pixel[0] - ref[0]), Math.abs(pixel[1] - ref[1]), Math.abs(pixel[2] - ref[2]));
}

export function isDarkBackground(ignore: Rgb01): boolean {
  return Math.max(ignore[0], ignore[1], ignore[2]) < 0.5;
}

/**
 * Sampled corner color from the frame, or the ignore swatch when corners are unavailable.
 */
export function resolveReferenceColor(sampled: Rgb01 | undefined, ignore: Rgb01): Rgb01 {
  if (sampled) {
    return sampled;
  }
  return ignore;
}

/** Keep sampled bg level tied to the ignore swatch so corner spikes do not flood the frame. */
export function constrainReferenceColor(sampled: Rgb01, ignore: Rgb01, tolerance: number): Rgb01 {
  if (isDarkBackground(ignore)) {
    return [
      Math.min(sampled[0], ignore[0] + tolerance),
      Math.min(sampled[1], ignore[1] + tolerance),
      Math.min(sampled[2], ignore[2] + tolerance),
    ];
  }

  return [
    Math.max(sampled[0], ignore[0] - tolerance),
    Math.max(sampled[1], ignore[1] - tolerance),
    Math.max(sampled[2], ignore[2] - tolerance),
  ];
}

/** EMA smoothing for per-frame corner sampling (reduces stripe color flicker). */
export function smoothReferenceColor(previous: Rgb01 | undefined, next: Rgb01, alpha: number): Rgb01 {
  if (!previous) {
    return next;
  }

  return [
    previous[0] + (next[0] - previous[0]) * alpha,
    previous[1] + (next[1] - previous[1]) * alpha,
    previous[2] + (next[2] - previous[2]) * alpha,
  ];
}

/** True when the pixel is close enough to the reference background color. */
export function isIgnoredBgPixel(
  r: number,
  g: number,
  b: number,
  reference: Rgb01,
  tolerance: number,
  gamma = 1,
): boolean {
  return pixelDistanceFromReference(r, g, b, reference, gamma) <= tolerance;
}

const CORNER_SAMPLE_OFFSET = 6;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted[mid] ?? 0;
}

/** Median RGB at frame corners (actual video background level). */
export function sampleReferenceColorFromFrame(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  ignoreHint?: Rgb01,
  gamma = 1,
): Rgb01 {
  const samples = [
    [CORNER_SAMPLE_OFFSET, CORNER_SAMPLE_OFFSET],
    [imageWidth - 1 - CORNER_SAMPLE_OFFSET, CORNER_SAMPLE_OFFSET],
    [CORNER_SAMPLE_OFFSET, imageHeight - 1 - CORNER_SAMPLE_OFFSET],
    [imageWidth - 1 - CORNER_SAMPLE_OFFSET, imageHeight - 1 - CORNER_SAMPLE_OFFSET],
  ];

  const colors: Rgb01[] = [];
  for (const [x, y] of samples) {
    const idx = (y * imageWidth + x) * 4;
    colors.push(
      gammaCorrectRgb01([(pixels[idx] ?? 0) / 255, (pixels[idx + 1] ?? 0) / 255, (pixels[idx + 2] ?? 0) / 255], gamma),
    );
  }

  if (ignoreHint && isDarkBackground(ignoreHint)) {
    return [
      Math.min(...colors.map((color) => color[0])),
      Math.min(...colors.map((color) => color[1])),
      Math.min(...colors.map((color) => color[2])),
    ];
  }

  if (ignoreHint && !isDarkBackground(ignoreHint)) {
    return [
      Math.max(...colors.map((color) => color[0])),
      Math.max(...colors.map((color) => color[1])),
      Math.max(...colors.map((color) => color[2])),
    ];
  }

  return [
    median(colors.map((color) => color[0])),
    median(colors.map((color) => color[1])),
    median(colors.map((color) => color[2])),
  ];
}

export const REFERENCE_COLOR_SMOOTH_ALPHA = 0.1;
