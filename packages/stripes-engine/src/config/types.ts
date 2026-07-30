export type Fit = "stretch" | "contain" | "cover" | "width" | "height";

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

export type RevealType =
  | "wave"
  | "assembly"
  | "turbulence"
  | "glitch"
  | "vortex"
  | "blackhole"
  | "whirlpool"
  | "water"
  | "custom";

export interface WarpStyleConfig {
  speedMinMs: number;
  speedMaxMs: number;
  staggerMs: number;
  intensity: number;
  detail: number;
  glow: number;
}

export interface VortexRevealConfig extends WarpStyleConfig {
  swirl: number;
}

export interface BlackholeRevealConfig extends WarpStyleConfig {
  swirl: number;
  formMs: number;
  collapseMs: number;
  arms: number;
  lensing: number;
  horizon: number;
}

export interface WhirlpoolRevealConfig {
  durationMs: number;
  turns: number;
  tightness: number;
  streak: number;
  glow: number;
}

export interface WaterRevealConfig {
  durationMs: number;
  settleMs: number;
  rows: number;
  intensity: number;
  wobble: number;
  refraction: number;
  softness: number;
}

export interface RevealConfig {
  enabled: boolean;
  type: RevealType;
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
    blurPx?: number;
    blurStart?: number;
  };
  turbulence: WarpStyleConfig;
  glitch: WarpStyleConfig;
  vortex: VortexRevealConfig;
  blackhole: BlackholeRevealConfig;
  whirlpool: WhirlpoolRevealConfig;
  water: WaterRevealConfig;
}

export interface Stripe {
  color: number;
  startFrom: number;
  width: number;
  opacity: number;
}

export type GradientDirection = "topToBottom" | "leftToRight" | "rightToLeft" | "bottomToTop";

export interface GradientConfig {
  direction: GradientDirection;
  stopCount: number;
  stops: number[];
  hueDriftDeg: number;
  saturationBoost: number;
}

export interface BackgroundGradient extends GradientConfig {
  enabled: boolean;
}

export interface BackgroundGrid {
  enabled: boolean;
  cellWidth: number;
  cellHeight: number;
  gapX: number;
  gapY: number;
  cornerRadius: number;
  color: number;
  opacity: number;
}

export interface BackgroundStars {
  enabled: boolean;
  density: number;
  sizePx: number;
  sizeRandomness: number;
  tiltAngleDeg: number;
  twinkleSpeed: number;
  twinkleAmount: number;
  opacity: number;
  color: number;
}

export interface BackgroundMeteors {
  enabled: boolean;
  ratePerSec: number;
  maxActive: number;
  radiantAngleDeg: number;
  angleJitterDeg: number;
  speedScale: number;
  speedVariation: number;
  tailLengthScale: number;
  tailLengthVariation: number;
  thicknessScale: number;
  thicknessVariation: number;
  lifetimeMinMs: number;
  lifetimeMaxMs: number;
  brightness: number;
  headGlow: number;
  pushPx: number;
  pushFalloffScale: number;
  fadeInMs: number;
  fadeOutMs: number;
  seed: number;
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
  transparent: boolean;
  gradient: BackgroundGradient;
  grid: BackgroundGrid;
  stars: BackgroundStars;
  meteors: BackgroundMeteors;
}

export interface Grid {
  cellWidth: number;
  cellHeight: number;
  gapX: number;
  gapY: number;
  cornerRadius: number;
  orientation: "vertical" | "horizontal";
  angleDeg: number;
  rotationMode: "cell" | "overlap";
  overlapAmount: number;
  streamGapWave: {
    enabled: boolean;
    squeeze: number;
    wavelengthCells: number;
    speed: number;
    phaseDeg: number;
  };
}

export type MotionDirection = "leftToRight" | "rightToLeft" | "topToBottom" | "bottomToTop";

