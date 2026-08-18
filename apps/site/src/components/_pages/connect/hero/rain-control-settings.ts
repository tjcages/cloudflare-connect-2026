import type {
  DeepPartial,
  EngineConfig,
  Fit,
  StripeBlendMode,
} from "@necatikcl/stripes-engine";
import type { SharedShaderSourceSpec } from "@necatikcl/stripes-engine/react";
import {
  CONNECT_HERO_RAIN_CONFIG,
  CONNECT_HERO_RAIN_GLSL,
  CONNECT_HERO_RAIN_SHADER_SOURCE,
} from "./hero-rain-config";

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
  gapsEnabled: boolean;
  gapsCoverage: number;
  gapsSpeed: number;
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
  fieldScale: number;
  stripes: RainStripeControl[];
  brightness: number;
  exposure: number;
  contrast: number;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  invert: boolean;
  colorMode: "luminance" | "colors";
  stripeBlendMode: string;
  fit: Fit;
  zoom: number;
  panX: number;
  panY: number;
  starsEnabled: boolean;
  starsDensity: number;
  starsSizePx: number;
  meteorsEnabled: boolean;
  meteorsRatePerSec: number;
  meteorsMaxActive: number;
  flamesEnabled: boolean;
  flamesMaxActive: number;
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
  gapsEnabled: BASE.sparkle?.gaps?.enabled ?? true,
  gapsCoverage: BASE.sparkle?.gaps?.coverage ?? 0,
  gapsSpeed: BASE.sparkle?.gaps?.speed ?? 1,
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
  fieldScale: BASE.fieldScale ?? 0.25,
  stripes: defaultStripes(),
  brightness: BASE.adjustments?.brightness ?? -0.5,
  exposure: BASE.adjustments?.exposure ?? 1.5,
  contrast: BASE.adjustments?.contrast ?? 0.54,
  blackPoint: BASE.adjustments?.blackPoint ?? 0.02,
  whitePoint: BASE.adjustments?.whitePoint ?? 1,
  gamma: BASE.adjustments?.gamma ?? 0.55,
  invert: BASE.adjustments?.invert ?? false,
  colorMode: BASE.colors?.mode ?? "luminance",
  stripeBlendMode: BASE.colors?.stripeBlendMode ?? "multiply",
  fit: BASE.transform?.fit ?? "width",
  zoom: BASE.transform?.zoom ?? 1,
  panX: BASE.transform?.panX ?? 0,
  panY: BASE.transform?.panY ?? 0,
  starsEnabled: BASE.background?.stars?.enabled ?? true,
  starsDensity: BASE.background?.stars?.density ?? 10,
  starsSizePx: BASE.background?.stars?.sizePx ?? 4,
  meteorsEnabled: BASE.background?.meteors?.enabled ?? true,
  meteorsRatePerSec: BASE.background?.meteors?.ratePerSec ?? 1.32,
  meteorsMaxActive: BASE.background?.meteors?.maxActive ?? 16,
  flamesEnabled: BASE.flames?.enabled ?? true,
  flamesMaxActive: BASE.flames?.maxActive ?? 25,
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
};

export const CONNECT_HERO_RAIN_DEFAULT: ConnectHeroRain = {
  config: CONNECT_HERO_RAIN_CONFIG,
  shaderSource: CONNECT_HERO_RAIN_SHADER_SOURCE,
  topFadePct: CONNECT_HERO_RAIN_CONTROL_DEFAULTS.topFadePct,
  topFadeOffsetPct: CONNECT_HERO_RAIN_CONTROL_DEFAULTS.topFadeOffsetPct,
};

/** Panel settings → the engine config + worker shader source the hero renders. */
export const resolveConnectHeroRain = (
  settings: RainControlSettings
): ConnectHeroRain => ({
  config: {
    ...BASE,
    grid: {
      ...BASE.grid,
      cellWidth: settings.gridCellWidth,
      cellHeight: settings.gridCellHeight,
      gapX: settings.gridGapX,
      gapY: settings.gridGapY,
      cornerRadius: settings.gridCornerRadius,
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
    },
    stripes: settings.stripes.map((stripe) => ({
      color: Number.parseInt(stripe.color.replace(/^#/, ""), 16) || 0,
      startFrom: stripe.startFrom,
      width: stripe.width,
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
      stars: {
        ...BASE.background?.stars,
        enabled: settings.starsEnabled,
        density: settings.starsDensity,
        sizePx: settings.starsSizePx,
      },
      meteors: {
        ...BASE.background?.meteors,
        enabled: settings.meteorsEnabled,
        ratePerSec: settings.meteorsRatePerSec,
        maxActive: settings.meteorsMaxActive,
      },
    },
    flames: {
      ...BASE.flames,
      enabled: settings.flamesEnabled,
      maxActive: settings.flamesMaxActive,
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
});
