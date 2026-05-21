import { STRIPE_BAND_COUNT, STRIPE_BAND_NONE } from "./stripeGridConstants";

const BAND_LEVELS = [STRIPE_BAND_NONE, 1, 2, 3, 4, 5] as const;

function bandIndex(band: number): number {
  const clamped = Math.max(STRIPE_BAND_NONE, Math.min(STRIPE_BAND_COUNT, Math.round(band)));
  const index = BAND_LEVELS.indexOf(clamped as (typeof BAND_LEVELS)[number]);
  return index >= 0 ? index : 0;
}

function bandFromIndex(index: number): number {
  return BAND_LEVELS[Math.max(0, Math.min(BAND_LEVELS.length - 1, index))] ?? STRIPE_BAND_NONE;
}

/**
 * Limit stripe-band changes to one step per update so colors do not snap frame to frame.
 */
export function smoothBlockGridBands(next: Uint8Array, previous: Uint8Array | undefined): Uint8Array {
  if (!previous || previous.length !== next.length) {
    return new Uint8Array(next);
  }

  const out = new Uint8Array(next.length);
  for (let i = 0; i < next.length; i++) {
    const prevBand = bandIndex(previous[i] ?? 0);
    const nextBand = bandIndex(next[i] ?? 0);
    let band = prevBand;

    if (nextBand > prevBand) {
      band = prevBand + 1;
    } else if (nextBand < prevBand) {
      band = prevBand - 1;
    }

    out[i] = bandFromIndex(band);
  }

  return out;
}
