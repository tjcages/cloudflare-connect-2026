import { displayP3ToSrgb, hexToRgb01, parseDisplayP3Css, rgb01ToHex, type Rgb01 } from "./colorSpace";
import type { TextureLuminanceMode } from "./colorWhiteness";
import { STRIPE_MAX_WIDTH_PX, STRIPE_WIDTH_ENCODE_MAX } from "./stripeGridConstants";

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
/** Default stripe thickness ceiling for the default cell; UI widens this with the cell size. */
export const STRIPE_WIDTH_MAX = STRIPE_MAX_WIDTH_PX;
/** Absolute storage ceiling so wide cells can carry thick stripes without re-clamping. */
export const STRIPE_WIDTH_STORAGE_MAX = STRIPE_WIDTH_ENCODE_MAX;
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

export function clampStripeWidth(value: number, maxWidth: number = STRIPE_WIDTH_STORAGE_MAX): number {
  if (!Number.isFinite(value)) {
    return STRIPE_WIDTH_MIN;
  }
  return Math.min(maxWidth, Math.max(STRIPE_WIDTH_MIN, value));
}

let stripeIdCounter = 0;

function makeStripeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  stripeIdCounter += 1;
  return `stripe-${Date.now().toString(36)}-${stripeIdCounter}`;
}

/** Leva/sRGB hex picker value → stripe fields with synced display-p3 CSS. */
export function stripeColorFromHexPicker(hex: string): Pick<Stripe, "hex" | "p3Css"> {
  const normalized = hex.trim();
  return { hex: normalized, p3Css: hexToDisplayP3Css(normalized) };
}

/** Pixi 0xRRGGBB tint encoded for the playground display-p3 drawing buffer. */
export function resolvePlaygroundPixiTint(color: number, preferP3: boolean): number {
  if (!preferP3) {
    return color & 0xffffff;
  }
  const [r, g, b] = resolvePlaygroundShaderRgb(playgroundBackgroundColorToHex(color), true);
  const byte = (channel: number) => Math.round(Math.min(1, Math.max(0, channel)) * 255);
  return (byte(r) << 16) | (byte(g) << 8) | byte(b);
}

