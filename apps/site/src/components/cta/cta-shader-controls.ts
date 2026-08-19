import type { CometLogoSettings } from "@necatikcl/stripes-engine";
import type { StripesTextureConfig } from "@/components/stripes-texture/config";
import { LOWER_PAGE_RAIN_NUDGE } from "@/components/stripes-texture/rain-nudge";
import { CTA_COMET_LOGO_SETTINGS, CTA_TEXTURE_CONFIG } from "./texture-config";

export type CtaShaderStripeControl = {
  id: string;
  color: string;
  startFrom: number;
  width: number;
  opacity: number;
};

export type CtaShaderSettings = {
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
  stripes: CtaShaderStripeControl[];
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
  edgeMaskEnabled: boolean;
  edgeMaskEnd: number;
  edgeMaskPower: number;
  clickWaveEnabled: boolean;
  shaderOpacity: number;
  // Comet-logo knobs the CTA already authors. Reset restores these.
  centerClearRadius: number;
  centerClearAspect: number;
  centerClearSquareness: number;
  centerClearLeak: number;
  centerClearFalloff: number;
  centerClearOffsetX: number;
  centerClearOffsetY: number;
  fieldSpeed: number;
  fieldDepth: number;
  fieldAlign: number;
  formationDirectness: number;
  formationMaxTravel: number;
  fieldParticleSize: number;
  fieldTrailLength: number;
  logoScale: number;
  logoParticleSize: number;
  logoTrailLength: number;
  logoDensity: number;
  formationEase: number;
  formationWiggle: number;
  formationDuration: number;
  rejoinDuration: number;
  formationRejoinScale: number;
  formationRejoinMargin: number;
  formationInterrupt: number;
  formationStagger: number;
  burstProbability: number;
  eruptionFrequency: number;
  sparkBrightness: number;
  eruptionIntensity: number;
  fireIntensity: number;
  hotRim: number;
  surfaceEffects: number;
  coronaMist: number;
};

const toHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

const authoredNum = (value: number | undefined, fallback: number) =>
  typeof value === "number" ? value : fallback;

const CTA_STRIPES = CTA_TEXTURE_CONFIG.stripes ?? [];
const CTA_SPARKLE = CTA_TEXTURE_CONFIG.sparkle;
const CTA_DOTS = CTA_TEXTURE_CONFIG.stripeDots;
const CTA_BORDER = CTA_TEXTURE_CONFIG.stripeBorder;
const CTA_EDGE = CTA_TEXTURE_CONFIG.edgeMask;

const defaultStripes = (): CtaShaderStripeControl[] =>
  CTA_STRIPES.map((stripe, index) => ({
    id: `stripe-${index + 1}`,
    color: toHex(stripe.color),
    startFrom: stripe.startFrom,
    width: stripe.width,
    opacity: stripe.opacity,
  }));

const comet = CTA_COMET_LOGO_SETTINGS;

/**
 * Shipped comet CTA look — Reset and the values in `texture-config.ts`.
 * Grid numbers are the engine defaults the CTA currently inherits (no grid
 * block in `CTA_TEXTURE_CONFIG`).
 */
