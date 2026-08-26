import type { DeepPartial, EngineConfig, Fit, StripeBlendMode } from "@necatikcl/stripes-engine";
import type { SharedShaderSourceSpec } from "@necatikcl/stripes-engine/react";
import { CONNECT_HERO_RAIN_CONFIG, CONNECT_HERO_RAIN_GLSL, CONNECT_HERO_RAIN_SHADER_SOURCE } from "./hero-rain-config";

export { CONNECT_HERO_RAIN_GLSL } from "./hero-rain-config";

/** Carries the worker's last GLSL compile result to the panel's code editor. */
export const RAIN_SHADER_ERROR_EVENT = "connect:rain-shader-error";

export type RainStripeControl = {
  id: string;
  color: string;
  startFrom: number;
  width: number;
  opacity: number;
};

/**
 * The rain surface the hero panel exposes — every knob of the lab's rain
 * graphic (grid, gaps, stream wave, stripes, tone, color mapping, camera,
 * background FX) plus the corridor texture source and the hero's fps cap.
 */
export type RainControlSettings = {
  backgroundFillMode: "transparent" | "solid" | "gradient";
  backgroundColor: string;
  backgroundGradientDirection: "topToBottom" | "leftToRight" | "rightToLeft" | "bottomToTop";
  backgroundGradientStopCount: number;
  backgroundGradientStop0: string;
  backgroundGradientStop1: string;
  backgroundGradientStop2: string;
  backgroundGradientStop3: string;
  gapsEnabled: boolean;
  gapsCoverage: number;
  gapsSpeed: number;
  sparkleStripeEnabled: boolean;
  sparkleStripeCoverage: number;
  sparkleStripeMaxBrightness: number;
  sparkleStripeSpeed: number;
  sparkleStripeThickestCount: number;
  sparkleStripeHueDriftDeg: number;
  sparkleStripeSaturationBoost: number;
  sparkleWidthEnabled: boolean;
  sparkleWidthCoverage: number;
  sparkleWidthSwingPx: number;
  sparkleWidthSwingPeriodMin: number;
  sparkleWidthSwingPeriodMax: number;
  sparkleMotionEnabled: boolean;
  sparkleMotionAmplitudePx: number;
  sparkleMotionStaggerPx: number;
  sparkleMotionMaxOffsetPx: number;
  sparkleMotionSpeed: number;
  stripeDotsEnabled: boolean;
  stripeDotsDensity: number;
  stripeDotsRandomVisibility: number;
  stripeDotsSizePx: number;
  stripeDotsBrightness: number;
  stripeDotsHueDriftDeg: number;
  stripeDotsSaturationBoost: number;
  stripeBorderEnabled: boolean;
  stripeBorderMinWidthPx: number;
  stripeBorderDensity: number;
  gridLinesEnabled: boolean;
  gridLinesBrightness: number;
  gridLinesDensity: number;
  framesEnabled: boolean;
  framesLuminanceThreshold: number;
  framesHighlightedStripeCount: number;
  framesGroupDistanceCells: number;
  framesColor: string;
  framesFontSizePx: number;
  framesCoordinateColor: string;
  maxFps: number;
  gridCellWidth: number;
  gridCellHeight: number;
  gridGapX: number;
  gridGapY: number;
  gridCornerRadius: number;
  gridOrientation: "vertical" | "horizontal";
  gridRotationMode: "cell" | "overlap";
  gridAngle: number;
  gridOverlap: number;
  waveEnabled: boolean;
  waveSqueeze: number;
  waveWavelengthCells: number;
  waveSpeed: number;
  wavePhaseDeg: number;
  stripesEnabled: boolean;
  /** Visual scale for grid cells, gaps, stripes, and pixel-sized details. */
  visualFieldScale: number;
  /** Internal GPU field resolution; independent from visual geometry. */
  fieldScale: number;
  stripes: RainStripeControl[];
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
  colorMode: "luminance" | "colors";
  stripeBlendMode: string;
  fit: Fit;
  zoom: number;
  panX: number;
  panY: number;
  starsEnabled: boolean;
  starsDensity: number;
  starsSizePx: number;
  starsSizeRandomness: number;
  starsTiltAngleDeg: number;
  starsTwinkleSpeed: number;
  starsTwinkleAmount: number;
  starsOpacity: number;
  starsColor: string;
  meteorsEnabled: boolean;
  meteorsRatePerSec: number;
  meteorsMaxActive: number;
  meteorsRadiantAngleDeg: number;
  meteorsAngleJitterDeg: number;
  meteorsSpeedScale: number;
  meteorsSpeedVariation: number;
  meteorsTailLengthScale: number;
  meteorsTailLengthVariation: number;
  meteorsThicknessScale: number;
  meteorsThicknessVariation: number;
  meteorsLifetimeMinMs: number;
  meteorsLifetimeMaxMs: number;
  meteorsBrightness: number;
  meteorsHeadGlow: number;
  meteorsPushPx: number;
  meteorsPushFalloffScale: number;
  meteorsFadeInMs: number;
  meteorsFadeOutMs: number;
  meteorsSeed: number;
  flamesEnabled: boolean;
  flamesDirection: "up" | "down" | "left" | "right" | "upDown" | "leftRight" | "vortexSingular";
  flamesMinWidthRatio: number;
  flamesMaxWidthRatio: number;
  flamesMinHeightRatio: number;
  flamesMaxHeightRatio: number;
  flamesBaseSpeed: number;
  flamesSpeedVariation: number;
  flamesSpawnInterval: number;
  flamesSpawnJitter: number;
  flamesMaxActive: number;
  flamesEdgeSharpness: number;
  flamesOpacityMin: number;
  flamesOpacityMax: number;
  sourceSpeed: number;
  sourceWidth: number;
  sourceHeight: number;
  /** Shadertoy-style `mainImage` GLSL for the texture source. */
  sourceGlsl: string;
  /** Height of the hero stack's top fade band, as % of the stack. */
  topFadePct: number;
  /** Where the fade band starts, as % from the top; everything above is hidden. */
  topFadeOffsetPct: number;
};

const toHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

type RainBaseConfig = typeof CONNECT_HERO_RAIN_CONFIG & {
  grid: NonNullable<(typeof CONNECT_HERO_RAIN_CONFIG)["grid"]>;
};

const BASE = CONNECT_HERO_RAIN_CONFIG as RainBaseConfig;

const defaultStripes = (): RainStripeControl[] =>
  (BASE.stripes ?? []).map((stripe, index) => ({
    id: `stripe-${index + 1}`,
    color: toHex(stripe?.color ?? 0),
    startFrom: stripe?.startFrom ?? 0,
    width: stripe?.width ?? 1,
    opacity: stripe?.opacity ?? 1,
  }));

export const CONNECT_HERO_RAIN_CONTROL_DEFAULTS: RainControlSettings = {
  backgroundFillMode: "solid",
  backgroundColor: "#ffffff",
  backgroundGradientDirection: BASE.background?.gradient?.direction ?? "topToBottom",
  backgroundGradientStopCount: BASE.background?.gradient?.stopCount ?? 2,
  backgroundGradientStop0: toHex(BASE.background?.gradient?.stops?.[0] ?? 0xffffff),
  backgroundGradientStop1: toHex(BASE.background?.gradient?.stops?.[1] ?? 0xffffff),
  backgroundGradientStop2: toHex(BASE.background?.gradient?.stops?.[2] ?? 0xffffff),
  backgroundGradientStop3: toHex(BASE.background?.gradient?.stops?.[3] ?? 0xffffff),
  gapsEnabled: BASE.sparkle?.gaps?.enabled ?? true,
  gapsCoverage: BASE.sparkle?.gaps?.coverage ?? 0,
  gapsSpeed: BASE.sparkle?.gaps?.speed ?? 1,
  sparkleStripeEnabled: BASE.sparkle?.stripe?.enabled ?? false,
  sparkleStripeCoverage: BASE.sparkle?.stripe?.coverage ?? 0,
  sparkleStripeMaxBrightness: BASE.sparkle?.stripe?.maxBrightness ?? 0,
  sparkleStripeSpeed: BASE.sparkle?.stripe?.speed ?? 1,
  sparkleStripeThickestCount: BASE.sparkle?.stripe?.thickestCount ?? 1,
  sparkleStripeHueDriftDeg: BASE.sparkle?.stripe?.hueDriftDeg ?? 0,
  sparkleStripeSaturationBoost: BASE.sparkle?.stripe?.saturationBoost ?? 0,
  sparkleWidthEnabled: BASE.sparkle?.width?.enabled ?? false,
  sparkleWidthCoverage: BASE.sparkle?.width?.coverage ?? 0,
  sparkleWidthSwingPx: BASE.sparkle?.width?.swingPx ?? 0,
  sparkleWidthSwingPeriodMin: BASE.sparkle?.width?.swingPeriodMin ?? 1,
  sparkleWidthSwingPeriodMax: BASE.sparkle?.width?.swingPeriodMax ?? 1,
  sparkleMotionEnabled: BASE.sparkle?.motion?.enabled ?? false,
  sparkleMotionAmplitudePx: BASE.sparkle?.motion?.amplitudePx ?? 0,
  sparkleMotionStaggerPx: BASE.sparkle?.motion?.staggerPx ?? 1,
  sparkleMotionMaxOffsetPx: BASE.sparkle?.motion?.maxOffsetPx ?? 0,
  sparkleMotionSpeed: BASE.sparkle?.motion?.speed ?? 1,
  stripeDotsEnabled: BASE.stripeDots?.enabled ?? false,
  stripeDotsDensity: BASE.stripeDots?.density ?? 0,
  stripeDotsRandomVisibility: BASE.stripeDots?.randomVisibility ?? 0,
  stripeDotsSizePx: BASE.stripeDots?.sizePx ?? 1,
  stripeDotsBrightness: BASE.stripeDots?.brightness ?? 1,
  stripeDotsHueDriftDeg: BASE.stripeDots?.hueDriftDeg ?? 0,
  stripeDotsSaturationBoost: BASE.stripeDots?.saturationBoost ?? 0,
  stripeBorderEnabled: BASE.stripeBorder?.enabled ?? false,
  stripeBorderMinWidthPx: BASE.stripeBorder?.minWidthPx ?? 1,
  stripeBorderDensity: BASE.stripeBorder?.density ?? 0,
  gridLinesEnabled: BASE.gridLines?.enabled ?? false,
  gridLinesBrightness: BASE.gridLines?.brightness ?? 0,
  gridLinesDensity: BASE.gridLines?.density ?? 0,
  framesEnabled: BASE.frames?.enabled ?? false,
  framesLuminanceThreshold: BASE.frames?.luminanceThreshold ?? 0.5,
  framesHighlightedStripeCount: BASE.frames?.highlightedStripeCount ?? 1,
  framesGroupDistanceCells: BASE.frames?.groupDistanceCells ?? 1,
  framesColor: toHex(BASE.frames?.color ?? 0xffffff),
  framesFontSizePx: BASE.frames?.fontSizePx ?? 12,
  framesCoordinateColor: toHex(BASE.frames?.coordinateColor ?? 0xffffff),
  maxFps: BASE.maxFps ?? 30,
  gridCellWidth: BASE.grid.cellWidth ?? 17,
  gridCellHeight: BASE.grid.cellHeight ?? 1,
  gridGapX: BASE.grid.gapX ?? 12,
  gridGapY: BASE.grid.gapY ?? 0,
  gridCornerRadius: BASE.grid.cornerRadius ?? 0,
  gridOrientation: BASE.grid.orientation ?? "vertical",
  gridRotationMode: BASE.grid.rotationMode ?? "cell",
  gridAngle: BASE.grid.angleDeg ?? 45,
  gridOverlap: BASE.grid.overlapAmount ?? 1.2,
  waveEnabled: BASE.grid.streamGapWave?.enabled ?? false,
  waveSqueeze: BASE.grid.streamGapWave?.squeeze ?? 0.14,
  waveWavelengthCells: BASE.grid.streamGapWave?.wavelengthCells ?? 9,
  waveSpeed: BASE.grid.streamGapWave?.speed ?? -4,
  wavePhaseDeg: BASE.grid.streamGapWave?.phaseDeg ?? -180,
  stripesEnabled: BASE.stripesEnabled ?? true,
  visualFieldScale: 1,
  fieldScale: BASE.fieldScale ?? 0.25,
  stripes: defaultStripes(),
  brightness: BASE.adjustments?.brightness ?? -0.5,
  exposure: BASE.adjustments?.exposure ?? 1.5,
  contrast: BASE.adjustments?.contrast ?? 0.54,
  blackPoint: BASE.adjustments?.blackPoint ?? 0.02,
  whitePoint: BASE.adjustments?.whitePoint ?? 1,
  gamma: BASE.adjustments?.gamma ?? 0.55,
  invert: BASE.adjustments?.invert ?? false,
  posterizeLevels: BASE.adjustments?.posterizeLevels ?? 0,
  thresholdBias: BASE.adjustments?.thresholdBias ?? 0,
  noiseAmount: BASE.adjustments?.noiseAmount ?? 0,
  blurRadius: BASE.adjustments?.blurRadius ?? 0,
  sharpenAmount: BASE.adjustments?.sharpenAmount ?? 0,
  colorMode: BASE.colors?.mode ?? "luminance",
  stripeBlendMode: BASE.colors?.stripeBlendMode ?? "multiply",
  fit: BASE.transform?.fit ?? "width",
  zoom: BASE.transform?.zoom ?? 1,
  panX: BASE.transform?.panX ?? 0,
  panY: BASE.transform?.panY ?? 0,
  starsEnabled: BASE.background?.stars?.enabled ?? true,
  starsDensity: BASE.background?.stars?.density ?? 10,
  starsSizePx: BASE.background?.stars?.sizePx ?? 4,
  starsSizeRandomness: BASE.background?.stars?.sizeRandomness ?? 0,
  starsTiltAngleDeg: BASE.background?.stars?.tiltAngleDeg ?? 0,
  starsTwinkleSpeed: BASE.background?.stars?.twinkleSpeed ?? 1,
  starsTwinkleAmount: BASE.background?.stars?.twinkleAmount ?? 0,
  starsOpacity: BASE.background?.stars?.opacity ?? 1,
  starsColor: toHex(BASE.background?.stars?.color ?? 0xffffff),
  meteorsEnabled: BASE.background?.meteors?.enabled ?? true,
  meteorsRatePerSec: BASE.background?.meteors?.ratePerSec ?? 1.32,
  meteorsMaxActive: BASE.background?.meteors?.maxActive ?? 16,
  meteorsRadiantAngleDeg: BASE.background?.meteors?.radiantAngleDeg ?? 0,
  meteorsAngleJitterDeg: BASE.background?.meteors?.angleJitterDeg ?? 0,
  meteorsSpeedScale: BASE.background?.meteors?.speedScale ?? 1,
  meteorsSpeedVariation: BASE.background?.meteors?.speedVariation ?? 0,
  meteorsTailLengthScale: BASE.background?.meteors?.tailLengthScale ?? 1,
  meteorsTailLengthVariation: BASE.background?.meteors?.tailLengthVariation ?? 0,
  meteorsThicknessScale: BASE.background?.meteors?.thicknessScale ?? 1,
  meteorsThicknessVariation: BASE.background?.meteors?.thicknessVariation ?? 0,
  meteorsLifetimeMinMs: BASE.background?.meteors?.lifetimeMinMs ?? 300,
  meteorsLifetimeMaxMs: BASE.background?.meteors?.lifetimeMaxMs ?? 1200,
  meteorsBrightness: BASE.background?.meteors?.brightness ?? 1,
  meteorsHeadGlow: BASE.background?.meteors?.headGlow ?? 1,
  meteorsPushPx: BASE.background?.meteors?.pushPx ?? 0,
  meteorsPushFalloffScale: BASE.background?.meteors?.pushFalloffScale ?? 1,
  meteorsFadeInMs: BASE.background?.meteors?.fadeInMs ?? 0,
  meteorsFadeOutMs: BASE.background?.meteors?.fadeOutMs ?? 300,
  meteorsSeed: BASE.background?.meteors?.seed ?? 1,
  flamesEnabled: BASE.flames?.enabled ?? true,
  flamesDirection: BASE.flames?.direction ?? "up",
  flamesMinWidthRatio: BASE.flames?.minWidthRatio ?? 0.01,
  flamesMaxWidthRatio: BASE.flames?.maxWidthRatio ?? 0.1,
  flamesMinHeightRatio: BASE.flames?.minHeightRatio ?? 0.01,
  flamesMaxHeightRatio: BASE.flames?.maxHeightRatio ?? 0.1,
  flamesBaseSpeed: BASE.flames?.baseSpeedPxPerSec ?? 40,
  flamesSpeedVariation: BASE.flames?.speedVariation ?? 0,
  flamesSpawnInterval: BASE.flames?.spawnIntervalMs ?? 300,
  flamesSpawnJitter: BASE.flames?.spawnJitterMs ?? 0,
  flamesMaxActive: BASE.flames?.maxActive ?? 25,
  flamesEdgeSharpness: BASE.flames?.edgeSharpness ?? 0.5,
  flamesOpacityMin: BASE.flames?.opacityMin ?? 0.5,
  flamesOpacityMax: BASE.flames?.opacityMax ?? 1,
  sourceSpeed: CONNECT_HERO_RAIN_SHADER_SOURCE.speed ?? 1,
  sourceWidth: CONNECT_HERO_RAIN_SHADER_SOURCE.width,
  sourceHeight: CONNECT_HERO_RAIN_SHADER_SOURCE.height,
  sourceGlsl: CONNECT_HERO_RAIN_GLSL,
  topFadePct: 34,
  topFadeOffsetPct: 23,
};

