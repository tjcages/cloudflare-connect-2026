import { AGENDA_RAIN_CONFIG } from "./agenda-rain-config";
import { DEFAULT_RAIN_SHADER_ID } from "./rain-texture-source";

export type AgendaRainStripeControl = {
  id: string;
  color: string;
  startFrom: number;
  width: number;
  opacity: number;
};

export type AgendaRainSettings = {
  // Texture source (shader library preset + framing)
  shaderPreset: string;
  sourceSpeed: number;
  sourceScale: number;
  sourceZoom: number;
  sourcePanX: number;
  sourcePanY: number;
  sourceRotateX: number;
  sourceRotateY: number;
  sourceRotateZ: number;
  // Rain streams
  rainEnabled: boolean;
  gapsCoverage: number;
  gapsSpeed: number;
  waveEnabled: boolean;
  waveSqueeze: number;
  waveWavelengthCells: number;
  waveSpeed: number;
  wavePhaseDeg: number;
  // Grid geometry
  gridCellWidth: number;
  gridCellHeight: number;
  gridGapX: number;
  gridGapY: number;
  gridCornerRadius: number;
  gridOverlap: number;
  gridOrientation: "vertical" | "horizontal";
  gridAngle: number;
  // Stripe palette
  stripesEnabled: boolean;
  fieldScale: number;
  stripes: AgendaRainStripeControl[];
  // Tone
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
  // Stripe sparkle
  sparkleWidthEnabled: boolean;
  sparkleWidthCoverage: number;
  sparkleSwing: number;
  sparkleStripeEnabled: boolean;
  sparkleStripeCoverage: number;
  sparkleBrightness: number;
  sparkleSpeed: number;
  sparkleHueDrift: number;
  sparkleSaturation: number;
  // Stripe motion
  motionEnabled: boolean;
  motionAmplitude: number;
  motionStagger: number;
  motionMaxOffset: number;
  motionSpeed: number;
  motionDirection: "leftToRight" | "rightToLeft";
  // Stripe detail
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
  // Background
  backgroundTransparent: boolean;
  backgroundColor: string;
  starsEnabled: boolean;
  meteorsEnabled: boolean;
  flamesEnabled: boolean;
  // Color mapping
  colorMode: "luminance" | "colors";
  stripeBlendMode: string;
  // Output
  shaderOpacity: number;
  renderMode: string;
  renderIntensity: number;
  renderParamA: number;
  renderParamB: number;
  renderParamC: number;
  renderParamD: number;
  renderColorA: string;
  renderColorB: string;
};

const toHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

const defaultStripes = (): AgendaRainStripeControl[] =>
  AGENDA_RAIN_CONFIG.stripes.map((stripe, index) => ({
    id: `stripe-${index + 1}`,
    color: toHex(stripe.color),
    startFrom: stripe.startFrom,
    width: stripe.width,
    opacity: stripe.opacity,
  }));

