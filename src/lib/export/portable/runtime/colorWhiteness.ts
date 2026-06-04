import type { Rgb01 } from "./stripeFilterOptions";

/** Playground background is always black (no ignore-color swatch). */
export const PLAYGROUND_BLACK_BG: Rgb01 = [0, 0, 0];

export function applyGamma01(value01: number, gamma: number): number {
  if (gamma === 1) {
    return value01;
  }
  return Math.pow(Math.max(0, Math.min(1, value01)), gamma);
}

/** Rec.709 luminance in 0–1 after optional per-channel gamma. */
export function pixelLuminance01(r: number, g: number, b: number, gamma = 1): number {
  const r01 = applyGamma01(r / 255, gamma);
  const g01 = applyGamma01(g / 255, gamma);
  const b01 = applyGamma01(b / 255, gamma);
  return 0.2126 * r01 + 0.7152 * g01 + 0.0722 * b01;
}

/** True when pixel luminance is at or below the darkness cutoff (replaces distance-to-bg match). */
export function isDarkPixelByLuminance(
  r: number,
  g: number,
  b: number,
  maxLuminance: number,
  gamma = 1,
): boolean {
  return pixelLuminance01(r, g, b, gamma) <= maxLuminance;
}
