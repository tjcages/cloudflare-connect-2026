import {
  normalizeEngineConfig,
  type EngineConfig,
} from "@necatikcl/stripes-engine";

/**
 * The designer-authored agenda rain recipe: the lab's factory "Section-grid
 * Rain" engine config (`apps/lab/src/factoryDefaults.json` with
 * `sparkle.gaps.enabled` armed) plus the values authored through the Agenda
 * Rain panel and copied out via its Config → Copy config section. Sections
 * that ship disabled (cursor trail, click wave, letters, detected frames…)
 * lean on `normalizeEngineConfig` defaults instead of restating every field.
 */
const AGENDA_RAIN_BASE = {
  transform: { fit: "width", zoom: 1, panX: 0, panY: 0 },
  adjustments: {
    brightness: -0.11,
    exposure: 1.5,
    contrast: 0.54,
    blackPoint: 0.02,
    whitePoint: 1,
    gamma: 0.55,
    invert: false,
    posterizeLevels: 0,
    thresholdBias: 0,
    noiseAmount: 0,
    blurRadius: 0,
    sharpenAmount: 0,
  },
  background: {
    color: 16777215,
    transparent: true,
    gradient: { enabled: false },
    grid: { enabled: false },
    stars: {
      enabled: true,
      density: 10,
      sizePx: 4,
      sizeRandomness: 1,
      tiltAngleDeg: -15,
      twinkleSpeed: 1,
      twinkleAmount: 0.7,
      opacity: 1,
      color: 16777215,
    },
    meteors: {
      enabled: true,
      ratePerSec: 1.32,
      maxActive: 16,
      radiantAngleDeg: -15,
      angleJitterDeg: 30,
      speedScale: 0.27,
      speedVariation: 1,
      tailLengthScale: 0.21,
      tailLengthVariation: 0.62,
      thicknessScale: 0.45,
      thicknessVariation: 0.64,
      lifetimeMinMs: 350,
      lifetimeMaxMs: 2630,
      brightness: 1,
      headGlow: 1,
      pushPx: 9.5,
      pushFalloffScale: 1,
      fadeInMs: 80,
      fadeOutMs: 580,
      seed: 1,
    },
  },
  grid: {
    cellWidth: 13,
    cellHeight: 15,
    gapX: 12,
    gapY: 0,
    cornerRadius: 0,
    orientation: "vertical",
    angleDeg: 45,
    rotationMode: "cell",
    overlapAmount: 1.2,
    streamGapWave: {
      enabled: false,
      squeeze: 0.14,
      wavelengthCells: 9,
      speed: -4,
      phaseDeg: -180,
    },
  },
  stripes: [
    { color: 16448250, startFrom: 0, width: 0.5, opacity: 0.41 },
    { color: 16775400, startFrom: 0.1644, width: 1, opacity: 0 },
    { color: 16707538, startFrom: 0.4418, width: 1.5, opacity: 1 },
    { color: 16769973, startFrom: 0.6357, width: 2, opacity: 1 },
    { color: 9451772, startFrom: 0.7104, width: 2.5, opacity: 1 },
    { color: 2450430, startFrom: 0.7494, width: 3, opacity: 1 },
    { color: 3054929, startFrom: 0.7724, width: 4.5, opacity: 1 },
    { color: 16365371, startFrom: 0.7864, width: 4, opacity: 1 },
    { color: 16365371, startFrom: 0.7946, width: 4.5, opacity: 1 },
    { color: 16015393, startFrom: 0.7988, width: 5, opacity: 1 },
  ],
  stripesEnabled: true,
  fieldScale: 0.25,
  maxFps: 0,
  reveal: { enabled: false, type: "water" },
  sparkle: {
    // Armed gaps are what make the section-grid config read as Rain.
    gaps: { enabled: true, coverage: 0, speed: 1 },
    width: {
      enabled: false,
      coverage: 0.12,
      swingPx: 1,
      swingPeriodMin: 0.7,
      swingPeriodMax: 1.4,
    },
    stripe: {
      enabled: false,
      coverage: 0.55,
      maxBrightness: 0.7,
      speed: 0.15,
      thickestCount: 1,
      hueDriftDeg: 180,
      saturationBoost: 1,
    },
    motion: {
      enabled: false,
      amplitudePx: 1.2,
      staggerPx: 3,
      maxOffsetPx: 64,
      speed: 0.28,
      direction: "leftToRight",
    },
  },
  stripeDots: {
    enabled: false,
    density: 0.5,
    randomVisibility: 1,
    sizePx: 1.5,
    brightness: 0.35,
    hueDriftDeg: 0,
    saturationBoost: 0,
  },
  stripeBorder: { enabled: false, minWidthPx: 2, density: 1 },
  gridLines: { enabled: false, brightness: 0.35, density: 1 },
  frames: { enabled: false },
  flames: {
    enabled: true,
    direction: "upDown",
    minWidthRatio: 0.005,
    maxWidthRatio: 0.02,
    minHeightRatio: 0.02,
    maxHeightRatio: 0.04,
    baseSpeedPxPerSec: 30,
    speedVariation: 1,
    spawnIntervalMs: 80,
    spawnJitterMs: 80,
    maxActive: 25,
    edgeSharpness: 1,
    opacityMin: 0.3,
    opacityMax: 0.9,
  },
  edgeMask: { enabled: false, start: 0, end: 0.1, power: 0.6 },
  cursorTrail: { enabled: false },
  clickWave: { enabled: false },
  letters: { enabled: false },
  colors: {
    mode: "luminance",
    stripeBlendMode: "multiply",
    imageColorLightness: 0,
    imageColorDensity: 1,
    imageColorRemoveThin: 0,
    imageColorBoostThick: 0,
    autoDetectBackground: false,
    backgroundColor: 0,
  },
  renderMode: "sharp",
  renderIntensity: 1,
  renderParams: [0.5, 0.5, 0.5, 0.52],
  renderColorA: 2236962,
  renderColorB: 16777215,
} as Partial<EngineConfig>;

/**
 * Fully normalized production config. `setConfig` replaces nested sections
 * wholesale, so runtime patches must spread from this object rather than
 * sending partial sections.
 */
export const AGENDA_RAIN_CONFIG: EngineConfig =
  normalizeEngineConfig(AGENDA_RAIN_BASE);

export const AGENDA_RAIN_MAX_DPR = 1.5;
