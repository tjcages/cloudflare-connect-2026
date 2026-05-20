import { ACCENT_LAVA, ACCENT_SOLAR } from "../theme/accents";
import { hexToRgb01, type Rgb01 } from "./stripeFilterOptions";

export type StripeColors = {
  /** 1px stripes — grid `strokeColor` from the app store. */
  narrow: Rgb01;
  /** 3px stripes — Accent Solar. */
  mid: Rgb01;
  /** 5px stripes — Accent Lava. */
  wide: Rgb01;
};

export function buildStripeColors(gridStrokeHex: string): StripeColors {
  return {
    narrow: hexToRgb01(gridStrokeHex),
    mid: hexToRgb01(ACCENT_SOLAR.hex),
    wide: hexToRgb01(ACCENT_LAVA.hex),
  };
}
