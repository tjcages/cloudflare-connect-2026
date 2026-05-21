export const STRIPE_CELL_SIZE = 7;
export const STRIPE_BLOCK_SAMPLES = 7;
export const STRIPE_BLOCK_SAMPLE_COUNT = STRIPE_BLOCK_SAMPLES * STRIPE_BLOCK_SAMPLES;

export const STRIPE_BAND_NONE = 0;
export const STRIPE_BAND_COUNT = 5;
export const STRIPE_MAX_WIDTH_PX = 5;

/** Equal steps on a 5px max: ceil(band × 5 / 5). */
export function widthPxFromBand(band: number): number {
  if (band <= STRIPE_BAND_NONE) {
    return 0;
  }
  return Math.min(STRIPE_MAX_WIDTH_PX, Math.max(1, Math.ceil((band * STRIPE_MAX_WIDTH_PX) / STRIPE_BAND_COUNT)));
}

function bandDecodeThreshold(band: number): number {
  return Math.round(((band - 0.5) / STRIPE_BAND_COUNT) * 255);
}

/** Encoded into block-map texture red channel (0–255). */
export function encodeStripeBand(band: number): number {
  if (band <= STRIPE_BAND_NONE) {
    return 0;
  }
  return Math.round((band / STRIPE_BAND_COUNT) * 255);
}

export function decodeStripeBand(encoded: number): number {
  if (encoded < bandDecodeThreshold(1)) {
    return STRIPE_BAND_NONE;
  }
  for (let band = STRIPE_BAND_COUNT; band >= 1; band--) {
    if (encoded >= bandDecodeThreshold(band)) {
      return band;
    }
  }
  return STRIPE_BAND_NONE;
}

/** Chain-cap flags stored in the block-map green channel (bit0=top, bit1=bottom). */
export const CHAIN_CAP_NONE = 0;
export const CHAIN_CAP_TOP = 1;
export const CHAIN_CAP_BOTTOM = 2;
export const CHAIN_CAP_BOTH = CHAIN_CAP_TOP | CHAIN_CAP_BOTTOM;

export function encodeChainCaps(flags: number): number {
  return flags * 64;
}
