export const STRIPE_CELL_SIZE = 7;
export const STRIPE_BLOCK_SAMPLES = 7;
export const STRIPE_BLOCK_SAMPLE_COUNT = STRIPE_BLOCK_SAMPLES * STRIPE_BLOCK_SAMPLES;

/** Default minimum ms between block-grid rebuilds (reduces temporal shimmer on noisy clips). */
export const STRIPE_GRID_UPDATE_INTERVAL_MS = 66;

export const STRIPE_INDEX_NONE = 0;
/** Largest stripe index that fits in the block-map red channel (1 byte). */
export const STRIPE_INDEX_MAX = 255;
/** Stripe thickness ceiling in px for the default cell (equals the default cell size). */
export const STRIPE_MAX_WIDTH_PX = 7;
/**
 * Fixed denominator the stripe palette encodes width against (px). Decoupled from the cell
 * size so cells wider than the default can still carry full-width stripes without clipping.
 */
export const STRIPE_WIDTH_ENCODE_MAX = 64;

/** Block-map red channel stores the stripe index directly (0 = background, 1…N). */
export function encodeStripeIndex(index: number): number {
  if (index <= STRIPE_INDEX_NONE) {
    return STRIPE_INDEX_NONE;
  }
  return Math.min(STRIPE_INDEX_MAX, Math.round(index));
}

export function decodeStripeIndex(encoded: number): number {
  return Math.max(STRIPE_INDEX_NONE, Math.min(STRIPE_INDEX_MAX, Math.round(encoded)));
}
