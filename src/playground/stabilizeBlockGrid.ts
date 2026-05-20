import { STRIPE_WIDTH_MID, STRIPE_WIDTH_NARROW, STRIPE_WIDTH_NONE, STRIPE_WIDTH_WIDE } from "./stripeGridConstants";

const WIDTH_BANDS = [STRIPE_WIDTH_NONE, STRIPE_WIDTH_NARROW, STRIPE_WIDTH_MID, STRIPE_WIDTH_WIDE] as const;

function widthBandIndex(width: number): number {
  if (width >= STRIPE_WIDTH_WIDE) {
    return 3;
  }
  if (width >= STRIPE_WIDTH_MID) {
    return 2;
  }
  if (width >= STRIPE_WIDTH_NARROW) {
    return 1;
  }
  return 0;
}

function widthFromBandIndex(index: number): number {
  return WIDTH_BANDS[Math.max(0, Math.min(WIDTH_BANDS.length - 1, index))] ?? STRIPE_WIDTH_NONE;
}

/**
 * Limit stripe-width band changes to one step per update so colors do not snap frame to frame.
 */
export function smoothBlockGridWidths(next: Uint8Array, previous: Uint8Array | undefined): Uint8Array {
  if (!previous || previous.length !== next.length) {
    return new Uint8Array(next);
  }

  const out = new Uint8Array(next.length);
  for (let i = 0; i < next.length; i++) {
    const prevBand = widthBandIndex(previous[i] ?? 0);
    const nextBand = widthBandIndex(next[i] ?? 0);
    let band = prevBand;

    if (nextBand > prevBand) {
      band = prevBand + 1;
    } else if (nextBand < prevBand) {
      band = prevBand - 1;
    }

    out[i] = widthFromBandIndex(band);
  }

  return out;
}