export interface SparkleConfig {
  gaps: { enabled: boolean; coverage: number; speed: number };
  width: { enabled: boolean; coverage: number; swingPx: number; swingPeriodMin: number; swingPeriodMax: number };
  stripe: {
    enabled: boolean;
    coverage: number;
    maxBrightness: number;
    speed: number;
    thickestCount: number;
    hueDriftDeg: number;
    saturationBoost: number;
  };
  motion: {
    enabled: boolean;
    amplitudePx: number;
    staggerPx: number;
    maxOffsetPx: number;
    speed: number;
    direction: MotionDirection;
  };
}

export interface StripeDotsConfig {
  enabled: boolean;
  density: number;
  randomVisibility: number;
  sizePx: number;
  brightness: number;
  hueDriftDeg: number;
  saturationBoost: number;
}

export interface StripeBorderConfig {
  enabled: boolean;
  minWidthPx: number;
  density: number;
}

export interface GridLinesConfig {
  enabled: boolean;
  brightness: number;
  density: number;
}

export interface FramesConfig {
  enabled: boolean;
  luminanceThreshold: number;
  highlightedStripeCount: number;
  groupDistanceCells: number;
  color: number;
  fontSizePx: number;
  coordinateColor: number;
}

export type FlamesDirection = "up" | "down" | "left" | "right" | "upDown" | "leftRight" | "vortexSingular";

export interface VortexSingularConfig {
  segCount: number;
  segSpacingPx: number;
  turnRate: number;
  turnVariation: number;
  visibleMinMs: number;
  visibleMaxMs: number;
  hiddenMinMs: number;
  hiddenMaxMs: number;
  lifeMinMs: number;
  lifeMaxMs: number;
  edgeMarginRatio: number;
}

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
  vortexSingular: VortexSingularConfig;
}

