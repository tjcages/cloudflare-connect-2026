import { SPEAKER_SHADER_CONFIG } from "./speaker-shader-config";

export type SpeakerStripeControl = {
  id: string;
  color: string;
  startFrom: number;
  width: number;
  opacity: number;
};

export type SpeakerFrameSettings = {
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  horizontalSpeed: number;
  verticalSpeed: number;
  cursorWidth: number;
  cursorHeight: number;
  cursorFollow: number;
  shaderOpacity: number;
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
  stripes: SpeakerStripeControl[];
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
  engineFramesEnabled: boolean;
  engineFrameThreshold: number;
  engineFrameStripeCount: number;
  engineFrameDistance: number;
  engineFrameColor: string;
  trailEnabled: boolean;
  trailRadius: number;
  trailAlpha: number;
  trailLife: number;
  trailPush: number;
  colorMode: "luminance" | "colors";
  stripeBlendMode: string;
  imageColorLightness: number;
  imageColorDensity: number;
  imageColorRemoveThin: number;
  imageColorBoostThick: number;
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

const defaultStripes = (): SpeakerStripeControl[] =>
  SPEAKER_SHADER_CONFIG.stripes.map((stripe, index) => ({
    id: `stripe-${index + 1}`,
    color: toHex(stripe.color),
    startFrom: stripe.startFrom,
    width: stripe.width,
    opacity: stripe.opacity,
  }));

export const SPEAKER_FRAME_DEFAULTS: SpeakerFrameSettings = {
  frameCount: 6,
  frameWidth: 1,
  frameHeight: 1,
  horizontalSpeed: 1,
  verticalSpeed: 1,
  cursorWidth: 1,
  cursorHeight: 1,
  cursorFollow: 0.22,
  shaderOpacity: 0.56,
  gridCellWidth: SPEAKER_SHADER_CONFIG.grid.cellWidth,
  gridCellHeight: SPEAKER_SHADER_CONFIG.grid.cellHeight,
  gridGapX: SPEAKER_SHADER_CONFIG.grid.gapX,
  gridGapY: SPEAKER_SHADER_CONFIG.grid.gapY,
  gridCornerRadius: SPEAKER_SHADER_CONFIG.grid.cornerRadius,
  gridOverlap: SPEAKER_SHADER_CONFIG.grid.overlapAmount,
  gridOrientation: SPEAKER_SHADER_CONFIG.grid.orientation,
  gridAngle: SPEAKER_SHADER_CONFIG.grid.angleDeg,
  stripesEnabled: SPEAKER_SHADER_CONFIG.stripesEnabled,
  fieldScale: SPEAKER_SHADER_CONFIG.fieldScale,
  stripes: defaultStripes(),
  brightness: SPEAKER_SHADER_CONFIG.adjustments.brightness,
  exposure: SPEAKER_SHADER_CONFIG.adjustments.exposure,
  contrast: SPEAKER_SHADER_CONFIG.adjustments.contrast,
  blackPoint: SPEAKER_SHADER_CONFIG.adjustments.blackPoint,
  whitePoint: SPEAKER_SHADER_CONFIG.adjustments.whitePoint,
  gamma: SPEAKER_SHADER_CONFIG.adjustments.gamma,
  invert: SPEAKER_SHADER_CONFIG.adjustments.invert,
  posterizeLevels: SPEAKER_SHADER_CONFIG.adjustments.posterizeLevels,
  thresholdBias: SPEAKER_SHADER_CONFIG.adjustments.thresholdBias,
  noiseAmount: SPEAKER_SHADER_CONFIG.adjustments.noiseAmount,
  blurRadius: SPEAKER_SHADER_CONFIG.adjustments.blurRadius,
  sharpenAmount: SPEAKER_SHADER_CONFIG.adjustments.sharpenAmount,
  sparkleWidthEnabled: SPEAKER_SHADER_CONFIG.sparkle.width.enabled,
  sparkleWidthCoverage: SPEAKER_SHADER_CONFIG.sparkle.width.coverage,
  sparkleSwing: SPEAKER_SHADER_CONFIG.sparkle.width.swingPx,
  sparkleStripeEnabled: SPEAKER_SHADER_CONFIG.sparkle.stripe.enabled,
  sparkleStripeCoverage: SPEAKER_SHADER_CONFIG.sparkle.stripe.coverage,
  sparkleBrightness: SPEAKER_SHADER_CONFIG.sparkle.stripe.maxBrightness,
  sparkleSpeed: SPEAKER_SHADER_CONFIG.sparkle.stripe.speed,
  sparkleHueDrift: SPEAKER_SHADER_CONFIG.sparkle.stripe.hueDriftDeg,
  sparkleSaturation: SPEAKER_SHADER_CONFIG.sparkle.stripe.saturationBoost,
  dotsEnabled: SPEAKER_SHADER_CONFIG.stripeDots.enabled,
  dotsDensity: SPEAKER_SHADER_CONFIG.stripeDots.density,
  dotsVisibility: SPEAKER_SHADER_CONFIG.stripeDots.randomVisibility,
  dotsSize: SPEAKER_SHADER_CONFIG.stripeDots.sizePx,
  dotsBrightness: SPEAKER_SHADER_CONFIG.stripeDots.brightness,
  dotsHueDrift: SPEAKER_SHADER_CONFIG.stripeDots.hueDriftDeg,
  dotsSaturation: SPEAKER_SHADER_CONFIG.stripeDots.saturationBoost,
  borderEnabled: SPEAKER_SHADER_CONFIG.stripeBorder.enabled,
  borderMinWidth: SPEAKER_SHADER_CONFIG.stripeBorder.minWidthPx,
  borderDensity: SPEAKER_SHADER_CONFIG.stripeBorder.density,
  gridLinesEnabled: SPEAKER_SHADER_CONFIG.gridLines.enabled,
  gridLinesBrightness: SPEAKER_SHADER_CONFIG.gridLines.brightness,
  gridLinesDensity: SPEAKER_SHADER_CONFIG.gridLines.density,
  engineFramesEnabled: SPEAKER_SHADER_CONFIG.frames.enabled,
  engineFrameThreshold: SPEAKER_SHADER_CONFIG.frames.luminanceThreshold,
  engineFrameStripeCount: SPEAKER_SHADER_CONFIG.frames.highlightedStripeCount,
  engineFrameDistance: SPEAKER_SHADER_CONFIG.frames.groupDistanceCells,
  engineFrameColor: toHex(SPEAKER_SHADER_CONFIG.frames.color),
  trailEnabled: SPEAKER_SHADER_CONFIG.cursorTrail.enabled,
  trailRadius: SPEAKER_SHADER_CONFIG.cursorTrail.particleRadius,
  trailAlpha: SPEAKER_SHADER_CONFIG.cursorTrail.particleAlpha,
  trailLife: SPEAKER_SHADER_CONFIG.cursorTrail.particleLifeMs,
  trailPush: SPEAKER_SHADER_CONFIG.cursorTrail.pushStrengthPx,
  colorMode: SPEAKER_SHADER_CONFIG.colors.mode,
  stripeBlendMode: SPEAKER_SHADER_CONFIG.colors.stripeBlendMode,
  imageColorLightness: SPEAKER_SHADER_CONFIG.colors.imageColorLightness,
  imageColorDensity: SPEAKER_SHADER_CONFIG.colors.imageColorDensity,
  imageColorRemoveThin: SPEAKER_SHADER_CONFIG.colors.imageColorRemoveThin,
  imageColorBoostThick: SPEAKER_SHADER_CONFIG.colors.imageColorBoostThick,
  renderMode: SPEAKER_SHADER_CONFIG.renderMode,
  renderIntensity: SPEAKER_SHADER_CONFIG.renderIntensity,
  renderParamA: SPEAKER_SHADER_CONFIG.renderParams[0],
  renderParamB: SPEAKER_SHADER_CONFIG.renderParams[1],
  renderParamC: SPEAKER_SHADER_CONFIG.renderParams[2],
  renderParamD: SPEAKER_SHADER_CONFIG.renderParams[3],
  renderColorA: toHex(SPEAKER_SHADER_CONFIG.renderColorA),
  renderColorB: toHex(SPEAKER_SHADER_CONFIG.renderColorB),
};

export const SPEAKER_FRAME_PANEL_ID = "connect-speaker-frames-v2";
export const LEGACY_SPEAKER_FRAME_PANEL_ID = "connect-speaker-frames-v1";
export const SPEAKER_FRAME_SETTINGS_EVENT = "connect:speaker-frame-settings";

const cloneDefaults = (): SpeakerFrameSettings => ({
  ...SPEAKER_FRAME_DEFAULTS,
  stripes: defaultStripes(),
});

const isStripe = (value: unknown): value is SpeakerStripeControl => {
  if (!value || typeof value !== "object") return false;
  const stripe = value as Partial<SpeakerStripeControl>;
  return (
    typeof stripe.id === "string" &&
    typeof stripe.color === "string" &&
    typeof stripe.startFrom === "number" &&
    typeof stripe.width === "number" &&
    typeof stripe.opacity === "number"
  );
};

export const loadSpeakerFrameSettings = (): SpeakerFrameSettings => {
  const settings = cloneDefaults();
  try {
    const raw =
      localStorage.getItem(`panels:${SPEAKER_FRAME_PANEL_ID}`) ??
      localStorage.getItem(`panels:${LEGACY_SPEAKER_FRAME_PANEL_ID}`);
    if (!raw) return settings;
    const parsed = JSON.parse(raw) as Partial<SpeakerFrameSettings>;
    for (const key of Object.keys(settings) as (keyof SpeakerFrameSettings)[]) {
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

export const publishSpeakerFrameSettings = (settings: SpeakerFrameSettings) => {
  window.dispatchEvent(
    new CustomEvent<SpeakerFrameSettings>(SPEAKER_FRAME_SETTINGS_EVENT, {
      detail: settings,
    })
  );
};