export const RAIN_PANEL_ID = "connect-hero-rain-v1";

const cloneDefaults = (): RainControlSettings => ({
  ...CONNECT_HERO_RAIN_CONTROL_DEFAULTS,
  stripes: defaultStripes(),
});

const isStripe = (value: unknown): value is RainStripeControl => {
  if (!value || typeof value !== "object") return false;
  const stripe = value as Partial<RainStripeControl>;
  return (
    typeof stripe.id === "string" &&
    typeof stripe.color === "string" &&
    typeof stripe.startFrom === "number" &&
    typeof stripe.width === "number" &&
    typeof stripe.opacity === "number"
  );
};

export const loadRainControlSettings = (): RainControlSettings => {
  const settings = cloneDefaults();
  try {
    const raw = localStorage.getItem(`panels:${RAIN_PANEL_ID}`);
    if (!raw) return settings;
    const parsed = JSON.parse(raw) as Partial<RainControlSettings>;
    for (const key of Object.keys(settings) as (keyof RainControlSettings)[]) {
      const value = parsed[key];
      const fallback = settings[key];
      if (key === "stripes" && Array.isArray(value)) {
        const stripes = value.filter(isStripe).slice(0, 24);
        if (stripes.length > 0) settings.stripes = stripes;
      } else if (typeof value === typeof fallback && typeof value !== "object") {
        (settings as Record<string, unknown>)[key] = value;
      }
    }
    return settings;
  } catch {
    return settings;
  }
};