export const CTA_SHADER_DEFAULTS: CtaShaderSettings = {
  rainEnabled: false,
  gapsCoverage: 0.22,
  gapsSpeed: 1,
  waveEnabled: false,
  waveSqueeze: 0,
  waveWavelengthCells: 16,
  waveSpeed: 0,
  wavePhaseDeg: 0,
  gridCellWidth: 7,
  gridCellHeight: 7,
  gridGapX: 0,
  gridGapY: 0,
  gridCornerRadius: 0,
  gridOverlap: 1,
  gridOrientation: "vertical",
  gridAngle: 0,
  stripesEnabled: true,
  fieldScale: 1,
  stripes: defaultStripes(),
  brightness: 0,
  exposure: 0,
  contrast: 1,
  blackPoint: 0,
  whitePoint: 1,
  gamma: 1,
  invert: false,
  posterizeLevels: 0,
  thresholdBias: 0,
  noiseAmount: 0,
  blurRadius: 0,
  sharpenAmount: 0,
  sparkleWidthEnabled: true,
  sparkleWidthCoverage: authoredNum(CTA_SPARKLE?.width?.coverage, 0.5),
  sparkleSwing: authoredNum(CTA_SPARKLE?.width?.swingPx, 2),
  sparkleStripeEnabled: true,
  sparkleStripeCoverage: authoredNum(CTA_SPARKLE?.stripe?.coverage, 0.2),
  sparkleBrightness: authoredNum(CTA_SPARKLE?.stripe?.maxBrightness, 0.1),
  sparkleSpeed: authoredNum(CTA_SPARKLE?.stripe?.speed, 0.2),
  sparkleHueDrift: authoredNum(CTA_SPARKLE?.stripe?.hueDriftDeg, 20),
  sparkleSaturation: authoredNum(CTA_SPARKLE?.stripe?.saturationBoost, 0.4),
  motionEnabled: false,
  motionAmplitude: 4,
  motionStagger: 24,
  motionMaxOffset: 12,
  motionSpeed: 1,
  motionDirection: "leftToRight",
  dotsEnabled: true,
  dotsDensity: authoredNum(CTA_DOTS?.density, 0.8),
  dotsVisibility: 1,
  dotsSize: 1.5,
  dotsBrightness: authoredNum(CTA_DOTS?.brightness, 0.13),
  dotsHueDrift: 0,
  dotsSaturation: 0,
  borderEnabled: true,
  borderMinWidth: authoredNum(CTA_BORDER?.minWidthPx, 4),
  borderDensity: authoredNum(CTA_BORDER?.density, 0.02),
  gridLinesEnabled: false,
  gridLinesBrightness: 0.35,
  gridLinesDensity: 1,
  edgeMaskEnabled: true,
  edgeMaskEnd: authoredNum(CTA_EDGE?.end, 0.1),
  edgeMaskPower: authoredNum(CTA_EDGE?.power, 0.6),
  clickWaveEnabled: true,
  shaderOpacity: 1,
  centerClearRadius: comet.centerClearRadius ?? 175,
  centerClearAspect: comet.centerClearAspect ?? 2.4,
  centerClearSquareness: comet.centerClearSquareness ?? 2,
  centerClearLeak: comet.centerClearLeak ?? 0.012,
  centerClearFalloff: comet.centerClearFalloff ?? 5,
  centerClearOffsetX: comet.centerClearOffsetX ?? 0,
  centerClearOffsetY: comet.centerClearOffsetY ?? 0,
  fieldSpeed: comet.fieldSpeed ?? 0.9,
  fieldDepth: comet.fieldDepth ?? 1.6,
  fieldAlign: comet.fieldAlign ?? 1,
  formationDirectness: comet.formationDirectness ?? 0.8,
  formationMaxTravel: comet.formationMaxTravel ?? 0,
  fieldParticleSize: comet.fieldParticleSize ?? 0.55,
  fieldTrailLength: comet.fieldTrailLength ?? 0.12,
  logoScale: comet.logoScale ?? 1.2,
  logoParticleSize: comet.logoParticleSize ?? 0.85,
  logoTrailLength: comet.logoTrailLength ?? 0.24,
  logoDensity: comet.logoDensity ?? 2.25,
  formationEase: comet.formationEase ?? 0,
  formationWiggle: comet.formationWiggle ?? 1,
  formationDuration: comet.formationDuration ?? 1.55,
  rejoinDuration: comet.rejoinDuration ?? 1.08,
  formationRejoinScale: comet.formationRejoinScale ?? 0.85,
  formationRejoinMargin: comet.formationRejoinMargin ?? 0,
  formationInterrupt: comet.formationInterrupt ?? 2,
  formationStagger: comet.formationStagger ?? 0.3,
  burstProbability: comet.burstProbability ?? 0.32,
  eruptionFrequency: comet.eruptionFrequency ?? 0.065,
  sparkBrightness: comet.sparkBrightness ?? 0.46,
  eruptionIntensity: comet.eruptionIntensity ?? 0.4,
  fireIntensity: comet.fireIntensity ?? 0.4,
  hotRim: comet.hotRim ?? 0.38,
  surfaceEffects: comet.surfaceEffects ?? 0.36,
  coronaMist: comet.coronaMist ?? 0.46,
};

/** First-load / empty-storage config — rain-nudged, still comet-sourced. */
export const CTA_SHADER_CURRENT: CtaShaderSettings = {
  ...CTA_SHADER_DEFAULTS,
  stripes: defaultStripes(),
  ...LOWER_PAGE_RAIN_NUDGE,
};

export const CTA_SHADER_PANEL_ID = "connect-cta-shader-v1";
export const CTA_SHADER_SETTINGS_EVENT = "connect:cta-shader-settings";

const cloneSettings = (source: CtaShaderSettings): CtaShaderSettings => ({
  ...source,
  stripes: source.stripes.map((stripe) => ({ ...stripe })),
});

