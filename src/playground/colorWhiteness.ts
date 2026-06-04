/** Rec.709 relative luminance, 0 (black) … 1 (white). */
export function pixelLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export const DEFAULT_TEXTURE_GAMMA = 1;
export const TEXTURE_GAMMA_MIN = -5;
export const TEXTURE_GAMMA_MAX = 5;

export function normalizeTextureGamma(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TEXTURE_GAMMA;
  }
  return value;
}

/** Remap sampled texture luminance before stripe bucketing. */
export function applyTextureLuminanceGamma(luma01: number, gamma: number): number {
  const x = Math.min(1, Math.max(0, luma01));
  if (gamma === 1) {
    return x;
  }
  if (gamma > 0) {
    return Math.pow(x, gamma);
  }
  return Math.pow(1 - x, Math.abs(gamma));
}
