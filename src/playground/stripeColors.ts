import { hexToRgb01, type Rgb01 } from "./stripeFilterOptions";
import { STRIPE_BAND_COUNT } from "./stripeGridConstants";

/** Playground stripe ramp: bands 1–2 neutral, then oranges near → deep foreground. */
export const PLAYGROUND_STRIPE_BAND_HEX = ["#F3F3F3", "#F3F3F3", "#FFD29C", "#FFAE02", "#FF4802"] as const;

export type StripeBandEnabled = readonly [boolean, boolean, boolean, boolean, boolean];

export const DEFAULT_STRIPE_BAND_ENABLED: StripeBandEnabled = [true, true, true, true, true];

/** Band 1 (near background) … band 5 (deep foreground). */
export type StripeColors = {
  bands: readonly [Rgb01, Rgb01, Rgb01, Rgb01, Rgb01];
  enabled: StripeBandEnabled;
};

export function toggleStripeBandEnabled(enabled: StripeBandEnabled, index: number): StripeBandEnabled {
  return [
    index === 0 ? !enabled[0] : enabled[0],
    index === 1 ? !enabled[1] : enabled[1],
    index === 2 ? !enabled[2] : enabled[2],
    index === 3 ? !enabled[3] : enabled[3],
    index === 4 ? !enabled[4] : enabled[4],
  ];
}

export function buildStripeColors(enabled: StripeBandEnabled = DEFAULT_STRIPE_BAND_ENABLED): StripeColors {
  return {
    bands: [
      hexToRgb01(PLAYGROUND_STRIPE_BAND_HEX[0]),
      hexToRgb01(PLAYGROUND_STRIPE_BAND_HEX[1]),
      hexToRgb01(PLAYGROUND_STRIPE_BAND_HEX[2]),
      hexToRgb01(PLAYGROUND_STRIPE_BAND_HEX[3]),
      hexToRgb01(PLAYGROUND_STRIPE_BAND_HEX[4]),
    ],
    enabled,
  };
}

export function isStripeBandEnabled(colors: StripeColors, band: number): boolean {
  if (band < 1 || band > STRIPE_BAND_COUNT) {
    return false;
  }
  return colors.enabled[band - 1] ?? false;
}

export function stripeColorForBand(colors: StripeColors, band: number): Rgb01 {
  if (band < 1 || band > STRIPE_BAND_COUNT) {
    return colors.bands[0];
  }
  return colors.bands[band - 1] ?? colors.bands[0];
}