export interface EdgeMaskSides {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export interface EdgeMaskConfig {
  enabled: boolean;
  start: number;
  end: number;
  power: number;
  sides: EdgeMaskSides;
}

export type CursorTrailType = "default" | "wave" | "constellation" | "comet";

export const CURSOR_TRAIL_TYPES: readonly CursorTrailType[] = ["default", "wave", "constellation", "comet"];

export interface CometTrailConfig {
  nodeCount: number;
  headStiffness: number;
  headDamping: number;
  chainStiffness: number;
  chainDamping: number;
  maxLinkPx: number;
  headRadiusPx: number;
  tailRadiusPx: number;
  stretchThinning: number;
  smoothUnionPx: number;
  bodyBrightness: number;
  auraStrength: number;
  bodyPushPx: number;
  presenceRiseRate: number;
  presenceFallRate: number;
  embersEnabled: boolean;
  emberRatePerSec: number;
  emberMaxCount: number;
  emberSizePx: number;
  emberSpeedMinPxPerSec: number;
  emberSpeedMaxPxPerSec: number;
  emberSpreadRad: number;
  emberLifetimeMinMs: number;
  emberLifetimeMaxMs: number;
  emberBrightness: number;
  emberFadeInFraction: number;
  seed: number;
}

export interface ConstellationTrailConfig {
  radiusScale: number;
  starDensity: number;
  starSizePx: number;
  starSizeRandomness: number;
  starGrowScale: number;
  starPushPx: number;
  twinkleAmount: number;
  twinkleSpeed: number;
  linkThicknessPx: number;
  linkBrightness: number;
  linkGrooveDepth: number;
  linkShearPx: number;
  linkMaxDistScale: number;
  linkFormMs: number;
  linkHoldMs: number;
  linkDissolveMs: number;
  maxLinks: number;
  maxStars: number;
  pulseEnabled: boolean;
  pulseDurationMs: number;
  pulseCoreLenPx: number;
  pulseTailLenPx: number;
  pulseBrightness: number;
  pulseRelayHops: number;
  pulseCooldownMs: number;
  flareMs: number;
  flareScale: number;
  polygonFlashEnabled: boolean;
  polygonFlashStrength: number;
}

export interface CursorTrailConfig {
  enabled: boolean;
  /**
   * "default" = particle splats; "wave" = GPU heightfield water simulation;
   * "constellation" = cursor-linked star graph rendered into the field;
   * "comet" = lagging liquid body with shed embers rendered into the field.
   */
  type: CursorTrailType;
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
  constellation: ConstellationTrailConfig;
  comet: CometTrailConfig;
}

export type ClickWaveType = "default" | "detonation";

export const CLICK_WAVE_TYPES: readonly ClickWaveType[] = ["default", "detonation"];

export interface DetonationClickConfig {
  maxConcurrent: number;
  ringReachPx: number;
  ringDurationMs: number;
  ringThicknessPx: number;
  ringRefractionPx: number;
  flashRadiusPx: number;
  flashDurationMs: number;
  flashBrightness: number;
  debrisCount: number;
  debrisSpeedPxPerSec: number;
  debrisSpeedVariation: number;
  debrisDrag: number;
  debrisGravityPxPerSec2: number;
  debrisLifetimeMs: number;
  debrisLifetimeVariation: number;
  debrisSizePx: number;
  debrisBrightness: number;
  craterRadiusPx: number;
  craterDepth: number;
  craterRelaxFastMs: number;
  craterRelaxSlowMs: number;
  craterLifeMs: number;
  craterRimStrength: number;
  seed: number;
}

export interface ClickWaveConfig {
  enabled: boolean;
  /**
   * "default" = expanding stripe ring; "detonation" = flash, shock ring,
   * ballistic debris and a relaxing crater written into the field.
   */
  type: ClickWaveType;
  lifeMs: number;
  startRadiusPx: number;
  maxRadiusPx: number;
  startStrokeWidthPx: number;
  endStrokeWidthPx: number;
  maxWaves: number;
  pushStrengthPx: number;
  pushBandScale: number;
  stripeWhiteAlpha: number;
  detonation: DetonationClickConfig;
}

export interface LettersConfig {
  enabled: boolean;
  mode: "random" | "text";
  colorMode: "white" | "colorful";
  color: number;
  coverage: number;
  positionX: number;
  positionY: number;
  areaWidth: number;
  areaHeight: number;
  text: string;
  textCopies: number;
  fontFamily: string;
  sizeScale: number;
  shuffleSpeed: number;
}

export type StripeBlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "difference"
  | "exclusion";

export interface ColorsConfig {
  mode: "luminance" | "colors";
  stripeBlendMode: StripeBlendMode;
  imageColorLightness: number;
  imageColorDensity: number;
  imageColorRemoveThin: number;
  imageColorBoostThick: number;
  autoDetectBackground: boolean;
  backgroundColor: number;
  gradient: BackgroundGradient;
}

export type RenderMode =
  | "sharp"
  | "abstract"
  | "charcoal"
  | "pencil"
  | "brush"
  | "halftone"
  | "risograph"
  | "stainedGlass"
  | "paperCutout"
  | "crt"
  | "glitch"
  | "vhs"
  | "amber"
  | "gummy";

export interface EngineConfig {
  transform: Transform;
  adjustments: Adjustments;
  background: Background;
  grid: Grid;
  stripes: Stripe[];
  stripesEnabled: boolean;
  fieldScale: number;
  /**
   * Per-texture paint-rate cap in frames per second. `0` (the default) leaves the
   * texture uncapped — it renders every animation tick, byte-identical to omitting
   * the field. A positive value skips renders so this texture paints at most
   * `maxFps` frames/sec; because animation timing is wall-clock based, capping
   * lowers the paint rate without changing animation speed. Applies both to the
   * standalone rAF loop and per-registration in the shared-context worker, so one
   * texture can be capped while others on the same page stay uncapped.
   */
  maxFps: number;
  reveal: RevealConfig;
  sparkle: SparkleConfig;
  stripeDots: StripeDotsConfig;
  stripeBorder: StripeBorderConfig;
  gridLines: GridLinesConfig;
  frames: FramesConfig;
  flames: FlamesConfig;
  edgeMask: EdgeMaskConfig;
  cursorTrail: CursorTrailConfig;
  clickWave: ClickWaveConfig;
  letters: LettersConfig;
  colors: ColorsConfig;
  renderMode: RenderMode;
  renderIntensity: number;
  renderParams: number[];
  renderColorA: number;
  renderColorB: number;
}
