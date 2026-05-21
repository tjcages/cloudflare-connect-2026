import { ACCENT_AMBER, ACCENT_LAVA, ACCENT_SOLAR } from "../theme/accents";
import {
  resolveFillRgb,
  stripeFillFromAccent,
  stripeFillFromHex,
  type Rgb01,
  type StripeFillColor,
} from "../theme/colorSpace";
import { PALETTE_THEMES } from "../theme/palette";

const neutralTheme = PALETTE_THEMES.find((theme) => theme.id === "neutral")!;

/** Playground stripe ramp: bands 1–2 neutral gray, then Solar → Amber → Lava (3–5px). */
export const PLAYGROUND_STRIPE_BAND_FILLS: readonly StripeFillColor[] = [
  stripeFillFromHex(neutralTheme.fillHex),
  stripeFillFromHex(neutralTheme.fillHex),
  stripeFillFromAccent(ACCENT_SOLAR),
  stripeFillFromAccent(ACCENT_AMBER),
  stripeFillFromAccent(ACCENT_LAVA),
] as const;

/** sRGB hex per band for UI labels and persistence. */
export const PLAYGROUND_STRIPE_BAND_HEX: readonly [string, string, string, string, string] = [
  PLAYGROUND_STRIPE_BAND_FILLS[0].hex,
  PLAYGROUND_STRIPE_BAND_FILLS[1].hex,
  PLAYGROUND_STRIPE_BAND_FILLS[2].hex,
  PLAYGROUND_STRIPE_BAND_FILLS[3].hex,
  PLAYGROUND_STRIPE_BAND_FILLS[4].hex,
];

export const PLAYGROUND_STRIPE_BAND_SWATCH_P3: readonly [string, string, string, string, string] = [
  PLAYGROUND_STRIPE_BAND_FILLS[0].displayP3Css,
  PLAYGROUND_STRIPE_BAND_FILLS[1].displayP3Css,
  PLAYGROUND_STRIPE_BAND_FILLS[2].displayP3Css,
  PLAYGROUND_STRIPE_BAND_FILLS[3].displayP3Css,
  PLAYGROUND_STRIPE_BAND_FILLS[4].displayP3Css,
];

export type StripeBandEnabled = readonly [boolean, boolean, boolean, boolean, boolean];

export const DEFAULT_STRIPE_BAND_ENABLED: StripeBandEnabled = [true, true, true, true, true];

/** Band 1 (near background) … band 5 (deep foreground). */
export type StripeColors = {
  bands: readonly [StripeFillColor, StripeFillColor, StripeFillColor, StripeFillColor, StripeFillColor];
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
      PLAYGROUND_STRIPE_BAND_FILLS[0],
      PLAYGROUND_STRIPE_BAND_FILLS[1],
      PLAYGROUND_STRIPE_BAND_FILLS[2],
      PLAYGROUND_STRIPE_BAND_FILLS[3],
      PLAYGROUND_STRIPE_BAND_FILLS[4],
    ],
    enabled,
  };
}

export function isStripeBandEnabled(colors: StripeColors, band: number): boolean {
  if (band < 1 || band > 5) {
    return false;
  }
  return colors.enabled[band - 1] ?? false;
}

export function stripeFillForBand(colors: StripeColors, band: number): StripeFillColor {
  if (band < 1 || band > 5) {
    return colors.bands[0];
  }
  return colors.bands[band - 1] ?? colors.bands[0];
}

export function stripeColorForBand(colors: StripeColors, band: number, preferP3 = false): Rgb01 {
  return resolveFillRgb(stripeFillForBand(colors, band), preferP3);
}

export function stripeColorsToUniformRgb(
  colors: StripeColors,
  preferP3: boolean,
): readonly [Rgb01, Rgb01, Rgb01, Rgb01, Rgb01] {
  return [
    resolveFillRgb(colors.bands[0], preferP3),
    resolveFillRgb(colors.bands[1], preferP3),
    resolveFillRgb(colors.bands[2], preferP3),
    resolveFillRgb(colors.bands[3], preferP3),
    resolveFillRgb(colors.bands[4], preferP3),
  ];
}
