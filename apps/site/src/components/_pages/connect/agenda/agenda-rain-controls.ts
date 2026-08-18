import { AGENDA_RAIN_CONFIG } from "./agenda-rain-config";

export type AgendaRainStripeControl = {
  id: string;
  color: string;
  startFrom: number;
  width: number;
  opacity: number;
};

export type AgendaRainSettings = {
  // Texture source ("Wave to Full Screen" framing)
  sourceSpeed: number;
  sourceZoom: number;
  sourcePanX: number;
  sourcePanY: number;
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
  sourceSpeed: 1,
  sourceZoom: 1,
  sourcePanX: 0,
  sourcePanY: 0,
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
  backgroundTransparent: AGENDA_RAIN_CONFIG.background.transparent,
  backgroundColor: toHex(AGENDA_RAIN_CONFIG.background.color),
  starsEnabled: AGENDA_RAIN_CONFIG.background.stars.enabled,
  meteorsEnabled: AGENDA_RAIN_CONFIG.background.meteors.enabled,
  flamesEnabled: AGENDA_RAIN_CONFIG.flames.enabled,
  colorMode: AGENDA_RAIN_CONFIG.colors.mode,
  stripeBlendMode: AGENDA_RAIN_CONFIG.colors.stripeBlendMode,
  shaderOpacity: 1,
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