export const AGENDA_RAIN_DEFAULTS: AgendaRainSettings = {
  shaderPreset: DEFAULT_RAIN_SHADER_ID,
  sourceSpeed: 0.4,
  sourceScale: 1,
  sourceZoom: 0.2,
  sourcePanX: 0,
  sourcePanY: 0.14,
  sourceRotateX: 0,
  sourceRotateY: 27,
  sourceRotateZ: 0,
  rainEnabled: AGENDA_RAIN_CONFIG.sparkle.gaps.enabled,
  gapsCoverage: AGENDA_RAIN_CONFIG.sparkle.gaps.coverage,
  gapsSpeed: AGENDA_RAIN_CONFIG.sparkle.gaps.speed,
  waveEnabled: AGENDA_RAIN_CONFIG.grid.streamGapWave.enabled,
  waveSqueeze: AGENDA_RAIN_CONFIG.grid.streamGapWave.squeeze,
  waveWavelengthCells: AGENDA_RAIN_CONFIG.grid.streamGapWave.wavelengthCells,
  waveSpeed: AGENDA_RAIN_CONFIG.grid.streamGapWave.speed,
  wavePhaseDeg: AGENDA_RAIN_CONFIG.grid.streamGapWave.phaseDeg,
  gridCellWidth: AGENDA_RAIN_CONFIG.grid.cellWidth,
  gridCellHeight: AGENDA_RAIN_CONFIG.grid.cellHeight,
  gridGapX: AGENDA_RAIN_CONFIG.grid.gapX,
  gridGapY: AGENDA_RAIN_CONFIG.grid.gapY,
  gridCornerRadius: AGENDA_RAIN_CONFIG.grid.cornerRadius,
  gridOverlap: AGENDA_RAIN_CONFIG.grid.overlapAmount,
  gridOrientation: AGENDA_RAIN_CONFIG.grid.orientation,
  gridAngle: AGENDA_RAIN_CONFIG.grid.angleDeg,
  stripesEnabled: AGENDA_RAIN_CONFIG.stripesEnabled,
  fieldScale: AGENDA_RAIN_CONFIG.fieldScale,
  stripes: defaultStripes(),
  brightness: AGENDA_RAIN_CONFIG.adjustments.brightness,
  exposure: AGENDA_RAIN_CONFIG.adjustments.exposure,
  contrast: AGENDA_RAIN_CONFIG.adjustments.contrast,
  blackPoint: AGENDA_RAIN_CONFIG.adjustments.blackPoint,
  whitePoint: AGENDA_RAIN_CONFIG.adjustments.whitePoint,
  gamma: AGENDA_RAIN_CONFIG.adjustments.gamma,
  invert: AGENDA_RAIN_CONFIG.adjustments.invert,
  posterizeLevels: AGENDA_RAIN_CONFIG.adjustments.posterizeLevels,
  thresholdBias: AGENDA_RAIN_CONFIG.adjustments.thresholdBias,
  noiseAmount: AGENDA_RAIN_CONFIG.adjustments.noiseAmount,
  blurRadius: AGENDA_RAIN_CONFIG.adjustments.blurRadius,
  sharpenAmount: AGENDA_RAIN_CONFIG.adjustments.sharpenAmount,
  sparkleWidthEnabled: AGENDA_RAIN_CONFIG.sparkle.width.enabled,
  sparkleWidthCoverage: AGENDA_RAIN_CONFIG.sparkle.width.coverage,
  sparkleSwing: AGENDA_RAIN_CONFIG.sparkle.width.swingPx,
  sparkleStripeEnabled: AGENDA_RAIN_CONFIG.sparkle.stripe.enabled,
  sparkleStripeCoverage: AGENDA_RAIN_CONFIG.sparkle.stripe.coverage,
  sparkleBrightness: AGENDA_RAIN_CONFIG.sparkle.stripe.maxBrightness,
  sparkleSpeed: AGENDA_RAIN_CONFIG.sparkle.stripe.speed,
  sparkleHueDrift: AGENDA_RAIN_CONFIG.sparkle.stripe.hueDriftDeg,
  sparkleSaturation: AGENDA_RAIN_CONFIG.sparkle.stripe.saturationBoost,
  motionEnabled: AGENDA_RAIN_CONFIG.sparkle.motion.enabled,
  motionAmplitude: AGENDA_RAIN_CONFIG.sparkle.motion.amplitudePx,
  motionStagger: AGENDA_RAIN_CONFIG.sparkle.motion.staggerPx,
  motionMaxOffset: AGENDA_RAIN_CONFIG.sparkle.motion.maxOffsetPx,
  motionSpeed: AGENDA_RAIN_CONFIG.sparkle.motion.speed,
  motionDirection: AGENDA_RAIN_CONFIG.sparkle.motion
    .direction as AgendaRainSettings["motionDirection"],
  dotsEnabled: AGENDA_RAIN_CONFIG.stripeDots.enabled,
  dotsDensity: AGENDA_RAIN_CONFIG.stripeDots.density,
  dotsVisibility: AGENDA_RAIN_CONFIG.stripeDots.randomVisibility,
  dotsSize: AGENDA_RAIN_CONFIG.stripeDots.sizePx,
  dotsBrightness: AGENDA_RAIN_CONFIG.stripeDots.brightness,
  dotsHueDrift: AGENDA_RAIN_CONFIG.stripeDots.hueDriftDeg,
  dotsSaturation: AGENDA_RAIN_CONFIG.stripeDots.saturationBoost,
  borderEnabled: AGENDA_RAIN_CONFIG.stripeBorder.enabled,
  borderMinWidth: AGENDA_RAIN_CONFIG.stripeBorder.minWidthPx,
  borderDensity: AGENDA_RAIN_CONFIG.stripeBorder.density,
  gridLinesEnabled: AGENDA_RAIN_CONFIG.gridLines.enabled,
  gridLinesBrightness: AGENDA_RAIN_CONFIG.gridLines.brightness,
  gridLinesDensity: AGENDA_RAIN_CONFIG.gridLines.density,
  backgroundTransparent: AGENDA_RAIN_CONFIG.background.transparent,
  backgroundColor: toHex(AGENDA_RAIN_CONFIG.background.color),
  starsEnabled: AGENDA_RAIN_CONFIG.background.stars.enabled,
  meteorsEnabled: AGENDA_RAIN_CONFIG.background.meteors.enabled,
  flamesEnabled: AGENDA_RAIN_CONFIG.flames.enabled,
  colorMode: AGENDA_RAIN_CONFIG.colors.mode,
  stripeBlendMode: AGENDA_RAIN_CONFIG.colors.stripeBlendMode,
  shaderOpacity: 1,
  renderMode: AGENDA_RAIN_CONFIG.renderMode,
  renderIntensity: AGENDA_RAIN_CONFIG.renderIntensity,
  renderParamA: AGENDA_RAIN_CONFIG.renderParams[0],
  renderParamB: AGENDA_RAIN_CONFIG.renderParams[1],
  renderParamC: AGENDA_RAIN_CONFIG.renderParams[2],
  renderParamD: AGENDA_RAIN_CONFIG.renderParams[3],
  renderColorA: toHex(AGENDA_RAIN_CONFIG.renderColorA),
  renderColorB: toHex(AGENDA_RAIN_CONFIG.renderColorB),
};

