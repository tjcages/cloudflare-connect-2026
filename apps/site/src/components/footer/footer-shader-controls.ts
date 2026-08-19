import type { StripesTextureConfig } from "@/components/stripes-texture/config";
import { FOOTER_TEXTURE_CONFIG } from "./texture-config";

export type FooterShaderStripeControl = {
  id: string;
  color: string;
  startFrom: number;
  width: number;
  opacity: number;
};

export type FooterShaderSettings = {
  rainEnabled: boolean;
  gapsCoverage: number;
  gapsSpeed: number;
  waveEnabled: boolean;
  waveSqueeze: number;
  waveWavelengthCells: number;
  waveSpeed: number;
  wavePhaseDeg: number;
  gridCellWidth: number;
  gridCellHeight: number;
  gridGapX: number;
  gridGapY: number;
  gridCornerRadius: number;
  gridOverlap: number;
  gridOrientation: "vertical" | "horizontal";
  gridAngle: number;
  stripesEnabled: boolean;
  fieldScale: number;
  stripes: FooterShaderStripeControl[];
  brightness: number;
  exposure: number;
  contrast: number;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  invert: boolean;
  posterizeLevels: number;
  thresholdBias: number;
  noiseAmount: number;
  blurRadius: number;
  sharpenAmount: number;
  sparkleWidthEnabled: boolean;
  sparkleWidthCoverage: number;
  sparkleSwing: number;
  sparkleStripeEnabled: boolean;
  sparkleStripeCoverage: number;
  sparkleBrightness: number;
  sparkleSpeed: number;
  sparkleHueDrift: number;
  sparkleSaturation: number;
  motionEnabled: boolean;
  motionAmplitude: number;
  motionStagger: number;
  motionMaxOffset: number;
  motionSpeed: number;
  motionDirection: "leftToRight" | "rightToLeft";
  dotsEnabled: boolean;
  dotsDensity: number;
  dotsVisibility: number;
  dotsSize: number;
  dotsBrightness: number;
  dotsHueDrift: number;
  dotsSaturation: number;
  borderEnabled: boolean;
  borderMinWidth: number;
  borderDensity: number;
  gridLinesEnabled: boolean;
  gridLinesBrightness: number;
  gridLinesDensity: number;
  flamesEnabled: boolean;
  engineFramesEnabled: boolean;
  engineFrameThreshold: number;
  engineFrameStripeCount: number;
  engineFrameDistance: number;
  engineFrameColor: string;
  trailEnabled: boolean;
  trailAlpha: number;
  trailLife: number;
  shaderOpacity: number;
};

const toHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

const authoredNum = (value: number | undefined, fallback: number) =>
  typeof value === "number" ? value : fallback;

const FOOTER_STRIPES = FOOTER_TEXTURE_CONFIG.stripes ?? [];
const FOOTER_SPARKLE = FOOTER_TEXTURE_CONFIG.sparkle;
const FOOTER_GAPS = FOOTER_SPARKLE?.gaps;
const FOOTER_GRID = FOOTER_TEXTURE_CONFIG.grid;
const FOOTER_WAVE = FOOTER_GRID?.streamGapWave;
const FOOTER_TONE = FOOTER_TEXTURE_CONFIG.adjustments;
const FOOTER_DOTS = FOOTER_TEXTURE_CONFIG.stripeDots;
const FOOTER_FRAMES = FOOTER_TEXTURE_CONFIG.frames;
const FOOTER_TRAIL = FOOTER_TEXTURE_CONFIG.cursorTrail;

const defaultStripes = (): FooterShaderStripeControl[] =>
  FOOTER_STRIPES.map((stripe, index) => ({
    id: `stripe-${index + 1}`,
    color: toHex(stripe.color),
    startFrom: stripe.startFrom,
    width: stripe.width,
    opacity: stripe.opacity,
  }));

/**
 * Shipped footer texture look — Reset and empty storage. Mirrors
 * `FOOTER_TEXTURE_CONFIG` so panel Copy/Reset stay in step with production.
 */
