import { COLOR_LIBRARY } from "../components/colorLibrary";
import { EASING_OPTIONS, easeValue, type EasingName } from "./easing";
import type { EditableStripe } from "./stripeAdapter";

export const STRIPE_PALETTE_LEVELS = [
  "1000",
  "900",
  "800",
  "700",
  "650",
  "600",
  "500",
  "400",
  "300",
  "200",
  "100",
  "0",
] as const;

export type StripePaletteLevel = (typeof STRIPE_PALETTE_LEVELS)[number];
export const DEFAULT_STRIPE_PALETTE_NAME = "Default";
export const DEFAULT_STRIPE_PALETTE_GROUP = "Orange";
export const WHITE_STRIPE_PALETTE_NAME = "White";
export const BACKGROUND_RAMP_PALETTE_NAME = "Background Ramp";
const WHITE_STRIPE_HEX = "#ffffff";
const WHITE_STRIPE_OPACITY_MAX = 0.7;
const WHITE_BACKGROUND_FIRST_STRIPE_HEX = "#fafafa";
const WHITE_BACKGROUND_STRIPE_LEVELS = ["0", "100", "200", "300", "400", "500", "600", "650", "700", "800"] as const;
const BACKGROUND_RAMP_20_BASE_THRESHOLD = 0.2;
const BACKGROUND_RAMP_40_BASE_THRESHOLD = 0.4;
const BACKGROUND_RAMP_60_BASE_THRESHOLD = 0.6;
const BACKGROUND_RAMP_70_BASE_THRESHOLD = 0.7;
const BACKGROUND_RAMP_80_BASE_THRESHOLD = 0.8;
export const BACKGROUND_RAMP_EASING_OPTIONS = EASING_OPTIONS;
export type BackgroundRampEasing = EasingName;
export type BackgroundRampSettings = {
  maxLightnessUnder20: number;
  maxLightness20To40: number;
  maxLightness40To60: number;
  maxLightness60To70: number;
  maxLightness70To80: number;
  maxLightnessOver80: number;
  hueDriftDeg: number;
  saturationBoost: number;
};

export const DEFAULT_BACKGROUND_RAMP_SETTINGS: BackgroundRampSettings = {
  maxLightnessUnder20: 50,
  maxLightness20To40: 60,
  maxLightness40To60: 70,
  maxLightness60To70: 80,
  maxLightness70To80: 90,
  maxLightnessOver80: 100,
  hueDriftDeg: 4,
  saturationBoost: 26,
};

export function normalizeBackgroundRampSettings(
  input: Partial<BackgroundRampSettings> | null | undefined,
): BackgroundRampSettings {
  const n = (value: unknown, fallback: number, min: number, max: number): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  return {
    maxLightnessUnder20: n(input?.maxLightnessUnder20, DEFAULT_BACKGROUND_RAMP_SETTINGS.maxLightnessUnder20, 0, 100),
    maxLightness20To40: n(input?.maxLightness20To40, DEFAULT_BACKGROUND_RAMP_SETTINGS.maxLightness20To40, 0, 100),
    maxLightness40To60: n(input?.maxLightness40To60, DEFAULT_BACKGROUND_RAMP_SETTINGS.maxLightness40To60, 0, 100),
    maxLightness60To70: n(input?.maxLightness60To70, DEFAULT_BACKGROUND_RAMP_SETTINGS.maxLightness60To70, 0, 100),
    maxLightness70To80: n(input?.maxLightness70To80, DEFAULT_BACKGROUND_RAMP_SETTINGS.maxLightness70To80, 0, 100),
    maxLightnessOver80: n(input?.maxLightnessOver80, DEFAULT_BACKGROUND_RAMP_SETTINGS.maxLightnessOver80, 0, 100),
    hueDriftDeg: n(input?.hueDriftDeg, DEFAULT_BACKGROUND_RAMP_SETTINGS.hueDriftDeg, 0, 45),
    saturationBoost: n(input?.saturationBoost, DEFAULT_BACKGROUND_RAMP_SETTINGS.saturationBoost, 0, 100),
  };
}