export type ConnectHeroRain = {
  config: DeepPartial<EngineConfig>;
  shaderSource: SharedShaderSourceSpec;
  /** Height of the hero stack's top fade band, as % of the stack. */
  topFadePct: number;
  /** Where the fade band starts, as % from the top; everything above is hidden. */
  topFadeOffsetPct: number;
  /** CSS background painted beneath both transparent canvases. */
  canvasBackground: string;
  /** Stage backdrop in the same shape used by the demo exporters. */
  exportBackground: {
    transparent: boolean;
    color: number;
    gradient: {
      enabled: boolean;
      direction: RainControlSettings["backgroundGradientDirection"];
      stopCount: number;
      stops: number[];
    };
  };
};

const asColor = (value: string) => Number.parseInt(value.replace(/^#/, ""), 16) || 0;

const invertColor = (color: number) => 0xffffff ^ (color & 0xffffff);

const averageColors = (colors: readonly number[]) => {
  if (colors.length === 0) return 0xffffff;
  const total = colors.reduce(
    (sum, color) => ({
      r: sum.r + ((color >> 16) & 0xff),
      g: sum.g + ((color >> 8) & 0xff),
      b: sum.b + (color & 0xff),
    }),
    { r: 0, g: 0, b: 0 },
  );
  const count = colors.length;
  return (Math.round(total.r / count) << 16) | (Math.round(total.g / count) << 8) | Math.round(total.b / count);
};

/** The zoom letterbox uses the opposite tone from the visible stage. */
export const resolveRainOutsideColor = (settings: RainControlSettings): number => {
  if (settings.backgroundFillMode === "solid") {
    return invertColor(asColor(settings.backgroundColor));
  }
  if (settings.backgroundFillMode === "gradient") {
    const stops = [
      settings.backgroundGradientStop0,
      settings.backgroundGradientStop1,
      settings.backgroundGradientStop2,
      settings.backgroundGradientStop3,
    ]
      .slice(0, Math.max(2, Math.min(4, settings.backgroundGradientStopCount)))
      .map(asColor);
    return invertColor(averageColors(stops));
  }
  // The authoring page beneath a transparent stage is white.
  return 0x000000;
};

const scaledPx = (value: number, scale: number) => value * scale;

const resolveCanvasBackground = (settings: RainControlSettings): string => {
  if (settings.backgroundFillMode === "transparent") return "transparent";
  if (settings.backgroundFillMode === "solid") return settings.backgroundColor;
  const direction = {
    topToBottom: "to bottom",
    leftToRight: "to right",
    rightToLeft: "to left",
    bottomToTop: "to top",
  }[settings.backgroundGradientDirection];
  const stops = [
    settings.backgroundGradientStop0,
    settings.backgroundGradientStop1,
    settings.backgroundGradientStop2,
    settings.backgroundGradientStop3,
  ].slice(0, Math.max(2, Math.min(4, settings.backgroundGradientStopCount)));
  return `linear-gradient(${direction}, ${stops.join(", ")})`;
};

export const CONNECT_HERO_RAIN_DEFAULT: ConnectHeroRain = {
  config: CONNECT_HERO_RAIN_CONFIG,
  shaderSource: CONNECT_HERO_RAIN_SHADER_SOURCE,
  topFadePct: CONNECT_HERO_RAIN_CONTROL_DEFAULTS.topFadePct,
  topFadeOffsetPct: CONNECT_HERO_RAIN_CONTROL_DEFAULTS.topFadeOffsetPct,
  canvasBackground: "#ffffff",
  exportBackground: {
    transparent: false,
    color: 0xffffff,
    gradient: {
      enabled: false,
      direction: "topToBottom",
      stopCount: 2,
      stops: [0xffffff, 0xffffff],
    },
  },
};

/** Panel settings → the engine config + worker shader source the hero renders. */
export const resolveConnectHeroRain = (settings: RainControlSettings): ConnectHeroRain => ({
  config: {
    ...BASE,
    grid: {
      ...BASE.grid,
      cellWidth: scaledPx(settings.gridCellWidth, settings.visualFieldScale),
      cellHeight: scaledPx(settings.gridCellHeight, settings.visualFieldScale),
      gapX: scaledPx(settings.gridGapX, settings.visualFieldScale),
      gapY: scaledPx(settings.gridGapY, settings.visualFieldScale),
      cornerRadius: scaledPx(settings.gridCornerRadius, settings.visualFieldScale),
      orientation: settings.gridOrientation,
      rotationMode: settings.gridRotationMode,
      angleDeg: settings.gridAngle,
      overlapAmount: settings.gridOverlap,
      streamGapWave: {
        ...BASE.grid.streamGapWave,
        enabled: settings.waveEnabled,
        squeeze: settings.waveSqueeze,
        wavelengthCells: settings.waveWavelengthCells,
        speed: settings.waveSpeed,
        phaseDeg: settings.wavePhaseDeg,
      },
    },
    sparkle: {
      ...BASE.sparkle,
      gaps: {
        enabled: settings.gapsEnabled,
        coverage: settings.gapsCoverage,
        speed: settings.gapsSpeed,
      },
      stripe: {
        ...BASE.sparkle?.stripe,
        enabled: settings.sparkleStripeEnabled,
        coverage: settings.sparkleStripeCoverage,
        maxBrightness: settings.sparkleStripeMaxBrightness,
        speed: settings.sparkleStripeSpeed,
        thickestCount: settings.sparkleStripeThickestCount,
        hueDriftDeg: settings.sparkleStripeHueDriftDeg,
        saturationBoost: settings.sparkleStripeSaturationBoost,
      },
      width: {
        ...BASE.sparkle?.width,
        enabled: settings.sparkleWidthEnabled,
        coverage: settings.sparkleWidthCoverage,
        swingPx: scaledPx(settings.sparkleWidthSwingPx, settings.visualFieldScale),
        swingPeriodMin: settings.sparkleWidthSwingPeriodMin,
        swingPeriodMax: settings.sparkleWidthSwingPeriodMax,
      },
      motion: {
        ...BASE.sparkle?.motion,
        enabled: settings.sparkleMotionEnabled,
        amplitudePx: scaledPx(settings.sparkleMotionAmplitudePx, settings.visualFieldScale),
        staggerPx: scaledPx(settings.sparkleMotionStaggerPx, settings.visualFieldScale),
        maxOffsetPx: scaledPx(settings.sparkleMotionMaxOffsetPx, settings.visualFieldScale),
        speed: settings.sparkleMotionSpeed,
      },
    },
    stripeDots: {
      ...BASE.stripeDots,
      enabled: settings.stripeDotsEnabled,
      density: settings.stripeDotsDensity,
      randomVisibility: settings.stripeDotsRandomVisibility,
      sizePx: scaledPx(settings.stripeDotsSizePx, settings.visualFieldScale),
      brightness: settings.stripeDotsBrightness,
      hueDriftDeg: settings.stripeDotsHueDriftDeg,
      saturationBoost: settings.stripeDotsSaturationBoost,
    },
    stripeBorder: {
      ...BASE.stripeBorder,
      enabled: settings.stripeBorderEnabled,
      minWidthPx: scaledPx(settings.stripeBorderMinWidthPx, settings.visualFieldScale),
      density: settings.stripeBorderDensity,
    },
    gridLines: {
      ...BASE.gridLines,
      enabled: settings.gridLinesEnabled,
      brightness: settings.gridLinesBrightness,
      density: settings.gridLinesDensity,
    },
    frames: {
      ...BASE.frames,
      enabled: settings.framesEnabled,
      luminanceThreshold: settings.framesLuminanceThreshold,
      highlightedStripeCount: settings.framesHighlightedStripeCount,
      groupDistanceCells: settings.framesGroupDistanceCells,
      color: asColor(settings.framesColor),
      fontSizePx: scaledPx(settings.framesFontSizePx, settings.visualFieldScale),
      coordinateColor: asColor(settings.framesCoordinateColor),
    },
    stripes: settings.stripes.map((stripe) => ({
      color: Number.parseInt(stripe.color.replace(/^#/, ""), 16) || 0,
      startFrom: stripe.startFrom,
      width: scaledPx(stripe.width, settings.visualFieldScale),
      opacity: stripe.opacity,
    })),
    stripesEnabled: settings.stripesEnabled,
    fieldScale: settings.fieldScale,
    maxFps: settings.maxFps,
    adjustments: {
      ...BASE.adjustments,
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
    colors: {
      ...BASE.colors,
      mode: settings.colorMode,
      stripeBlendMode: settings.stripeBlendMode as StripeBlendMode,
    },
    transform: {
      fit: settings.fit,
      zoom: settings.zoom,
      panX: settings.panX,
      panY: settings.panY,
    },
    background: {
      ...BASE.background,
      color: resolveRainOutsideColor(settings),
      stars: {
        ...BASE.background?.stars,
        enabled: settings.starsEnabled,
        density: settings.starsDensity,
        sizePx: settings.starsSizePx,
        sizeRandomness: settings.starsSizeRandomness,
        tiltAngleDeg: settings.starsTiltAngleDeg,
        twinkleSpeed: settings.starsTwinkleSpeed,
        twinkleAmount: settings.starsTwinkleAmount,
        opacity: settings.starsOpacity,
        color: asColor(settings.starsColor),
      },
      meteors: {
        ...BASE.background?.meteors,
        enabled: settings.meteorsEnabled,
        ratePerSec: settings.meteorsRatePerSec,
        maxActive: settings.meteorsMaxActive,
        radiantAngleDeg: settings.meteorsRadiantAngleDeg,
        angleJitterDeg: settings.meteorsAngleJitterDeg,
        speedScale: settings.meteorsSpeedScale,
        speedVariation: settings.meteorsSpeedVariation,
        tailLengthScale: settings.meteorsTailLengthScale,
        tailLengthVariation: settings.meteorsTailLengthVariation,
        thicknessScale: settings.meteorsThicknessScale,
        thicknessVariation: settings.meteorsThicknessVariation,
        lifetimeMinMs: settings.meteorsLifetimeMinMs,
        lifetimeMaxMs: settings.meteorsLifetimeMaxMs,
        brightness: settings.meteorsBrightness,
        headGlow: settings.meteorsHeadGlow,
        pushPx: settings.meteorsPushPx,
        pushFalloffScale: settings.meteorsPushFalloffScale,
        fadeInMs: settings.meteorsFadeInMs,
        fadeOutMs: settings.meteorsFadeOutMs,
        seed: settings.meteorsSeed,
      },
    },
    flames: {
      ...BASE.flames,
      enabled: settings.flamesEnabled,
      direction: settings.flamesDirection,
      minWidthRatio: settings.flamesMinWidthRatio,
      maxWidthRatio: settings.flamesMaxWidthRatio,
      minHeightRatio: settings.flamesMinHeightRatio,
      maxHeightRatio: settings.flamesMaxHeightRatio,
      baseSpeedPxPerSec: settings.flamesBaseSpeed,
      speedVariation: settings.flamesSpeedVariation,
      spawnIntervalMs: settings.flamesSpawnInterval,
      spawnJitterMs: settings.flamesSpawnJitter,
      maxActive: settings.flamesMaxActive,
      edgeSharpness: settings.flamesEdgeSharpness,
      opacityMin: settings.flamesOpacityMin,
      opacityMax: settings.flamesOpacityMax,
    },
  },
  shaderSource: {
    ...CONNECT_HERO_RAIN_SHADER_SOURCE,
    source:
      typeof settings.sourceGlsl === "string" && settings.sourceGlsl.trim()
        ? settings.sourceGlsl
        : CONNECT_HERO_RAIN_GLSL,
    speed: settings.sourceSpeed,
    width: settings.sourceWidth,
    height: settings.sourceHeight,
  },
  topFadePct: settings.topFadePct,
  topFadeOffsetPct: settings.topFadeOffsetPct,
  canvasBackground: resolveCanvasBackground(settings),
  exportBackground: {
    transparent: settings.backgroundFillMode === "transparent",
    color: asColor(settings.backgroundColor),
    gradient: {
      enabled: settings.backgroundFillMode === "gradient",
      direction: settings.backgroundGradientDirection,
      stopCount: settings.backgroundGradientStopCount,
      stops: [
        asColor(settings.backgroundGradientStop0),
        asColor(settings.backgroundGradientStop1),
        asColor(settings.backgroundGradientStop2),
        asColor(settings.backgroundGradientStop3),
      ],
    },
  },
});