const isStripe = (value: unknown): value is CtaShaderStripeControl => {
  if (!value || typeof value !== "object") return false;
  const stripe = value as Partial<CtaShaderStripeControl>;
  return (
    typeof stripe.id === "string" &&
    typeof stripe.color === "string" &&
    typeof stripe.startFrom === "number" &&
    typeof stripe.width === "number" &&
    typeof stripe.opacity === "number"
  );
};

export const loadCtaShaderSettings = (): CtaShaderSettings => {
  const settings = cloneSettings(CTA_SHADER_CURRENT);
  try {
    const raw = localStorage.getItem(`panels:${CTA_SHADER_PANEL_ID}`);
    if (!raw) return settings;
    const parsed = JSON.parse(raw) as Partial<CtaShaderSettings>;
    for (const key of Object.keys(settings) as (keyof CtaShaderSettings)[]) {
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

export const publishCtaShaderSettings = (settings: CtaShaderSettings) => {
  window.dispatchEvent(
    new CustomEvent<CtaShaderSettings>(CTA_SHADER_SETTINGS_EVENT, {
      detail: settings,
    }),
  );
};

const colorNumber = (value: string, fallback: number) => {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[\da-f]{6}$/i.test(normalized)) return fallback;
  return Number.parseInt(normalized, 16);
};

export function ctaTextureConfigFromSettings(settings: CtaShaderSettings): StripesTextureConfig {
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
      ...(CTA_SPARKLE?.width ?? {}),
      enabled: settings.sparkleWidthEnabled,
      coverage: settings.sparkleWidthCoverage,
      swingPx: settings.sparkleSwing,
    },
    stripe: {
      ...(CTA_SPARKLE?.stripe ?? {}),
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
  const stripes = settings.stripes.map((stripe) => ({
    color: colorNumber(stripe.color, CTA_STRIPES[0]?.color ?? 0xf5f5f5),
    startFrom: stripe.startFrom,
    width: stripe.width,
    opacity: stripe.opacity,
  }));
  return {
    ...CTA_TEXTURE_CONFIG,
    fieldScale: settings.fieldScale,
    stripesEnabled: settings.stripesEnabled,
    stripes,
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
    edgeMask: {
      ...(CTA_EDGE ?? {}),
      enabled: settings.edgeMaskEnabled,
      end: settings.edgeMaskEnd,
      power: settings.edgeMaskPower,
    },
    clickWave: { enabled: settings.clickWaveEnabled },
    dark: {
      ...CTA_TEXTURE_CONFIG.dark,
      stripesEnabled: settings.stripesEnabled,
      fieldScale: settings.fieldScale,
      grid,
      sparkle,
    },
  };
}

export function cometSettingsFromCta(settings: CtaShaderSettings): Partial<CometLogoSettings> {
  return {
    ...CTA_COMET_LOGO_SETTINGS,
    centerClearRadius: settings.centerClearRadius,
    centerClearAspect: settings.centerClearAspect,
    centerClearSquareness: settings.centerClearSquareness,
    centerClearLeak: settings.centerClearLeak,
    centerClearFalloff: settings.centerClearFalloff,
    centerClearOffsetX: settings.centerClearOffsetX,
    centerClearOffsetY: settings.centerClearOffsetY,
    fieldSpeed: settings.fieldSpeed,
    fieldDepth: settings.fieldDepth,
    fieldAlign: settings.fieldAlign,
    formationDirectness: settings.formationDirectness,
    formationMaxTravel: settings.formationMaxTravel,
    fieldParticleSize: settings.fieldParticleSize,
    fieldTrailLength: settings.fieldTrailLength,
    logoScale: settings.logoScale,
    logoParticleSize: settings.logoParticleSize,
    logoTrailLength: settings.logoTrailLength,
    logoDensity: settings.logoDensity,
    formationEase: settings.formationEase,
    formationWiggle: settings.formationWiggle,
    formationDuration: settings.formationDuration,
    rejoinDuration: settings.rejoinDuration,
    formationRejoinScale: settings.formationRejoinScale,
    formationRejoinMargin: settings.formationRejoinMargin,
    formationInterrupt: settings.formationInterrupt,
    formationStagger: settings.formationStagger,
    burstProbability: settings.burstProbability,
    eruptionFrequency: settings.eruptionFrequency,
    sparkBrightness: settings.sparkBrightness,
    eruptionIntensity: settings.eruptionIntensity,
    fireIntensity: settings.fireIntensity,
    hotRim: settings.hotRim,
    surfaceEffects: settings.surfaceEffects,
    coronaMist: settings.coronaMist,
  };
}