export const FOOTER_SHADER_DEFAULTS: FooterShaderSettings = {
  rainEnabled: FOOTER_GAPS?.enabled ?? true,
  gapsCoverage: authoredNum(FOOTER_GAPS?.coverage, 0),
  gapsSpeed: authoredNum(FOOTER_GAPS?.speed, 1),
  waveEnabled: FOOTER_WAVE?.enabled ?? false,
  waveSqueeze: authoredNum(FOOTER_WAVE?.squeeze, 0),
  waveWavelengthCells: authoredNum(FOOTER_WAVE?.wavelengthCells, 16),
  waveSpeed: authoredNum(FOOTER_WAVE?.speed, 0),
  wavePhaseDeg: authoredNum(FOOTER_WAVE?.phaseDeg, 0),
  gridCellWidth: authoredNum(FOOTER_GRID?.cellWidth, 7),
  gridCellHeight: authoredNum(FOOTER_GRID?.cellHeight, 5),
  gridGapX: authoredNum(FOOTER_GRID?.gapX, 0),
  gridGapY: authoredNum(FOOTER_GRID?.gapY, 0),
  gridCornerRadius: authoredNum(FOOTER_GRID?.cornerRadius, 0),
  gridOverlap: authoredNum(FOOTER_GRID?.overlapAmount, 1.2),
  gridOrientation: FOOTER_GRID?.orientation ?? "vertical",
  gridAngle: authoredNum(FOOTER_GRID?.angleDeg, 45),
  stripesEnabled: FOOTER_TEXTURE_CONFIG.stripesEnabled ?? true,
  fieldScale: authoredNum(FOOTER_TEXTURE_CONFIG.fieldScale, 0.25),
  stripes: defaultStripes(),
  brightness: authoredNum(FOOTER_TONE?.brightness, 0),
  exposure: authoredNum(FOOTER_TONE?.exposure, 0),
  contrast: authoredNum(FOOTER_TONE?.contrast, 1),
  blackPoint: authoredNum(FOOTER_TONE?.blackPoint, 0),
  whitePoint: authoredNum(FOOTER_TONE?.whitePoint, 1),
  gamma: authoredNum(FOOTER_TONE?.gamma, 1),
  invert: FOOTER_TONE?.invert ?? false,
  posterizeLevels: authoredNum(FOOTER_TONE?.posterizeLevels, 0),
  thresholdBias: authoredNum(FOOTER_TONE?.thresholdBias, 0),
  noiseAmount: authoredNum(FOOTER_TONE?.noiseAmount, 0),
  blurRadius: authoredNum(FOOTER_TONE?.blurRadius, 0),
  sharpenAmount: authoredNum(FOOTER_TONE?.sharpenAmount, 0),
  sparkleWidthEnabled: FOOTER_SPARKLE?.width?.enabled ?? true,
  sparkleWidthCoverage: authoredNum(FOOTER_SPARKLE?.width?.coverage, 0.22),
  sparkleSwing: authoredNum(FOOTER_SPARKLE?.width?.swingPx, 2),
  sparkleStripeEnabled: FOOTER_SPARKLE?.stripe?.enabled ?? true,
  sparkleStripeCoverage: authoredNum(FOOTER_SPARKLE?.stripe?.coverage, 0.12),
  sparkleBrightness: authoredNum(FOOTER_SPARKLE?.stripe?.maxBrightness, 0.1),
  sparkleSpeed: authoredNum(FOOTER_SPARKLE?.stripe?.speed, 0.2),
  sparkleHueDrift: 0,
  sparkleSaturation: authoredNum(FOOTER_SPARKLE?.stripe?.saturationBoost, 0.4),
  motionEnabled: false,
  motionAmplitude: 4,
  motionStagger: 24,
  motionMaxOffset: 12,
  motionSpeed: 1,
  motionDirection: "leftToRight",
  dotsEnabled: true,
  dotsDensity: authoredNum(FOOTER_DOTS?.density, 0.19),
  dotsVisibility: authoredNum(FOOTER_DOTS?.randomVisibility, 0.14),
  dotsSize: 1.5,
  dotsBrightness: authoredNum(FOOTER_DOTS?.brightness, 0.15),
  dotsHueDrift: authoredNum(FOOTER_DOTS?.hueDriftDeg, 15),
  dotsSaturation: 0,
  borderEnabled: false,
  borderMinWidth: 2,
  borderDensity: 1,
  gridLinesEnabled: false,
  gridLinesBrightness: 0.35,
  gridLinesDensity: 1,
  flamesEnabled: true,
  engineFramesEnabled: true,
  engineFrameThreshold: authoredNum(FOOTER_FRAMES?.luminanceThreshold, 0.65),
  engineFrameStripeCount: authoredNum(FOOTER_FRAMES?.highlightedStripeCount, 7),
  engineFrameDistance: authoredNum(FOOTER_FRAMES?.groupDistanceCells, 3),
  engineFrameColor: toHex(authoredNum(FOOTER_FRAMES?.color, 0xfea700)),
  trailEnabled: true,
  trailAlpha: authoredNum(FOOTER_TRAIL?.particleAlpha, 0.08),
  trailLife: authoredNum(FOOTER_TRAIL?.particleLifeMs, 1000),
  shaderOpacity: 1,
};

