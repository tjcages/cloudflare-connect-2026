import type { StripesTextureConfig } from "@/components/stripes-texture/config";

const GRAY_STRIPES = [
  { color: 0xfafafa, startFrom: 0.03, width: 0.5, opacity: 1 },
  { color: 0xf4f4f4, startFrom: 0.0889, width: 0.5, opacity: 1 },
  { color: 0xf0f0f0, startFrom: 0.1778, width: 1, opacity: 1 },
  { color: 0xebebeb, startFrom: 0.2667, width: 1.5, opacity: 1 },
  { color: 0xd1d1d1, startFrom: 0.3556, width: 1.5, opacity: 1 },
  { color: 0xadadad, startFrom: 0.4444, width: 2, opacity: 1 },
  { color: 0x8f8f8f, startFrom: 0.5333, width: 2.5, opacity: 1 },
  { color: 0x707070, startFrom: 0.6222, width: 3, opacity: 1 },
  { color: 0x5c5c5c, startFrom: 0.7111, width: 3.5, opacity: 1 },
  { color: 0x292929, startFrom: 0.8, width: 4, opacity: 1 },
];

const darkWhiteStripes = (ninthOpacity: number) => [
  { color: 0xffffff, startFrom: 0, width: 0.5, opacity: 0 },
  { color: 0xffffff, startFrom: 0.0889, width: 0.5, opacity: 0.1 },
  { color: 0xffffff, startFrom: 0.1778, width: 1, opacity: 0.2 },
  { color: 0xffffff, startFrom: 0.2667, width: 1.5, opacity: 0.3 },
  { color: 0xffffff, startFrom: 0.3556, width: 1.5, opacity: 0.4 },
  { color: 0xffffff, startFrom: 0.4444, width: 2, opacity: 0.5 },
  { color: 0xffffff, startFrom: 0.5333, width: 2.5, opacity: 0.6 },
  { color: 0xffffff, startFrom: 0.6222, width: 3, opacity: 0.7 },
  { color: 0xffffff, startFrom: 0.7111, width: 3.5, opacity: ninthOpacity },
  { color: 0xffffff, startFrom: 0.8, width: 4, opacity: 1 },
];

const ORANGE_STRIPES = [
  { color: 0xfc682b, startFrom: 0, width: 0.5, opacity: 1 },
  { color: 0xff6800, startFrom: 0.0195, width: 0.5, opacity: 1 },
  { color: 0xff6a00, startFrom: 0.047, width: 1, opacity: 1 },
  { color: 0xff7000, startFrom: 0.086, width: 1.5, opacity: 1 },
  { color: 0xff7a00, startFrom: 0.1408, width: 1.5, opacity: 1 },
  { color: 0xff8700, startFrom: 0.2167, width: 2, opacity: 1 },
  { color: 0xff9500, startFrom: 0.3191, width: 2.5, opacity: 1 },
  { color: 0xffa400, startFrom: 0.4512, width: 3, opacity: 1 },
  { color: 0xffbc15, startFrom: 0.6129, width: 3.5, opacity: 1 },
  { color: 0xffcd63, startFrom: 0.8, width: 4, opacity: 1 },
];

const quoteColors = {
  mode: "colors" as const,
  imageColorLightness: 0,
  autoDetectBackground: false,
  backgroundColor: 0xffffff,
};

const quoteFramesDark = {
  luminanceThreshold: 0.68,
  highlightedStripeCount: 6,
};

const quoteBaseConfig = (): StripesTextureConfig => ({
  grid: { overlapAmount: 1.2 },
  reveal: {
    enabled: true,
    type: "water",
    water: { intensity: 1.5 },
  },
  sparkle: {
    width: {
      enabled: true,
      coverage: 0.5,
      swingPx: 2,
      swingPeriodMin: 0.5,
      swingPeriodMax: 1,
    },
    stripe: {
      enabled: true,
      coverage: 0.2,
      maxBrightness: 0.1,
      speed: 0.2,
      thickestCount: 4,
      hueDriftDeg: 20,
      saturationBoost: 0.4,
    },
  },
  stripeDots: {
    enabled: true,
    density: 0.24,
    randomVisibility: 0.24,
    brightness: 0.13,
  },
  frames: {
    enabled: true,
    luminanceThreshold: 0.5,
    highlightedStripeCount: 4,
    color: 0x38c5f6,
    fontSizePx: 8,
  },
  edgeMask: {
    enabled: true,
    start: 0,
    end: 0.5,
  },
  cursorTrail: {
    enabled: true,
    particleAlpha: 0.08,
    particleLifeMs: 1000,
    spreadMinPx: 1,
    spreadMaxPx: 20,
    pushWobblePx: 12,
  },
  clickWave: { enabled: true },
  colors: quoteColors,
});

