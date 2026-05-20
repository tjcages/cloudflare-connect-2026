import type { Rgb01 } from "./stripeFilterOptions";

/** How "white" a color reads: 0 = black, 1 = pure white. Uses min(R,G,B). */
export function pixelWhiteness(r: number, g: number, b: number): number {
  return Math.min(r, g, b) / 255;
}

export function bgWhiteness(ignore: Rgb01): number {
  return Math.min(ignore[0], ignore[1], ignore[2]);
}

/**
 * Reference whiteness from a sampled frame (corners). Falls back to ignore swatch.
 */
export function resolveReferenceWhiteness(referenceWhiteness: number | undefined, ignore: Rgb01): number {
  if (referenceWhiteness !== undefined && Number.isFinite(referenceWhiteness)) {
    return referenceWhiteness;
  }
  return bgWhiteness(ignore);
}

/** True when the pixel is as white as the reference background (within tolerance). */
export function isIgnoredBgPixel(
  r: number,
  g: number,
  b: number,
  referenceWhiteness: number,
  tolerance: number,
): boolean {
  return pixelWhiteness(r, g, b) >= referenceWhiteness - tolerance;
}

/**
 * How much less white than the reference bg (0 = same white level, higher = more colored/darker).
 */
export function whitenessDeficitFromBg(r: number, g: number, b: number, referenceWhiteness: number): number {
  return Math.max(0, referenceWhiteness - pixelWhiteness(r, g, b));
}

const CORNER_SAMPLE_OFFSET = 6;

/** Median reference whiteness from frame corners (actual video background level). */
export function sampleReferenceWhitenessFromFrame(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
): number {
  const samples = [
    [CORNER_SAMPLE_OFFSET, CORNER_SAMPLE_OFFSET],
    [imageWidth - 1 - CORNER_SAMPLE_OFFSET, CORNER_SAMPLE_OFFSET],
    [CORNER_SAMPLE_OFFSET, imageHeight - 1 - CORNER_SAMPLE_OFFSET],
    [imageWidth - 1 - CORNER_SAMPLE_OFFSET, imageHeight - 1 - CORNER_SAMPLE_OFFSET],
  ];

  const values: number[] = [];
  for (const [x, y] of samples) {
    const idx = (y * imageWidth + x) * 4;
    values.push(pixelWhiteness(pixels[idx] ?? 0, pixels[idx + 1] ?? 0, pixels[idx + 2] ?? 0));
  }

  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values[mid] ?? 1;
}
