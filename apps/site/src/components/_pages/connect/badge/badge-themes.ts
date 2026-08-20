import type { DeepPartial, EngineConfig } from "@necatikcl/stripes-engine";
import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import {
  COLOR_LIBRARY,
  findLibraryColor,
  LIBRARY_COLOR,
} from "@/components/_pages/connect/panel/colorLibrary";
import { CONNECT_HERO_RAIN_CONFIG } from "@/components/_pages/connect/hero/hero-rain-config";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "@/components/_pages/connect/hero/twizzler-defaults";

/** Lab Color presets (`CLIENT_COLOR_PRESETS`) — a handful, not the full editor. */
export const BADGE_THEME_IDS = [
  "coral-classic",
  "brand",
  "red",
  "green",
  "blue",
  "purple",
  "soft-gold",
  "deep-ember",
  "light",
] as const;

export type BadgeThemeId = (typeof BADGE_THEME_IDS)[number];

export type BadgeTwizzlerInk = Pick<
  TwizzlerSettings,
  "color" | "colorFar" | "colorNear" | "colorEdge"
>;

export type BadgeStripePaletteName =
  "Default" | "Red" | "Orange" | "Green" | "Blue" | "Purple" | "Neutral";

export type BadgeTheme = {
  id: BadgeThemeId;
  label: string;
  stripePalette: BadgeStripePaletteName;
  twizzler: BadgeTwizzlerInk;
  /** Swatch + fallback fill while the hero shaders copy onto the badge. */
  accent: string;
  pair: string;
  deep: string;
  stripeHexes: readonly string[];
};

export const DEFAULT_BADGE_THEME_ID: BadgeThemeId = "coral-classic";

/** Factory rain mix — lab Default Color. */
const DEFAULT_STRIPE_PALETTE_HEXES = [
  "#fafafa",
  "#fff8e8",
  "#feefd2",
  "#ffe3b5",
  "#9038fc",
  "#2563fe",
  "#2e9d51",
  "#f9b73b",
  "#f9b73b",
  "#f46021",
] as const;

const WHITE_BACKGROUND_FIRST_STRIPE_HEX = "#fafafa";
const WHITE_BACKGROUND_STRIPE_LEVELS = [
  "0",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "900",
  "1000",
  "1100",
  "1200",
  "1300",
  "1400",
  "1500",
] as const;

const NEUTRAL_STRIPE_LEVELS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
] as const;

const HERO_STRIPE_COUNT = CONNECT_HERO_RAIN_CONFIG.stripes?.length ?? 10;

function libraryHexForLevel(groupName: string, level: string): string | null {
  const group = COLOR_LIBRARY.find((entry) => entry.name === groupName);
  if (!group) return null;
  const match = group.colors.find((color) => {
    const token = color.label.match(/^\d+/)?.[0];
    return token === level || color.label === level;
  });
  return match?.hex ?? null;
}

function hueFamilyInk(
  group: "Red" | "Orange" | "Green" | "Blue" | "Purple"
): BadgeTwizzlerInk {
  const pair = findLibraryColor(group, "800 [Pair]")?.hex;
  const accent = findLibraryColor(group, "900 [Accent]")?.hex;
  const deep = findLibraryColor(group, "1000")?.hex;
  if (!pair || !accent || !deep) {
    throw new Error(`Missing ${group} library Pair/Accent/Deep tokens`);
  }
  return { color: accent, colorFar: pair, colorNear: accent, colorEdge: deep };
}

function stripeHexesForPalette(
  palette: BadgeStripePaletteName,
  count: number
): string[] {
  if (palette === "Default") {
    return Array.from(
      { length: count },
      (_, index) =>
        DEFAULT_STRIPE_PALETTE_HEXES[index] ??
        DEFAULT_STRIPE_PALETTE_HEXES[DEFAULT_STRIPE_PALETTE_HEXES.length - 1]
    );
  }
  if (palette === "Neutral") {
    return Array.from({ length: count }, (_, index) => {
      const level =
        NEUTRAL_STRIPE_LEVELS[index] ??
        NEUTRAL_STRIPE_LEVELS[NEUTRAL_STRIPE_LEVELS.length - 1];
      return libraryHexForLevel("Neutral", level) ?? "#f0f0f0";
    });
  }
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return WHITE_BACKGROUND_FIRST_STRIPE_HEX;
    const level =
      WHITE_BACKGROUND_STRIPE_LEVELS[index - 1] ??
      WHITE_BACKGROUND_STRIPE_LEVELS[WHITE_BACKGROUND_STRIPE_LEVELS.length - 1];
    return libraryHexForLevel(palette, level) ?? "#cccccc";
  });
}

function theme(
  id: BadgeThemeId,
  label: string,
  stripePalette: BadgeStripePaletteName,
  twizzler: BadgeTwizzlerInk,
  accent: string,
  pair: string,
  deep: string
): BadgeTheme {
  return {
    id,
    label,
    stripePalette,
    twizzler,
    accent,
    pair,
    deep,
    stripeHexes: stripeHexesForPalette(stripePalette, HERO_STRIPE_COUNT),
  };
}

const defaultInk: BadgeTwizzlerInk = {
  color: LIBRARY_COLOR.orangeAccent,
  colorFar: LIBRARY_COLOR.orangePair,
  colorNear: LIBRARY_COLOR.orangeAccent,
  colorEdge: LIBRARY_COLOR.redAccent,
};