export const FOOTER_SHADER_CURRENT: FooterShaderSettings = {
  ...FOOTER_SHADER_DEFAULTS,
  stripes: defaultStripes(),
};

export const FOOTER_SHADER_PANEL_ID = "connect-footer-shader-v1";
export const FOOTER_SHADER_SETTINGS_EVENT = "connect:footer-shader-settings";

const cloneSettings = (source: FooterShaderSettings): FooterShaderSettings => ({
  ...source,
  stripes: source.stripes.map((stripe) => ({ ...stripe })),
});

const isStripe = (value: unknown): value is FooterShaderStripeControl => {
  if (!value || typeof value !== "object") return false;
  const stripe = value as Partial<FooterShaderStripeControl>;
  return (
    typeof stripe.id === "string" &&
    typeof stripe.color === "string" &&
    typeof stripe.startFrom === "number" &&
    typeof stripe.width === "number" &&
    typeof stripe.opacity === "number"
  );
};

export const loadFooterShaderSettings = (): FooterShaderSettings => {
  const settings = cloneSettings(FOOTER_SHADER_CURRENT);
  try {
    const raw = localStorage.getItem(`panels:${FOOTER_SHADER_PANEL_ID}`);
    if (!raw) return settings;
    const parsed = JSON.parse(raw) as Partial<FooterShaderSettings>;
    for (const key of Object.keys(settings) as (keyof FooterShaderSettings)[]) {
      const value = parsed[key];
      const fallback = settings[key];
      if (key === "stripes" && Array.isArray(value)) {
        const stripes = value.filter(isStripe).slice(0, 24);
        if (stripes.length > 0) settings.stripes = stripes;
      } else if (typeof value === typeof fallback) {
        (settings as Record<string, unknown>)[key] = value;
      }
    }
    return settings;
  } catch {
    return settings;
  }
};

export const publishFooterShaderSettings = (settings: FooterShaderSettings) => {
  window.dispatchEvent(
    new CustomEvent<FooterShaderSettings>(FOOTER_SHADER_SETTINGS_EVENT, {
      detail: settings,
    }),
  );
};

const colorNumber = (value: string, fallback: number) => {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[\da-f]{6}$/i.test(normalized)) return fallback;
  return Number.parseInt(normalized, 16);
};