function whitePaletteOpacity(index: number, count: number, easing: BackgroundRampEasing): number {
  const t = count <= 1 ? 1 : index / (count - 1);
  return Number((WHITE_STRIPE_OPACITY_MAX * easeRampT(t, easing)).toFixed(4));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeHex(value: string | undefined): string | null {
  if (!value) return null;
  const raw = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toLowerCase()}` : null;
}

function srgbDecode(value: number): number {
  const v = clamp01(value);
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function srgbEncode(value: number): number {
  const v = clamp01(value);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

function hexToDisplayP3(hex: string): [number, number, number] {
  const raw = normalizeHex(hex)?.replace(/^#/, "") ?? "000000";
  return [
    Number.parseInt(raw.slice(0, 2), 16) / 255,
    Number.parseInt(raw.slice(2, 4), 16) / 255,
    Number.parseInt(raw.slice(4, 6), 16) / 255,
  ];
}

function displayP3ToLinearSrgb([r, g, b]: [number, number, number]): [number, number, number] {
  const pr = srgbDecode(r);
  const pg = srgbDecode(g);
  const pb = srgbDecode(b);
  const x = 0.4865709486482162 * pr + 0.26566769316909306 * pg + 0.1982172852343625 * pb;
  const y = 0.2289745640697488 * pr + 0.6917385218365064 * pg + 0.079286914093745 * pb;
  const z = 0.04511338185890264 * pg + 1.043944368900976 * pb;
  return [
    3.240969941904521 * x - 1.537383177570093 * y - 0.498610760293 * z,
    -0.96924363628087 * x + 1.87596750150772 * y + 0.041555057407175 * z,
    0.055630079696993 * x - 0.20397695888897 * y + 1.056971514242878 * z,
  ];
}

function linearSrgbToOklch([r, g, b]: [number, number, number]): { l: number; c: number; h: number } {
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const l = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const h = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l, c: Math.sqrt(a * a + bb * bb), h };
}

function oklchToLinearSrgb(l: number, c: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const ll = l_ ** 3;
  const mm = m_ ** 3;
  const ss = s_ ** 3;
  return [
    4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss,
    -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss,
    -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss,
  ];
}

function linearSrgbToDisplayP3([r, g, b]: [number, number, number]): [number, number, number] {
  const x = 0.41239079926595934 * r + 0.35758433938387796 * g + 0.1804807884018343 * b;
  const y = 0.21263900587151027 * r + 0.7151686787677559 * g + 0.07219231536073371 * b;
  const z = 0.01933081871559185 * r + 0.11919477979462599 * g + 0.9505321522496607 * b;
  return [
    srgbEncode(2.493496911941425 * x - 0.931383617919124 * y - 0.402710784450717 * z),
    srgbEncode(-0.829488969561575 * x + 1.762664060318346 * y + 0.023624685841943 * z),
    srgbEncode(0.035845830243784 * x - 0.076172389268041 * y + 0.956884524007687 * z),
  ];
}

function displayP3ToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(clamp01(channel) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function shortestHueDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

function easeRampT(t: number, easing: BackgroundRampEasing): number {
  return easeValue(t, easing);
}

function lightHueShift(hue: number, settings: BackgroundRampSettings): number {
  const drift = settings.hueDriftDeg;
  if (hue >= 25 && hue < 80) return drift;
  if (hue >= 80 && hue < 180) return -drift;
  if (hue >= 180 && hue < 285) return -drift;
  if (hue >= 285 && hue < 340) return drift;
  if (hue >= 340) return drift;
  return -drift;
}

function backgroundRampMaxOklchLightness(baseOklchLightness: number, settings: BackgroundRampSettings): number {
  if (baseOklchLightness < BACKGROUND_RAMP_20_BASE_THRESHOLD) return settings.maxLightnessUnder20 / 100;
  if (baseOklchLightness < BACKGROUND_RAMP_40_BASE_THRESHOLD) return settings.maxLightness20To40 / 100;
  if (baseOklchLightness < BACKGROUND_RAMP_60_BASE_THRESHOLD) return settings.maxLightness40To60 / 100;
  if (baseOklchLightness < BACKGROUND_RAMP_70_BASE_THRESHOLD) return settings.maxLightness60To70 / 100;
  if (baseOklchLightness < BACKGROUND_RAMP_80_BASE_THRESHOLD) return settings.maxLightness70To80 / 100;
  return settings.maxLightnessOver80 / 100;
}

function oklchChromaForLightness(chroma: number, lightness: number): number {
  if (lightness <= 0.92) return chroma;
  const t = clamp01((lightness - 0.92) / 0.08);
  const fadeToWhite = t * t * (3 - 2 * t);
  return chroma * (1 - fadeToWhite);
}

function backgroundRampHex(
  baseHex: string | undefined,
  stripes: readonly EditableStripe[],
  easing: BackgroundRampEasing = "easeInOutQuad",
  rampSettings: BackgroundRampSettings = DEFAULT_BACKGROUND_RAMP_SETTINGS,
): string[] {
  const settings = normalizeBackgroundRampSettings(rampSettings);
  const fallback = normalizeHex(baseHex) ?? normalizeHex(stripes[0]?.hex) ?? "#5865f2";
  const baseP3 = hexToDisplayP3(fallback);
  const base = linearSrgbToOklch(displayP3ToLinearSrgb(baseP3));
  const count = Math.max(1, stripes.length);
  const hueTarget = (base.h + lightHueShift(base.h, settings) + 360) % 360;
  const hueDelta = shortestHueDelta(base.h, hueTarget);
  const maxLightness = backgroundRampMaxOklchLightness(base.l, settings);
  const saturationBoost = settings.saturationBoost / 100;
  const baseStartL = Math.min(base.l, maxLightness);
  const endL = Math.max(baseStartL, maxLightness);

  return stripes.map((_, index) => {
    const rampT = count === 1 ? 1 : index / (count - 1);
    const brightnessT = count === 1 ? 1 : (index + 1) / count;
    const easedBrightnessT = easeRampT(brightnessT, easing);
    const l = baseStartL + (endL - baseStartL) * easedBrightnessT;
    const saturationLift = saturationBoost * Math.sin(rampT * Math.PI * 0.85);
    const rawChroma = Math.max(0.01, Math.min(0.34, base.c * (1 + saturationLift)));
    const c = oklchChromaForLightness(rawChroma, l);
    const h = (base.h + hueDelta * rampT + 360) % 360;
    return displayP3ToHex(linearSrgbToDisplayP3(oklchToLinearSrgb(l, c, h)));
  });
}

function stripePaletteLevelFromLabel(label: string): StripePaletteLevel | null {
  const level = label.match(/^\d+/)?.[0];
  return STRIPE_PALETTE_LEVELS.includes(level as StripePaletteLevel) ? (level as StripePaletteLevel) : null;
}

export const STRIPE_PALETTE_GROUPS = COLOR_LIBRARY.filter(
  (group) =>
    group.name !== "Neutral" && group.colors.some((color) => stripePaletteLevelFromLabel(color.label) !== null),
);
export const STRIPE_PALETTE_NAMES = [
  DEFAULT_STRIPE_PALETTE_NAME,
  ...STRIPE_PALETTE_GROUPS.map((group) => group.name),
  WHITE_STRIPE_PALETTE_NAME,
  BACKGROUND_RAMP_PALETTE_NAME,
] as const;

const GROUP_BY_NAME = new Map(STRIPE_PALETTE_GROUPS.map((group) => [group.name, group]));
const TOKEN_BY_HEX = new Map<string, { groupName: string; level: StripePaletteLevel }>();

for (const group of STRIPE_PALETTE_GROUPS) {
  for (const color of group.colors) {
    const level = stripePaletteLevelFromLabel(color.label);
    if (!level) continue;
    TOKEN_BY_HEX.set(color.hex.toLowerCase(), { groupName: group.name, level });
  }
}

export function stripePaletteOptions(): Record<string, string> {
  return Object.fromEntries(STRIPE_PALETTE_NAMES.map((name) => [name, name]));
}

export function detectStripePalette(
  stripes: readonly EditableStripe[],
  backgroundHex?: string | null,
  backgroundRampEasing: BackgroundRampEasing = "easeInOutQuad",
  backgroundRampSettings: BackgroundRampSettings = DEFAULT_BACKGROUND_RAMP_SETTINGS,
): string | null {
  if (
    stripes.length > 0 &&
    stripes.every(
      (stripe, index) =>
        stripe.hex.toLowerCase() === WHITE_STRIPE_HEX &&
        Math.abs(stripe.opacity - whitePaletteOpacity(index, stripes.length, backgroundRampEasing)) < 0.001,
    )
  ) {
    return WHITE_STRIPE_PALETTE_NAME;
  }
  if (stripes.length > 0 && backgroundHex) {
    const ramp = backgroundRampHex(backgroundHex, stripes, backgroundRampEasing, backgroundRampSettings);
    if (stripes.every((stripe, index) => stripe.hex.toLowerCase() === ramp[index])) {
      return BACKGROUND_RAMP_PALETTE_NAME;
    }
  }
  const tokens = stripes.map((stripe) => TOKEN_BY_HEX.get(stripe.hex.toLowerCase())).filter(Boolean);
  if (tokens.length === 0) return null;
  const first = tokens[0]?.groupName;
  return first && tokens.every((token) => token?.groupName === first) ? first : null;
}

function paletteHex(groupName: string, level: StripePaletteLevel): string | null {
  const color = GROUP_BY_NAME.get(groupName)?.colors.find(
    (candidate) => stripePaletteLevelFromLabel(candidate.label) === level,
  );
  return color?.hex ?? null;
}

function stripeLevel(_stripe: EditableStripe, index: number): StripePaletteLevel | undefined {
  return STRIPE_PALETTE_LEVELS[index];
}

function dynamicStripeLevelsFromBackground(backgroundHex?: string | null): StripePaletteLevel[] {
  const token = backgroundHex ? TOKEN_BY_HEX.get(backgroundHex.toLowerCase()) : null;
  if (!token) return STRIPE_PALETTE_LEVELS.slice();
  const startIndex = Math.min(STRIPE_PALETTE_LEVELS.length - 1, STRIPE_PALETTE_LEVELS.indexOf(token.level) + 1);
  return STRIPE_PALETTE_LEVELS.slice(startIndex);
}

function isWhiteBackground(backgroundHex?: string | null): boolean {
  return normalizeHex(backgroundHex ?? undefined) === WHITE_STRIPE_HEX;
}

function whiteBackgroundStripeLevel(index: number): StripePaletteLevel {
  return (
    WHITE_BACKGROUND_STRIPE_LEVELS[index] ?? WHITE_BACKGROUND_STRIPE_LEVELS[WHITE_BACKGROUND_STRIPE_LEVELS.length - 1]
  );
}

export function mapPaletteColor(hex: string, groupName: string): string | null {
  const token = TOKEN_BY_HEX.get(hex.toLowerCase());
  if (!token) return null;
  const resolvedGroupName = groupName === DEFAULT_STRIPE_PALETTE_NAME ? DEFAULT_STRIPE_PALETTE_GROUP : groupName;
  return paletteHex(resolvedGroupName, token.level);
}

export function applyStripePalette(
  stripes: readonly EditableStripe[],
  groupName: string,
  backgroundHex?: string | null,
  backgroundRampEasing: BackgroundRampEasing = "easeInOutQuad",
  backgroundRampSettings: BackgroundRampSettings = DEFAULT_BACKGROUND_RAMP_SETTINGS,
): EditableStripe[] {
  const resolvedGroupName = groupName === DEFAULT_STRIPE_PALETTE_NAME ? DEFAULT_STRIPE_PALETTE_GROUP : groupName;
  if (groupName === WHITE_STRIPE_PALETTE_NAME) {
    return stripes.map((stripe, index) => ({
      ...stripe,
      hex: WHITE_STRIPE_HEX,
      opacity: whitePaletteOpacity(index, stripes.length, backgroundRampEasing),
    }));
  }
  if (groupName === BACKGROUND_RAMP_PALETTE_NAME) {
    const ramp = backgroundRampHex(backgroundHex ?? undefined, stripes, backgroundRampEasing, backgroundRampSettings);
    return stripes.map((stripe, index) => ({
      ...stripe,
      hex: ramp[index] ?? stripe.hex,
      opacity: 1,
    }));
  }
  if (isWhiteBackground(backgroundHex)) {
    return stripes.map((stripe, index) => {
      if (index === 0) return { ...stripe, hex: WHITE_BACKGROUND_FIRST_STRIPE_HEX, opacity: 1 };
      const hex = paletteHex(resolvedGroupName, whiteBackgroundStripeLevel(index - 1));
      return hex ? { ...stripe, hex, opacity: 1 } : stripe;
    });
  }
  const dynamicLevels = dynamicStripeLevelsFromBackground(backgroundHex);
  return stripes.map((stripe, index) => {
    const level = dynamicLevels[index] ?? dynamicLevels[dynamicLevels.length - 1] ?? stripeLevel(stripe, index);
    if (!level) return stripe;
    const hex = paletteHex(resolvedGroupName, level);
    return hex ? { ...stripe, hex, opacity: 1 } : stripe;
  });
}

export function shuffleStripePalette(
  stripes: readonly EditableStripe[],
  random: () => number = Math.random,
): EditableStripe[] {
  const groupNames = STRIPE_PALETTE_GROUPS.map((group) => group.name);
  if (groupNames.length === 0) return [...stripes];

  return stripes.map((stripe, index) => {
    const level = stripeLevel(stripe, index);
    if (!level) return stripe;
    const groupName = groupNames[Math.floor(random() * groupNames.length) % groupNames.length];
    const hex = paletteHex(groupName, level);
    return hex ? { ...stripe, hex } : stripe;
  });
}
