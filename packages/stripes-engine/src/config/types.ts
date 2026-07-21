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

export type RevealType = "wave" | "assembly" | "turbulence" | "glitch" | "vortex" | "water" | "custom";

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

export type FlamesDirection = "up" | "down" | "left" | "right" | "upDown" | "leftRight";

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

export type CursorTrailType = "default" | "wave" | "constellation";

export const CURSOR_TRAIL_TYPES: readonly CursorTrailType[] = ["default", "wave", "constellation"];

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
   * "constellation" = cursor-linked star graph rendered into the field.
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