export function footerTextureConfigFromSettings(settings: FooterShaderSettings): StripesTextureConfig {
  const grid = {
    cellWidth: settings.gridCellWidth,
    cellHeight: settings.gridCellHeight,
    gapX: settings.gridGapX,
    gapY: settings.gridGapY,
    cornerRadius: settings.gridCornerRadius,
    overlapAmount: settings.gridOverlap,
    orientation: settings.gridOrientation,
    angleDeg: settings.gridAngle,
    streamGapWave: {
      enabled: settings.waveEnabled,
      squeeze: settings.waveSqueeze,
      wavelengthCells: settings.waveWavelengthCells,
      speed: settings.waveSpeed,
      phaseDeg: settings.wavePhaseDeg,
    },
  };
  const sparkle = {
    gaps: {
      enabled: settings.rainEnabled,
      coverage: settings.gapsCoverage,
      speed: settings.gapsSpeed,
    },
    width: {
      ...(FOOTER_SPARKLE?.width ?? {}),
      enabled: settings.sparkleWidthEnabled,
      coverage: settings.sparkleWidthCoverage,
      swingPx: settings.sparkleSwing,
    },
    stripe: {
      ...(FOOTER_SPARKLE?.stripe ?? {}),
      enabled: settings.sparkleStripeEnabled,
      coverage: settings.sparkleStripeCoverage,
      maxBrightness: settings.sparkleBrightness,
      speed: settings.sparkleSpeed,
      hueDriftDeg: settings.sparkleHueDrift,
      saturationBoost: settings.sparkleSaturation,
    },
    motion: {
      enabled: settings.motionEnabled,
      amplitudePx: settings.motionAmplitude,
      staggerPx: settings.motionStagger,
      maxOffsetPx: settings.motionMaxOffset,
      speed: settings.motionSpeed,
      direction: settings.motionDirection,
    },
  };
  return {
    ...FOOTER_TEXTURE_CONFIG,
    fieldScale: settings.fieldScale,
    stripesEnabled: settings.stripesEnabled,
    stripes: settings.stripes.map((stripe) => ({
      color: colorNumber(stripe.color, FOOTER_STRIPES[0]?.color ?? 0xfafafa),
      startFrom: stripe.startFrom,
      width: stripe.width,
      opacity: stripe.opacity,
    })),
    grid,
    sparkle,
    adjustments: {
      brightness: settings.brightness,
      exposure: settings.exposure,
      contrast: settings.contrast,
      blackPoint: settings.blackPoint,
      whitePoint: settings.whitePoint,
      gamma: settings.gamma,
      invert: settings.invert,
      posterizeLevels: settings.posterizeLevels,
      thresholdBias: settings.thresholdBias,
      noiseAmount: settings.noiseAmount,
      blurRadius: settings.blurRadius,
      sharpenAmount: settings.sharpenAmount,
    },
    stripeDots: {
      ...(FOOTER_DOTS ?? {}),
      enabled: settings.dotsEnabled,
      density: settings.dotsDensity,
      randomVisibility: settings.dotsVisibility,
      sizePx: settings.dotsSize,
      brightness: settings.dotsBrightness,
      hueDriftDeg: settings.dotsHueDrift,
      saturationBoost: settings.dotsSaturation,
    },
    stripeBorder: {
      enabled: settings.borderEnabled,
      minWidthPx: settings.borderMinWidth,
      density: settings.borderDensity,
    },
    gridLines: {
      enabled: settings.gridLinesEnabled,
      brightness: settings.gridLinesBrightness,
      density: settings.gridLinesDensity,
    },
    flames: {
      ...(FOOTER_TEXTURE_CONFIG.flames ?? {}),
      enabled: settings.flamesEnabled,
    },
    frames: {
      ...(FOOTER_FRAMES ?? {}),
      enabled: settings.engineFramesEnabled,
      luminanceThreshold: settings.engineFrameThreshold,
      highlightedStripeCount: settings.engineFrameStripeCount,
      groupDistanceCells: settings.engineFrameDistance,
      color: colorNumber(settings.engineFrameColor, authoredNum(FOOTER_FRAMES?.color, 0xfea700)),
    },
    cursorTrail: {
      ...(FOOTER_TRAIL ?? {}),
      enabled: settings.trailEnabled,
      particleAlpha: settings.trailAlpha,
      particleLifeMs: settings.trailLife,
    },
    dark: {
      ...FOOTER_TEXTURE_CONFIG.dark,
      stripesEnabled: settings.stripesEnabled,
      fieldScale: settings.fieldScale,
      grid,
      sparkle,
    },
  };
}