export const BADGE_THEMES: readonly BadgeTheme[] = [
  theme(
    "coral-classic",
    "Default",
    "Default",
    defaultInk,
    LIBRARY_COLOR.orangeAccent,
    LIBRARY_COLOR.orangePair,
    LIBRARY_COLOR.orangeDeep
  ),
  theme(
    "brand",
    "Brand",
    "Orange",
    {
      color: LIBRARY_COLOR.orangeBrand,
      colorFar: LIBRARY_COLOR.orangePair,
      colorNear: LIBRARY_COLOR.orangeBrand,
      colorEdge: LIBRARY_COLOR.orangeAccent,
    },
    LIBRARY_COLOR.orangeBrand,
    LIBRARY_COLOR.orangePair,
    LIBRARY_COLOR.orangeDeep
  ),
  (() => {
    const ink = hueFamilyInk("Red");
    return theme(
      "red",
      "Red",
      "Red",
      ink,
      ink.colorNear,
      ink.colorFar,
      ink.colorEdge
    );
  })(),
  (() => {
    const ink = hueFamilyInk("Green");
    return theme(
      "green",
      "Green",
      "Green",
      ink,
      ink.colorNear,
      ink.colorFar,
      ink.colorEdge
    );
  })(),
  (() => {
    const ink = hueFamilyInk("Blue");
    return theme(
      "blue",
      "Blue",
      "Blue",
      ink,
      ink.colorNear,
      ink.colorFar,
      ink.colorEdge
    );
  })(),
  (() => {
    const ink = hueFamilyInk("Purple");
    return theme(
      "purple",
      "Purple",
      "Purple",
      ink,
      ink.colorNear,
      ink.colorFar,
      ink.colorEdge
    );
  })(),
  theme(
    "soft-gold",
    "Orange pair",
    "Orange",
    {
      color: LIBRARY_COLOR.orangePair,
      colorFar: LIBRARY_COLOR.orangePair,
      colorNear: LIBRARY_COLOR.orangePair,
      colorEdge: LIBRARY_COLOR.orangeAccent,
    },
    LIBRARY_COLOR.orangePair,
    LIBRARY_COLOR.orangeAccent,
    LIBRARY_COLOR.orangeDeep
  ),
  theme(
    "deep-ember",
    "Orange deep",
    "Orange",
    {
      color: LIBRARY_COLOR.orangeDeep,
      colorFar: LIBRARY_COLOR.orangePair,
      colorNear: LIBRARY_COLOR.orangeDeep,
      colorEdge: LIBRARY_COLOR.redAccent,
    },
    LIBRARY_COLOR.orangeDeep,
    LIBRARY_COLOR.orangePair,
    LIBRARY_COLOR.redAccent
  ),
  theme(
    "light",
    "Light",
    "Neutral",
    {
      color: "#ffefd4",
      colorFar: "#ffd39e",
      colorNear: "#ffefd4",
      colorEdge: "#f0f0f0",
    },
    "#ffd39e",
    "#ffefd4",
    LIBRARY_COLOR.graphite
  ),
];

const THEME_BY_ID = new Map(BADGE_THEMES.map((entry) => [entry.id, entry]));

export function isBadgeThemeId(
  value: string | null | undefined
): value is BadgeThemeId {
  return BADGE_THEME_IDS.some((id) => id === value);
}

export function findBadgeTheme(id: string | null | undefined): BadgeTheme {
  if (isBadgeThemeId(id)) {
    const match = THEME_BY_ID.get(id);
    if (match) return match;
  }
  return THEME_BY_ID.get(DEFAULT_BADGE_THEME_ID)!;
}

export function hexToColorInt(hex: string): number {
  return Number.parseInt(hex.replace(/^#/, ""), 16) || 0;
}

export function hexLuma(hex: string): number {
  const raw = hex.replace(/^#/, "");
  if (raw.length < 6) return 0;
  const r = Number.parseInt(raw.slice(0, 2), 16) / 255;
  const g = Number.parseInt(raw.slice(2, 4), 16) / 255;
  const b = Number.parseInt(raw.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Saturated accents tint the mark. Light accents fall back to the deep token. */
export function badgeMarkFill(theme: BadgeTheme): string {
  return hexLuma(theme.accent) > 0.65 ? theme.deep : theme.accent;
}

export function badgeSwatchColors(theme: BadgeTheme): readonly [string, string, string, string] {
  const highlight = hexLuma(theme.accent) > 0.72 ? "#ffffff" : theme.pair;
  return [theme.deep, theme.accent, highlight, theme.pair];
}

export function applyThemeToTwizzler(themeEntry: BadgeTheme): TwizzlerSettings {
  const ink = themeEntry.twizzler;
  return {
    ...CONNECT_HERO_TWIZZLER_DEFAULTS,
    color: ink.color,
    colorFar: ink.colorFar,
    colorNear: ink.colorNear,
    colorEdge: ink.colorEdge,
    gradientStops: CONNECT_HERO_TWIZZLER_DEFAULTS.gradientStops.map(
      (stop, index) => ({
        ...stop,
        color:
          index === 0
            ? ink.colorFar
            : index === 1
              ? ink.colorEdge
              : ink.colorNear,
      })
    ),
  };
}

export function applyThemeToRain(
  themeEntry: BadgeTheme,
  seed: number
): DeepPartial<EngineConfig> {
  const base = CONNECT_HERO_RAIN_CONFIG;
  return {
    ...base,
    stripes: (base.stripes ?? []).map((stripe, index) => ({
      ...stripe,
      color: hexToColorInt(
        themeEntry.stripeHexes[index] ??
          themeEntry.stripeHexes[themeEntry.stripeHexes.length - 1] ??
          themeEntry.accent
      ),
    })),
    background: {
      ...base.background,
      meteors: {
        ...base.background?.meteors,
        seed: (Math.abs(seed) % 997) + 1,
      },
    },
  };
}