export const AGENDA_RAIN_PANEL_ID = "connect-agenda-rain-v1";
export const AGENDA_RAIN_SETTINGS_EVENT = "connect:agenda-rain-settings";

const cloneDefaults = (): AgendaRainSettings => ({
  ...AGENDA_RAIN_DEFAULTS,
  stripes: defaultStripes(),
});

const isStripe = (value: unknown): value is AgendaRainStripeControl => {
  if (!value || typeof value !== "object") return false;
  const stripe = value as Partial<AgendaRainStripeControl>;
  return (
    typeof stripe.id === "string" &&
    typeof stripe.color === "string" &&
    typeof stripe.startFrom === "number" &&
    typeof stripe.width === "number" &&
    typeof stripe.opacity === "number"
  );
};

export const loadAgendaRainSettings = (): AgendaRainSettings => {
  const settings = cloneDefaults();
  try {
    const raw = localStorage.getItem(`panels:${AGENDA_RAIN_PANEL_ID}`);
    if (!raw) return settings;
    const parsed = JSON.parse(raw) as Partial<AgendaRainSettings>;
    for (const key of Object.keys(settings) as (keyof AgendaRainSettings)[]) {
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

export const publishAgendaRainSettings = (settings: AgendaRainSettings) => {
  window.dispatchEvent(
    new CustomEvent<AgendaRainSettings>(AGENDA_RAIN_SETTINGS_EVENT, {
      detail: settings,
    })
  );
};