function playgroundBackgroundColorToHex(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

/** Shader/filter RGB from an sRGB hex picker value. */
export function resolvePlaygroundShaderRgb(hex: string, preferP3: boolean): Rgb01 {
  if (!preferP3) {
    return hexToRgb01(hex);
  }
  return displayP3ToSrgb(parseDisplayP3Css(hexToDisplayP3Css(hex)));
}

/** Normalizes a partial stripe into a complete, clamped stripe (deriving the missing color space). */
export function normalizeStripe(input: Partial<Stripe> & { hex?: string; p3Css?: string }): Stripe {
  const p3Only = input.p3Css !== undefined && input.hex === undefined;
  const hex = input.hex ?? (input.p3Css ? displayP3CssToHex(input.p3Css) : "#FFFFFF");
  const p3Css = p3Only ? input.p3Css! : hexToDisplayP3Css(hex);
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
  stripe("gray", "#F3F3F3", 0.12, 1),
  stripe("faint", "#FADA98", 0.28, 1),
  stripe("subtle", "#F8BD70", 0.44, 2),
  stripe("muted", "#F69E4D", 0.6, 3),
  stripe("default", "#F27C33", 0.76, 4),
  stripe("loud", "#EB5729", 0.9, 5),
] as const;

/** Colors-mode thresholds and uniform widths (hex values are unused while cell colors drive fill). */
export const DEFAULT_COLORS_MODE_STRIPES: readonly Stripe[] = [
  stripe("color-1", "#FFFFFF", 0.08, 5),
  stripe("color-2", "#FFFFFF", 0.18, 5),
  stripe("color-3", "#FFFFFF", 0.3, 5),
  stripe("color-4", "#FFFFFF", 0.45, 5),
  stripe("color-5", "#FFFFFF", 0.62, 5),
  stripe("color-6", "#FFFFFF", 0.8, 5),
] as const;

/** Overlay-mode palette: loudest three luminance bands drawn on top of the source texture. */
export const DEFAULT_OVERLAY_STRIPES: readonly Stripe[] = [
  stripe("overlay-muted", "#F69E4D", 0.6, 3),
  stripe("overlay-default", "#F27C33", 0.76, 4),
  stripe("overlay-loud", "#EB5729", 0.9, 5),
] as const;

export function buildStripeColors(stripes: readonly Stripe[] = DEFAULT_STRIPES): StripeColors {
  return { stripes: stripes.map((entry) => ({ ...entry })) };
}

export function cloneDefaultStripes(): Stripe[] {
  return DEFAULT_STRIPES.map((entry) => ({ ...entry }));
}

export function cloneDefaultOverlayStripes(): Stripe[] {
  return DEFAULT_OVERLAY_STRIPES.map((entry) => ({ ...entry }));
}

export function overlayStripesMatchDefault(stripes: readonly Stripe[]): boolean {
  if (stripes.length !== DEFAULT_OVERLAY_STRIPES.length) {
    return false;
  }
  return stripes.every((stripe, index) => {
    const base = DEFAULT_OVERLAY_STRIPES[index]!;
    return (
      stripe.hex.toLowerCase() === base.hex.toLowerCase() &&
      stripe.startFrom === base.startFrom &&
      stripe.width === base.width
    );
  });
}

/** Applies colors-mode threshold and width defaults to an existing stripe list (preserves ids/hex). */
export function applyColorsModeStripeDefaults(stripes: readonly Stripe[]): Stripe[] {
  return stripes.map((entry, index) => {
    const defaults =
      DEFAULT_COLORS_MODE_STRIPES[index] ?? DEFAULT_COLORS_MODE_STRIPES[DEFAULT_COLORS_MODE_STRIPES.length - 1]!;
    return normalizeStripe({
      ...entry,
      startFrom: defaults.startFrom,
      width: defaults.width,
    });
  });
}

/** Stripe list used for grid bucketing and palette widths, adjusted per luminance mode. */
export function resolveStripesForLuminanceMode(colors: StripeColors, mode: TextureLuminanceMode): readonly Stripe[] {
  switch (mode) {
    case "colors":
      if (colors.stripes.length === 0) {
        return DEFAULT_COLORS_MODE_STRIPES.map((entry) => ({ ...entry }));
      }
      return colors.stripes.map((entry, index) => {
        const defaults =
          DEFAULT_COLORS_MODE_STRIPES[index] ?? DEFAULT_COLORS_MODE_STRIPES[DEFAULT_COLORS_MODE_STRIPES.length - 1]!;
        return normalizeStripe({
          ...entry,
          width: entry.width ?? defaults.width,
        });
      });
    case "overlay":
      return colors.stripes;
    case "luminance":
      return colors.stripes;
    default: {
      const unexpected: never = mode;
      throw new Error(`Unhandled texture luminance mode: ${unexpected}`);
    }
  }
}

/** Active stripe list for rendering, based on luminance mode. */
export function resolveActivePlaygroundStripes(
  mode: TextureLuminanceMode,
  stripes: readonly Stripe[],
  overlayStripes: readonly Stripe[],
): readonly Stripe[] {
  return mode === "overlay" ? overlayStripes : stripes;
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

/**
 * Reorders stripe colors to a new id sequence while pinning startFrom/width to
 * position ("color only" reorder). The color identity (id, hex, p3Css) travels to
 * its new slot; each slot keeps its original startFrom/width. Returns a fresh copy
 * unchanged if orderedIds does not match the current id set.
 */
export function reorderStripeColors(stripes: readonly Stripe[], orderedIds: readonly string[]): Stripe[] {
  if (orderedIds.length !== stripes.length) {
    return stripes.map((entry) => ({ ...entry }));
  }
  const byId = new Map(stripes.map((entry) => [entry.id, entry]));
  const reordered: Stripe[] = [];
  for (const id of orderedIds) {
    const entry = byId.get(id);
    if (!entry) {
      return stripes.map((copy) => ({ ...copy }));
    }
    reordered.push(entry);
  }
  return reordered.map((entry, index) => ({
    ...entry,
    startFrom: stripes[index]!.startFrom,
    width: stripes[index]!.width,
  }));
}

/** Shader/filter RGB. Wide gamut always derives display-p3 from the stripe hex picker value. */
export function resolveStripeRgb(stripe: Stripe, preferP3: boolean): Rgb01 {
  return resolvePlaygroundShaderRgb(stripe.hex, preferP3);
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
