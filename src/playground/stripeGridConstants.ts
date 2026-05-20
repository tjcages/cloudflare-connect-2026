export const STRIPE_CELL_SIZE = 7;
export const STRIPE_BLOCK_SAMPLES = 7;
export const STRIPE_BLOCK_SAMPLE_COUNT = STRIPE_BLOCK_SAMPLES * STRIPE_BLOCK_SAMPLES;

export const STRIPE_WIDTH_NONE = 0;
export const STRIPE_WIDTH_NARROW = 1;
export const STRIPE_WIDTH_MID = 3;
export const STRIPE_WIDTH_WIDE = 5;

/** Foreground cells fewer than this many 7×7 steps from bg → 1px stripes. */
export const STRIPE_DIST_NARROW_MAX = 2;
/** Foreground cells fewer than this many 7×7 steps from bg → 3px stripes (else 5px). */
export const STRIPE_DIST_MID_MAX = 4;

/** Encoded into block-map texture red channel (0–255). */
export function encodeStripeWidth(width: number): number {
  if (width >= STRIPE_WIDTH_WIDE) return 255;
  if (width >= STRIPE_WIDTH_MID) return 191;
  if (width >= STRIPE_WIDTH_NARROW) return 64;
  return 0;
}
