import { displayP3ToSrgb, hexToRgb01, parseDisplayP3Css, rgb01ToHex, type Rgb01 } from "../theme/colorSpace";
import { STRIPE_MAX_WIDTH_PX } from "./stripeGridConstants";

export type { Rgb01 };

/** One editable luminosity stripe: a color shown for source cells at/above `startFrom`. */
export type Stripe = {
  id: string;
  /** sRGB hex, e.g. "#EB5729". */
  hex: string;
  /** Wide-gamut CSS, e.g. "color(display-p3 r g b)". Derived from hex unless typed directly. */
  p3Css: string;
  /** Lower luminance bound 0–1; the cell uses the stripe with the greatest startFrom ≤ luminance. */
  startFrom: number;
  /** Stripe thickness in px (1…STRIPE_MAX_WIDTH_PX). */
  width: number;
};

/** Ordered list of stripes (top → bottom in the UI). */
export type StripeColors = { stripes: Stripe[] };

export const STRIPE_WIDTH_MIN = 1;
export const STRIPE_WIDTH_MAX = STRIPE_MAX_WIDTH_PX;
export const STRIPE_START_FROM_MIN = 0;
export const STRIPE_START_FROM_MAX = 1;

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** display-p3 CSS using the hex's own channel values (same look, no gamut expansion). */
export function hexToDisplayP3Css(hex: string): string {
  const [r, g, b] = hexToRgb01(hex);
  return `color(display-p3 ${round4(r)} ${round4(g)} ${round4(b)})`;
}

/** sRGB hex mapped from a display-p3 CSS string. */
export function displayP3CssToHex(css: string): string {
  return rgb01ToHex(displayP3ToSrgb(parseDisplayP3Css(css)));
}

export function clampStripeStartFrom(value: number): number {
  if (!Number.isFinite(value)) {
    return STRIPE_START_FROM_MIN;
  }
  return Math.min(STRIPE_START_FROM_MAX, Math.max(STRIPE_START_FROM_MIN, value));
}

export function clampStripeWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return STRIPE_WIDTH_MIN;
  }
  return Math.min(STRIPE_WIDTH_MAX, Math.max(STRIPE_WIDTH_MIN, value));
}

let stripeIdCounter = 0;

function makeStripeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  stripeIdCounter += 1;
  return `stripe-${Date.now().toString(36)}-${stripeIdCounter}`;
}

/** Normalizes a partial stripe into a complete, clamped stripe (deriving the missing color space). */
export function normalizeStripe(input: Partial<Stripe> & { hex?: string; p3Css?: string }): Stripe {
  const hex = input.hex ?? (input.p3Css ? displayP3CssToHex(input.p3Css) : "#FFFFFF");
  const p3Css = input.p3Css ?? hexToDisplayP3Css(hex);
  return {
    id: input.id ?? makeStripeId(),
    hex,
    p3Css,
    startFrom: clampStripeStartFrom(input.startFrom ?? 0.5),
    width: clampStripeWidth(input.width ?? 3),
  };
}

function stripe(id: string, hex: string, startFrom: number, width: number): Stripe {
  return { id, hex, p3Css: hexToDisplayP3Css(hex), startFrom, width };
}

/** Default playground palette: neutral gray at the darkest threshold ramping up to the loud orange at the brightest. */
export const DEFAULT_STRIPES: readonly Stripe[] = [
  stripe("gray", "#F3F3F3", 0.12, 2),
  stripe("faint", "#FADA98", 0.28, 3),
  stripe("subtle", "#F8BD70", 0.44, 4),
  stripe("muted", "#F69E4D", 0.6, 5),
  stripe("default", "#F27C33", 0.76, 6),
  stripe("loud", "#EB5729", 0.9, 7),
] as const;

export function buildStripeColors(stripes: readonly Stripe[] = DEFAULT_STRIPES): StripeColors {
  return { stripes: stripes.map((entry) => ({ ...entry })) };
}

export function cloneDefaultStripes(): Stripe[] {
  return DEFAULT_STRIPES.map((entry) => ({ ...entry }));
}

export function addStripe(colors: StripeColors): StripeColors {
  const last = colors.stripes[colors.stripes.length - 1];
  const nextStart = last ? clampStripeStartFrom(last.startFrom + 0.1) : 0.5;
  const seed = normalizeStripe({
    hex: last?.hex ?? "#FFFFFF",
    startFrom: nextStart,
    width: last?.width ?? 3,
  });
  return { stripes: [...colors.stripes, seed] };
}

export function removeStripe(colors: StripeColors, id: string): StripeColors {
  return { stripes: colors.stripes.filter((entry) => entry.id !== id) };
}

export function updateStripe(colors: StripeColors, id: string, patch: Partial<Stripe>): StripeColors {
  return {
    stripes: colors.stripes.map((entry) =>
      entry.id === id ? normalizeStripe({ ...entry, ...patch, id: entry.id }) : entry,
    ),
  };
}

/** Shader/filter RGB. Wide gamut maps p3 design tokens to sRGB that survive Pixi's sRGB targets. */
export function resolveStripeRgb(stripe: Stripe, preferP3: boolean): Rgb01 {
  if (!preferP3) {
    return hexToRgb01(stripe.hex);
  }
  return displayP3ToSrgb(parseDisplayP3Css(stripe.p3Css));
}

export type StripePaletteEntry = { rgb: Rgb01; width: number };

/** Per-stripe resolved color + width, in list order, for the palette texture. */
export function resolveStripePalette(colors: StripeColors, preferP3: boolean): StripePaletteEntry[] {
  return colors.stripes.map((entry) => ({
    rgb: resolveStripeRgb(entry, preferP3),
    width: clampStripeWidth(entry.width),
  }));
}

/** Stripe index (1-based; 0 = background) for a 0–1 luminance. */
export function stripeIndexForLuminance(luma01: number, stripes: readonly Stripe[]): number {
  let best = 0;
  let bestStart = -1;
  for (let i = 0; i < stripes.length; i++) {
    const entry = stripes[i]!;
    if (entry.startFrom <= luma01 && entry.startFrom > bestStart) {
      best = i + 1;
      bestStart = entry.startFrom;
    }
  }
  return best;
}

/** 256-entry lookup from luminance byte (0–255) to stripe index. */
export function buildStripeIndexLut(stripes: readonly Stripe[]): Uint8Array {
  const lut = new Uint8Array(256);
  for (let value = 0; value < 256; value++) {
    lut[value] = stripeIndexForLuminance(value / 255, stripes);
  }
  return lut;
}

/** Maps a per-cell luminance grid (0–255) to per-cell stripe indices via a LUT. */
export function resolveStripeIndices(luma: Uint8Array, stripes: readonly Stripe[]): Uint8Array {
  const lut = buildStripeIndexLut(stripes);
  const out = new Uint8Array(luma.length);
  for (let i = 0; i < luma.length; i++) {
    out[i] = lut[luma[i] ?? 0] ?? 0;
  }
  return out;
}

/** Stripe at a 1-based index, or undefined for background / out of range. */
export function stripeAtIndex(colors: StripeColors, index: number): Stripe | undefined {
  if (index < 1 || index > colors.stripes.length) {
    return undefined;
  }
  return colors.stripes[index - 1];
}