const quoteFlames = (
  overrides: NonNullable<StripesTextureConfig["flames"]>
) => ({
  enabled: true,
  direction: "upDown" as const,
  minWidthRatio: 0.005,
  maxWidthRatio: 0.02,
  minHeightRatio: 0.02,
  maxHeightRatio: 0.04,
  baseSpeedPxPerSec: 30,
  spawnIntervalMs: 80,
  opacityMax: 0.9,
  ...overrides,
});

export const QUOTE_TEXTURE_CONFIGS = {
  shopify: {
    ...quoteBaseConfig(),
    stripes: GRAY_STRIPES,
    flames: quoteFlames({ maxActive: 80, opacityMin: 0.7 }),
    dark: {
      stripes: darkWhiteStripes(0.9),
      frames: quoteFramesDark,
      flames: { maxActive: 60, opacityMax: 1 },
      colors: { backgroundColor: 0x000000 },
    },
  },
  lovable: {
    ...quoteBaseConfig(),
    stripes: GRAY_STRIPES,
    flames: quoteFlames({ maxActive: 80 }),
    dark: {
      stripes: darkWhiteStripes(0.9),
      frames: quoteFramesDark,
      flames: { maxActive: 60 },
      colors: { backgroundColor: 0x000000 },
    },
  },
  intercom: {
    ...quoteBaseConfig(),
    stripes: ORANGE_STRIPES,
    flames: quoteFlames({ maxActive: 45 }),
    dark: {
      stripes: darkWhiteStripes(0.8),
      frames: quoteFramesDark,
      flames: { maxActive: 60 },
      colors: { mode: "luminance" },
    },
  },
  zendesk: {
    ...quoteBaseConfig(),
    stripes: GRAY_STRIPES,
    flames: quoteFlames({ maxActive: 80, opacityMin: 0.7 }),
    dark: {
      stripes: darkWhiteStripes(0.9),
      frames: quoteFramesDark,
      flames: { maxActive: 60, opacityMax: 1 },
      colors: { backgroundColor: 0x000000 },
    },
  },
  npm: {
    ...quoteBaseConfig(),
    stripes: GRAY_STRIPES,
    flames: quoteFlames({ maxActive: 80 }),
    dark: {
      stripes: darkWhiteStripes(0.9),
      frames: quoteFramesDark,
      flames: { maxActive: 60, opacityMin: 0.7, opacityMax: 1 },
      colors: { backgroundColor: 0x000000 },
    },
  },
  liveblocks: {
    ...quoteBaseConfig(),
    stripes: GRAY_STRIPES,
    colors: { ...quoteColors, mode: "luminance" },
    flames: quoteFlames({ maxActive: 45 }),
    dark: {
      stripes: darkWhiteStripes(0.8),
      frames: quoteFramesDark,
      flames: { maxActive: 60 },
    },
  },
  leagued: {
    ...quoteBaseConfig(),
    stripes: ORANGE_STRIPES,
    flames: quoteFlames({ maxActive: 45 }),
    edgeMask: {
      enabled: true,
      start: 0.06,
      end: 0.25,
      power: 0.4,
    },
    dark: {
      stripes: darkWhiteStripes(0.8),
      frames: quoteFramesDark,
      colors: { backgroundColor: 0x000000 },
    },
  },
  sitegpt: {
    ...quoteBaseConfig(),
    stripes: ORANGE_STRIPES,
    flames: quoteFlames({ maxActive: 45 }),
    edgeMask: {
      enabled: true,
      start: 0.06,
      end: 0.25,
      power: 0.4,
    },
    dark: {
      stripes: darkWhiteStripes(0.8),
      frames: quoteFramesDark,
      colors: { backgroundColor: 0x000000 },
    },
  },
} satisfies Record<string, StripesTextureConfig>;

export type QuoteBrand = keyof typeof QUOTE_TEXTURE_CONFIGS;
