export type Fit = "stretch" | "contain" | "cover";

export type WavePosition =
  | "center"
  | "left top"
  | "center top"
  | "right top"
  | "left center"
  | "right center"
  | "left bottom"
  | "center bottom"
  | "right bottom";

export interface RevealConfig {
  enabled: boolean;
  type: "wave" | "assembly";
  wave: {
    position: WavePosition;
    durationMs: number;
    softness: number;
    waviness: number;
  };
  assembly: {
    sliceSizePx: number;
    speedMinMs: number;
    speedMaxMs: number;
    staggerMs: number;
    scatterPx: number;
    angleJitterDeg: number;
  };
}

export interface Stripe {
  color: number;
  startFrom: number;
  width: number;
}

export interface Transform {
  fit: Fit;
  zoom: number;
  panX: number;
  panY: number;
}

export interface Adjustments {
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
}

export interface Background {
  color: number;
}

export interface Grid {
  cellWidth: number;
  cellHeight: number;
  gapX: number;
  gapY: number;
  cornerRadius: number;
  orientation: "vertical" | "horizontal";
}

export interface SparkleConfig {
  gaps: { enabled: boolean; coverage: number; speed: number };
  width: { enabled: boolean; coverage: number; speed: number; swingPx: number };
}

export type FlamesDirection = "up" | "down" | "left" | "right";

export interface FlamesConfig {
  enabled: boolean;
  direction: FlamesDirection;
  minWidthRatio: number;
  maxWidthRatio: number;
  minHeightRatio: number;
  maxHeightRatio: number;
  baseSpeedPxPerSec: number;
  speedVariation: number;
  spawnIntervalMs: number;
  spawnJitterMs: number;
  maxActive: number;
  edgeSharpness: number;
  opacityMin: number;
  opacityMax: number;
}

export interface EdgeMaskConfig {
  enabled: boolean;
  start: number;
  end: number;
  power: number;
}

export interface CursorTrailConfig {
  enabled: boolean;
  particleRadius: number;
  particleAlpha: number;
  particleLifeMs: number;
  particleLifeJitterMs: number;
  emitterVelocitySmoothing: number;
  particleVelocityScale: number;
  particleTangentVelocity: number;
  particleDamping: number;
  particleSpacingPx: number;
  maxEmitPerTick: number;
  spreadMinPx: number;
  spreadMaxPx: number;
  spinStrength: number;
  densityRadiusMinScale: number;
  densityRadiusLifeScale: number;
  pushRadiusScale: number;
  pushStrengthPx: number;
  pushLagPx: number;
  pushWobblePx: number;
  pushLeadBlackAlpha: number;
}

export interface ClickWaveConfig {
  enabled: boolean;
  lifeMs: number;
  startRadiusPx: number;
  maxRadiusPx: number;
  startStrokeWidthPx: number;
  endStrokeWidthPx: number;
  maxWaves: number;
  pushStrengthPx: number;
  pushBandScale: number;
  stripeWhiteAlpha: number;
}

export interface LettersConfig {
  enabled: boolean;
  coverage: number;
  sizeScale: number;
  shuffleSpeed: number;
}

export interface ColorsConfig {
  mode: "luminance" | "colors";
  autoDetectBackground: boolean;
  backgroundColor: number;
}

export interface EngineConfig {
  transform: Transform;
  adjustments: Adjustments;
  background: Background;
  grid: Grid;
  stripes: Stripe[];
  stripesEnabled: boolean;
  fieldScale: number;
  reveal: RevealConfig;
  sparkle: SparkleConfig;
  flames: FlamesConfig;
  edgeMask: EdgeMaskConfig;
  cursorTrail: CursorTrailConfig;
  clickWave: ClickWaveConfig;
  letters: LettersConfig;
  colors: ColorsConfig;
}
