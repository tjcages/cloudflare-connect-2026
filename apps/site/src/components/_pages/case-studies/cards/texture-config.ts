import type { Stripe } from "@necatikcl/stripes-engine";
import type { StripesTextureConfig } from "@/components/stripes-texture/config";

export const CARD_SPARKLE: NonNullable<StripesTextureConfig["sparkle"]> = {
  stripe: {
    enabled: true,
    coverage: 0.3,
    maxBrightness: 0.15,
    speed: 0.4,
    thickestCount: 4,
    hueDriftDeg: -16,
    saturationBoost: 0.25,
  },
  width: {
    enabled: true,
    coverage: 0.5,
    swingPx: 2,
    swingPeriodMin: 0.5,
    swingPeriodMax: 1,
  },
  motion: {
    enabled: true,
    amplitudePx: 6,
    staggerPx: 35,
    maxOffsetPx: 128,
    speed: 0.55,
    direction: "rightToLeft",
  },
};

export const CARD_TEXTURE_CONFIG: StripesTextureConfig = {
  background: {
    stars: {
      enabled: true,
      density: 2,
      sizePx: 12,
      sizeRandomness: 1,
      tiltAngleDeg: -15,
      opacity: 1,
    },
  },
  maxFps: 60,
  transform: { fit: "cover" },
  grid: { overlapAmount: 1.2 },
  reveal: {
    enabled: true,
    type: "water",
  },
  sparkle: CARD_SPARKLE,
  flames: {
    enabled: true,
    direction: "upDown",
    minWidthRatio: 0.01,
    maxWidthRatio: 0.025,
    minHeightRatio: 0.02,
    maxHeightRatio: 0.12,
    spawnIntervalMs: 80,
    maxActive: 25,
    opacityMax: 0.6,
  },
  edgeMask: {
    enabled: true,
    power: 0.6,
  },
  clickWave: { enabled: true },
  cursorTrail: {
    enabled: true,
    type: "wave",
  },
};

export interface CardSparkleStripe {
  hueDriftDeg?: number;
  saturationBoost?: number;
  maxBrightness?: number;
}

export interface CardTextureOverrides {
  stripes: Stripe[];
  whitePoint?: number;
  sparkleStripe?: CardSparkleStripe;
  stripeGradient?: readonly number[];
}

export function cardTextureConfig({
  stripes,
  whitePoint,
  sparkleStripe,
  stripeGradient,
}: CardTextureOverrides): StripesTextureConfig {
  return {
    ...CARD_TEXTURE_CONFIG,
    ...(whitePoint !== undefined && {
      adjustments: { whitePoint },
    }),
    stripes,
    sparkle: {
      ...CARD_SPARKLE,
      stripe: { ...CARD_SPARKLE.stripe, ...sparkleStripe },
    },
    ...(stripeGradient && {
      colors: {
        gradient: {
          enabled: true,
          stopCount: stripeGradient.length,
          stops: [...stripeGradient],
        },
      },
    }),
  };
}

const STRIPE_STARTS = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
const STRIPE_WIDTHS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

export type StripeColors = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export function cardStripes(colors: StripeColors): Stripe[] {
  return colors.map((color, index) => ({
    color,
    startFrom: STRIPE_STARTS[index],
    width: STRIPE_WIDTHS[index],
    opacity: 1,
  }));
}
