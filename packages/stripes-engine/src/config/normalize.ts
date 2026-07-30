import type {
  Transform,
  Background,
  Grid,
  Adjustments,
  Stripe,
  EngineConfig,
  RevealConfig,
  SparkleConfig,
  StripeDotsConfig,
  StripeBorderConfig,
  GridLinesConfig,
  FramesConfig,
  FlamesConfig,
  FlamesDirection,
  VortexSingularConfig,
  WavePosition,
  EdgeMaskConfig,
  EdgeMaskSides,
  ConstellationTrailConfig,
  CometTrailConfig,
  CursorTrailConfig,
  ClickWaveConfig,
  DetonationClickConfig,
  LettersConfig,
  ColorsConfig,
  RenderMode,
  GradientConfig,
  BackgroundGradient,
  BackgroundMeteors,
  GradientDirection,
  MotionDirection,
  StripeBlendMode,
  RevealType,
  WarpStyleConfig,
  VortexRevealConfig,
  BlackholeRevealConfig,
  WhirlpoolRevealConfig,
  WaterRevealConfig,
} from "./types";

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
const num = (v: unknown, dflt: number): number => (typeof v === "number" && Number.isFinite(v) ? v : dflt);

export const DEFAULT_TRANSFORM: Transform = { fit: "width", zoom: 1, panX: 0, panY: 0 };
export function normalizeTransform(i: Partial<Transform> = {}): Transform {
  const fit =
    i.fit === "contain" || i.fit === "cover" || i.fit === "stretch" || i.fit === "width" || i.fit === "height"
      ? i.fit
      : "width";
  return {
    fit,
    zoom: clamp(num(i.zoom, 1), 0.1, 8),
    panX: clamp(num(i.panX, 0), -1, 1),
    panY: clamp(num(i.panY, 0), -1, 1),
  };
}

export const GRADIENT_DIRECTIONS: GradientDirection[] = ["topToBottom", "leftToRight", "rightToLeft", "bottomToTop"];
export function gradientDirectionIndex(d: GradientDirection): number {
  return GRADIENT_DIRECTIONS.indexOf(d);
}
export const DEFAULT_GRADIENT: GradientConfig = {
  direction: "topToBottom",
  stopCount: 2,
  stops: [0xffffff, 0, 0, 0],
  hueDriftDeg: 0,
  saturationBoost: 0,
};
export function normalizeGradient(i: Partial<GradientConfig> = {}): GradientConfig {
  const stops = Array.isArray(i.stops) ? i.stops : [];
  return {
    direction: GRADIENT_DIRECTIONS.includes(i.direction as GradientDirection)
      ? (i.direction as GradientDirection)
      : DEFAULT_GRADIENT.direction,
    stopCount: Math.round(clamp(num(i.stopCount, DEFAULT_GRADIENT.stopCount), 2, 4)),
    stops: [0, 1, 2, 3].map((k) => Math.round(clamp(num(stops[k], DEFAULT_GRADIENT.stops[k]), 0, 0xffffff))),
    hueDriftDeg: clamp(num(i.hueDriftDeg, DEFAULT_GRADIENT.hueDriftDeg), -180, 180),
    saturationBoost: clamp(num(i.saturationBoost, DEFAULT_GRADIENT.saturationBoost), 0, 1),
  };
}

export const DEFAULT_BACKGROUND_METEORS: BackgroundMeteors = {
  enabled: false,
  ratePerSec: 5,
  maxActive: 36,
  radiantAngleDeg: 35,
  angleJitterDeg: 14,
  speedScale: 1,
  speedVariation: 0.4,
  tailLengthScale: 1,
  tailLengthVariation: 0.47,
  thicknessScale: 1,
  thicknessVariation: 0.39,
  lifetimeMinMs: 1000,
  lifetimeMaxMs: 2400,
  brightness: 1,
  headGlow: 1,
  pushPx: 6,
  pushFalloffScale: 1,
  fadeInMs: 80,
  fadeOutMs: 580,
  seed: 1,
};

export function normalizeBackgroundMeteors(i: Partial<BackgroundMeteors> = {}): BackgroundMeteors {
  const d = DEFAULT_BACKGROUND_METEORS;
  const lifetimeMinMs = clamp(num(i.lifetimeMinMs, d.lifetimeMinMs), 60, 20_000);
  const lifetimeMaxMs = Math.max(lifetimeMinMs, clamp(num(i.lifetimeMaxMs, d.lifetimeMaxMs), 60, 20_000));
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : d.enabled,
    ratePerSec: clamp(num(i.ratePerSec, d.ratePerSec), 0.02, 120),
    maxActive: clampInt(num(i.maxActive, d.maxActive), 1, 64),
    radiantAngleDeg: clamp(num(i.radiantAngleDeg, d.radiantAngleDeg), -180, 180),
    angleJitterDeg: clamp(num(i.angleJitterDeg, d.angleJitterDeg), 0, 90),
    speedScale: clamp(num(i.speedScale, d.speedScale), 0.05, 6),
    speedVariation: clamp(num(i.speedVariation, d.speedVariation), 0, 1),
    tailLengthScale: clamp(num(i.tailLengthScale, d.tailLengthScale), 0.05, 6),
    tailLengthVariation: clamp(num(i.tailLengthVariation, d.tailLengthVariation), 0, 1),
    thicknessScale: clamp(num(i.thicknessScale, d.thicknessScale), 0.05, 6),
    thicknessVariation: clamp(num(i.thicknessVariation, d.thicknessVariation), 0, 1),
    lifetimeMinMs,
    lifetimeMaxMs,
    brightness: clamp(num(i.brightness, d.brightness), 0, 4),
    headGlow: clamp(num(i.headGlow, d.headGlow), 0, 4),
    pushPx: clamp(num(i.pushPx, d.pushPx), 0, 80),
    pushFalloffScale: clamp(num(i.pushFalloffScale, d.pushFalloffScale), 0.05, 8),
    fadeInMs: clamp(num(i.fadeInMs, d.fadeInMs), 0, 10_000),
    fadeOutMs: clamp(num(i.fadeOutMs, d.fadeOutMs), 0, 10_000),
    seed: clampInt(num(i.seed, d.seed), 0, 1_000_000),
  };
}

export const DEFAULT_BACKGROUND: Background = {
  color: 0xffffff,
  transparent: true,
  gradient: { enabled: false, ...DEFAULT_GRADIENT, stops: [...DEFAULT_GRADIENT.stops] },
  grid: {
    enabled: false,
    cellWidth: 96,
    cellHeight: 96,
    gapX: 8,
    gapY: 8,
    cornerRadius: 0,
    color: 0xf3f3f3,
    opacity: 1,
  },
  stars: {
    enabled: false,
    density: 50,
    sizePx: 8,
    sizeRandomness: 0.65,
    tiltAngleDeg: 0,
    twinkleSpeed: 1,
    twinkleAmount: 0.7,
    opacity: 0.8,
    color: 0xffffff,
  },
  meteors: { ...DEFAULT_BACKGROUND_METEORS },
};

type PartialBackground = {
  color?: unknown;
  transparent?: unknown;
  gradient?: Partial<Background["gradient"]>;
  grid?: Partial<Background["grid"]>;
  stars?: Partial<Background["stars"]>;
  meteors?: Partial<Background["meteors"]>;
};

export function normalizeBackground(i: PartialBackground = {}): Background {
  const g = i.grid ?? {};
  const s = i.stars ?? {};
  const gr = i.gradient ?? {};
  const cellWidth = clamp(Math.round(num(g.cellWidth, DEFAULT_BACKGROUND.grid.cellWidth)), 4, 512);
  const cellHeight = clamp(Math.round(num(g.cellHeight, DEFAULT_BACKGROUND.grid.cellHeight)), 4, 512);
  return {
    color: Math.round(clamp(num(i.color, DEFAULT_BACKGROUND.color), 0, 0xffffff)),
    transparent: i.transparent === undefined ? DEFAULT_BACKGROUND.transparent : !!i.transparent,
    gradient: {
      enabled: gr.enabled === undefined ? DEFAULT_BACKGROUND.gradient.enabled : !!gr.enabled,
      ...normalizeGradient(gr),
    },
    grid: {
      enabled: g.enabled === undefined ? DEFAULT_BACKGROUND.grid.enabled : !!g.enabled,
      cellWidth,
      cellHeight,
      gapX: clamp(num(g.gapX, DEFAULT_BACKGROUND.grid.gapX), 0, cellWidth),
      gapY: clamp(num(g.gapY, DEFAULT_BACKGROUND.grid.gapY), 0, cellHeight),
      cornerRadius: clamp(
        num(g.cornerRadius, DEFAULT_BACKGROUND.grid.cornerRadius),
        0,
        Math.max(cellWidth, cellHeight),
      ),
      color: Math.round(clamp(num(g.color, DEFAULT_BACKGROUND.grid.color), 0, 0xffffff)),
      opacity: clamp(num(g.opacity, DEFAULT_BACKGROUND.grid.opacity), 0, 1),
    },
    stars: {
      enabled: s.enabled === undefined ? DEFAULT_BACKGROUND.stars.enabled : !!s.enabled,
      density: clamp(num(s.density, DEFAULT_BACKGROUND.stars.density), 0, 100),
      sizePx: clamp(num(s.sizePx, DEFAULT_BACKGROUND.stars.sizePx), 0.25, 64),
      sizeRandomness: clamp(num(s.sizeRandomness, DEFAULT_BACKGROUND.stars.sizeRandomness), 0, 1),
      tiltAngleDeg: clamp(num(s.tiltAngleDeg, DEFAULT_BACKGROUND.stars.tiltAngleDeg), -89, 89),
      twinkleSpeed: clamp(num(s.twinkleSpeed, DEFAULT_BACKGROUND.stars.twinkleSpeed), 0, 10),
      twinkleAmount: clamp(num(s.twinkleAmount, DEFAULT_BACKGROUND.stars.twinkleAmount), 0, 1),
      opacity: clamp(num(s.opacity, DEFAULT_BACKGROUND.stars.opacity), 0, 1),
      color: Math.round(clamp(num(s.color, DEFAULT_BACKGROUND.stars.color), 0, 0xffffff)),
    },
    meteors: normalizeBackgroundMeteors(i.meteors),
  };
}

export const DEFAULT_GRID: Grid = {
  cellWidth: 7,
  cellHeight: 7,
  gapX: 0,
  gapY: 0,
  cornerRadius: 0,
  orientation: "vertical",
  angleDeg: 0,
  rotationMode: "cell",
  overlapAmount: 1,
  streamGapWave: {
    enabled: false,
    squeeze: 0,
    wavelengthCells: 16,
    speed: 0,
    phaseDeg: 0,
  },
};
export function normalizeGrid(i: Partial<Grid> = {}): Grid {
  const cellWidth = clamp(Math.round(num(i.cellWidth, 7)), 1, 64);
  const cellHeight = clamp(Math.round(num(i.cellHeight, 7)), 1, 64);
  const orientation = i.orientation === "horizontal" ? "horizontal" : "vertical";
  return {
    cellWidth,
    cellHeight,
    gapX: clamp(num(i.gapX, 0), 0, cellWidth),
    gapY: clamp(num(i.gapY, 0), 0, cellHeight),
    cornerRadius: clamp(num(i.cornerRadius, 0), 0, Math.max(cellWidth, cellHeight)),
    orientation,
    angleDeg: clamp(num(i.angleDeg, orientation === "horizontal" ? 90 : 0), -180, 180),
    rotationMode: i.rotationMode === "overlap" ? "overlap" : "cell",
    overlapAmount: clamp(num(i.overlapAmount, 1), 0, 4),
    streamGapWave: {
      enabled: Boolean(i.streamGapWave?.enabled),
      squeeze: clamp(num(i.streamGapWave?.squeeze, 0), 0, 1),
      wavelengthCells: clamp(num(i.streamGapWave?.wavelengthCells, 16), 2, 32),
      speed: clamp(num(i.streamGapWave?.speed, 0), -10, 10),
      phaseDeg: clamp(num(i.streamGapWave?.phaseDeg, 0), -180, 180),
    },
  };
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
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
};
export function normalizeAdjustments(i: Partial<Adjustments> = {}): Adjustments {
  const blackPoint = clamp(num(i.blackPoint, 0), 0, 1);
  return {
    brightness: clamp(num(i.brightness, 0), -1, 1),
    exposure: clamp(num(i.exposure, 0), -5, 5),
    contrast: clamp(num(i.contrast, 1), 0, 4),
    blackPoint,
    whitePoint: clamp(num(i.whitePoint, 1), blackPoint + 0.01, 1),
    gamma: Math.max(0.05, num(i.gamma, 1)),
    invert: !!i.invert,
    posterizeLevels: clamp(Math.round(num(i.posterizeLevels, 0)), 0, 16),
    thresholdBias: clamp(num(i.thresholdBias, 0), -1, 1),
    noiseAmount: clamp(num(i.noiseAmount, 0), 0, 1),
    blurRadius: clamp(num(i.blurRadius, 0), 0, 4),
    sharpenAmount: clamp(num(i.sharpenAmount, 0), 0, 4),
  };
}

export const DEFAULT_STRIPES: Stripe[] = [
  { color: 0xf3f3f3, startFrom: 0.12, width: 1, opacity: 1 },
  { color: 0xfada98, startFrom: 0.28, width: 1, opacity: 1 },
  { color: 0xf8bd70, startFrom: 0.44, width: 2, opacity: 1 },
  { color: 0xf69e4d, startFrom: 0.6, width: 3, opacity: 1 },
  { color: 0xf27c33, startFrom: 0.76, width: 4, opacity: 1 },
  { color: 0xeb5729, startFrom: 0.9, width: 5, opacity: 1 },
];
export function normalizeStripe(i: Partial<Stripe>): Stripe {
  return {
    color: Math.round(clamp(num(i.color, 0), 0, 0xffffff)),
    startFrom: clamp(num(i.startFrom, 0), 0, 1),
    width: clamp(num(i.width, 1), 0.5, 64),
    opacity: clamp(num(i.opacity, 1), 0, 1),
  };
}
export function normalizeStripes(i: Partial<Stripe>[] | undefined, fallback: Stripe[]): Stripe[] {
  if (!i || i.length === 0) return fallback.map((s) => ({ ...s }));
  return i.map(normalizeStripe);
}

const WAVE_POSITIONS: WavePosition[] = [
  "center",
  "left top",
  "center top",
  "right top",
  "left center",
  "right center",
  "left bottom",
  "center bottom",
  "right bottom",
];
export const REVEAL_TYPES: readonly RevealType[] = [
  "wave",
  "assembly",
  "turbulence",
  "glitch",
  "vortex",
  "blackhole",
  "whirlpool",
  "water",
  "custom",
];
export const DEFAULT_REVEAL: RevealConfig = {
  enabled: false,
  type: "assembly",
  wave: { position: "center", durationMs: 1200, softness: 0.22, waviness: 0.11 },
  assembly: {
    sliceSizePx: 29,
    speedMinMs: 300,
    speedMaxMs: 1600,
    staggerMs: 6550,
    scatterPx: 90,
    angleJitterDeg: 35,
    blurPx: 17.5,
    blurStart: 0.45,
  },
  turbulence: { speedMinMs: 400, speedMaxMs: 2600, staggerMs: 1400, intensity: 1, detail: 0.5, glow: 0.6 },
  glitch: { speedMinMs: 200, speedMaxMs: 1400, staggerMs: 1200, intensity: 1, detail: 0.5, glow: 0.8 },
  vortex: {
    speedMinMs: 300,
    speedMaxMs: 1400,
    staggerMs: 2600,
    intensity: 1,
    detail: 0.5,
    glow: 0.7,
    swirl: 1,
  },
  blackhole: {
    speedMinMs: 260,
    speedMaxMs: 1050,
    staggerMs: 3600,
    intensity: 1,
    detail: 0.5,
    glow: 0.7,
    swirl: 1.2,
    formMs: 1150,
    collapseMs: 420,
    arms: 3,
    lensing: 1,
    horizon: 0.12,
  },
  whirlpool: {
    durationMs: 5600,
    turns: 4,
    tightness: 0.22,
    streak: 0.6,
    glow: 0.4,
  },
  water: {
    durationMs: 950,
    settleMs: 520,
    rows: 5,
    intensity: 1.7,
    wobble: 0.7,
    refraction: 1.3,
    softness: 0.35,
  },
};

/** @deprecated legacy-config shim — R5/R6 nested assembly.style + assembly.{scatter,turbulence,glitch,hadouken} */
type LegacyAssemblyBlock = Partial<RevealConfig["assembly"]> & {
  style?: unknown;
  scatter?: Partial<RevealConfig["assembly"]>;
  turbulence?: Partial<WarpStyleConfig>;
  glitch?: Partial<WarpStyleConfig>;
  vortex?: Partial<RevealConfig["vortex"]>;
  hadouken?: Partial<RevealConfig["vortex"]>;
};

type PartialReveal = {
  enabled?: unknown;
  type?: unknown;
  wave?: Partial<RevealConfig["wave"]>;
  assembly?: LegacyAssemblyBlock;
  turbulence?: Partial<WarpStyleConfig>;
  glitch?: Partial<WarpStyleConfig>;
  vortex?: Partial<RevealConfig["vortex"]>;
  hadouken?: Partial<RevealConfig["vortex"]>;
  blackhole?: Partial<BlackholeRevealConfig>;
  whirlpool?: Partial<WhirlpoolRevealConfig>;
  water?: Partial<WaterRevealConfig>;
};

function normalizeAssemblyBlock(a: LegacyAssemblyBlock): RevealConfig["assembly"] {
  const s = a.scatter ?? {};
  const d = DEFAULT_REVEAL.assembly;
  const speedMinMs = clamp(Math.round(num(s.speedMinMs ?? a.speedMinMs, d.speedMinMs)), 100, 30000);
  const speedMaxMs = Math.max(
    speedMinMs,
    clamp(Math.round(num(s.speedMaxMs ?? a.speedMaxMs, d.speedMaxMs)), 100, 30000),
  );
  return {
    sliceSizePx: clamp(Math.round(num(s.sliceSizePx ?? a.sliceSizePx, d.sliceSizePx)), 8, 200),
    speedMinMs,
    speedMaxMs,
    staggerMs: clamp(Math.round(num(s.staggerMs ?? a.staggerMs, d.staggerMs)), 0, 30000),
    scatterPx: clamp(Math.round(num(s.scatterPx ?? a.scatterPx, d.scatterPx)), 0, 300),
    angleJitterDeg: clamp(num(s.angleJitterDeg ?? a.angleJitterDeg, d.angleJitterDeg), 0, 90),
    blurPx: clamp(num(s.blurPx ?? a.blurPx, d.blurPx ?? 17.5), 0, 50),
    blurStart: clamp(num(s.blurStart ?? a.blurStart, d.blurStart ?? 0.45), 0, 0.95),
  };
}

function normalizeWarpStyleBlock(i: Partial<WarpStyleConfig> = {}, d: WarpStyleConfig): WarpStyleConfig {
  const speedMinMs = clamp(Math.round(num(i.speedMinMs, d.speedMinMs)), 50, 30000);
  const speedMaxMs = Math.max(speedMinMs, clamp(Math.round(num(i.speedMaxMs, d.speedMaxMs)), 50, 30000));
  return {
    speedMinMs,
    speedMaxMs,
    staggerMs: clamp(Math.round(num(i.staggerMs, d.staggerMs)), 0, 30000),
    intensity: clamp(num(i.intensity, d.intensity), 0, 2),
    detail: clamp(num(i.detail, d.detail), 0, 1),
    glow: clamp(num(i.glow, d.glow), 0, 1),
  };
}

function normalizeVortexBlock(i: Partial<VortexRevealConfig> = {}, d: VortexRevealConfig): VortexRevealConfig {
  return {
    ...normalizeWarpStyleBlock(i, d),
    swirl: clamp(num(i.swirl, d.swirl), 0, 3),
  };
}

function normalizeBlackholeBlock(
  i: Partial<BlackholeRevealConfig> = {},
  d: BlackholeRevealConfig,
): BlackholeRevealConfig {
  return {
    ...normalizeWarpStyleBlock(i, d),
    swirl: clamp(num(i.swirl, d.swirl), 0, 3),
    formMs: clamp(Math.round(num(i.formMs, d.formMs)), 0, 10000),
    collapseMs: clamp(Math.round(num(i.collapseMs, d.collapseMs)), 0, 10000),
    arms: clamp(Math.round(num(i.arms, d.arms)), 1, 8),
    lensing: clamp(num(i.lensing, d.lensing), 0, 2),
    horizon: clamp(num(i.horizon, d.horizon), 0.02, 0.3),
  };
}

function normalizeWhirlpoolBlock(
  i: Partial<WhirlpoolRevealConfig> = {},
  d: WhirlpoolRevealConfig,
): WhirlpoolRevealConfig {
  return {
    durationMs: clamp(Math.round(num(i.durationMs, d.durationMs)), 100, 30000),
    turns: clamp(num(i.turns, d.turns), 0, 6),
    tightness: clamp(num(i.tightness, d.tightness), 0.05, 0.5),
    streak: clamp(num(i.streak, d.streak), 0, 1),
    glow: clamp(num(i.glow, d.glow), 0, 1),
  };
}

function normalizeWaterBlock(i: Partial<WaterRevealConfig> = {}, d: WaterRevealConfig): WaterRevealConfig {
  return {
    durationMs: clamp(Math.round(num(i.durationMs, d.durationMs)), 1, 60000),
    settleMs: clamp(Math.round(num(i.settleMs, d.settleMs)), 0, 20000),
    rows: clamp(Math.round(num(i.rows, d.rows)), 1, 24),
    intensity: clamp(num(i.intensity, d.intensity), 0, 3),
    wobble: clamp(num(i.wobble, d.wobble), 0, 1),
    refraction: clamp(num(i.refraction, d.refraction), 0, 4),
    softness: clamp(num(i.softness, d.softness), 0, 1),
  };
}

export function normalizeReveal(i: PartialReveal = {}): RevealConfig {
  const w = i.wave ?? {};
  const a = i.assembly ?? {};
  const position = WAVE_POSITIONS.includes(w.position as WavePosition)
    ? (w.position as WavePosition)
    : DEFAULT_REVEAL.wave.position;

  let type: unknown = i.type;
  const legacyStyle = a.style;
  if (
    type === "assembly" &&
    (legacyStyle === "turbulence" || legacyStyle === "glitch" || legacyStyle === "hadouken" || legacyStyle === "vortex")
  ) {
    type = legacyStyle === "hadouken" ? "vortex" : legacyStyle;
  }
  if (type === "hadouken") type = "vortex";
  const resolvedType = REVEAL_TYPES.includes(type as RevealType) ? (type as RevealType) : DEFAULT_REVEAL.type;

  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_REVEAL.enabled,
    type: resolvedType,
    wave: {
      position,
      durationMs: clamp(Math.round(num(w.durationMs, DEFAULT_REVEAL.wave.durationMs)), 100, 30000),
      softness: clamp(num(w.softness, DEFAULT_REVEAL.wave.softness), 0, 1),
      waviness: clamp(num(w.waviness, DEFAULT_REVEAL.wave.waviness), 0, 1),
    },
    assembly: normalizeAssemblyBlock(a),
    turbulence: normalizeWarpStyleBlock(i.turbulence ?? a.turbulence, DEFAULT_REVEAL.turbulence),
    glitch: normalizeWarpStyleBlock(i.glitch ?? a.glitch, DEFAULT_REVEAL.glitch),
    vortex: normalizeVortexBlock(i.vortex ?? i.hadouken ?? a.vortex ?? a.hadouken, DEFAULT_REVEAL.vortex),
    blackhole: normalizeBlackholeBlock(i.blackhole, DEFAULT_REVEAL.blackhole),
    whirlpool: normalizeWhirlpoolBlock(i.whirlpool, DEFAULT_REVEAL.whirlpool),
    water: normalizeWaterBlock(i.water, DEFAULT_REVEAL.water),
  };
}

export const MOTION_DIRECTIONS: MotionDirection[] = ["leftToRight", "rightToLeft", "topToBottom", "bottomToTop"];
export function motionDirectionIndex(d: MotionDirection): number {
  return MOTION_DIRECTIONS.indexOf(d);
}
export const DEFAULT_SPARKLE: SparkleConfig = {
  gaps: { enabled: false, coverage: 0.22, speed: 1 },
  width: { enabled: false, coverage: 0.3, swingPx: 1.25, swingPeriodMin: 0.21, swingPeriodMax: 0.55 },
  stripe: {
    enabled: false,
    coverage: 0.35,
    maxBrightness: 0.65,
    speed: 1,
    thickestCount: 3,
    hueDriftDeg: 0,
    saturationBoost: 0,
  },
  motion: { enabled: false, amplitudePx: 4, staggerPx: 24, maxOffsetPx: 12, speed: 1, direction: "leftToRight" },
};

type PartialSparkle = {
  gaps?: Partial<SparkleConfig["gaps"]>;
  width?: Partial<SparkleConfig["width"]>;
  stripe?: Partial<SparkleConfig["stripe"]>;
  motion?: Partial<SparkleConfig["motion"]>;
};

export function normalizeSparkle(i: PartialSparkle = {}): SparkleConfig {
  const g = i.gaps ?? {};
  const w = i.width ?? {};
  const st = i.stripe ?? {};
  const m = i.motion ?? {};
  return {
    gaps: {
      enabled: g.enabled !== undefined ? !!g.enabled : DEFAULT_SPARKLE.gaps.enabled,
      coverage: clamp(num(g.coverage, DEFAULT_SPARKLE.gaps.coverage), 0, 1),
      speed: clamp(num(g.speed, DEFAULT_SPARKLE.gaps.speed), 0.05, 100),
    },
    width: {
      enabled: w.enabled !== undefined ? !!w.enabled : DEFAULT_SPARKLE.width.enabled,
      coverage: clamp(num(w.coverage, DEFAULT_SPARKLE.width.coverage), 0, 1),
      swingPx: clamp(num(w.swingPx, DEFAULT_SPARKLE.width.swingPx), 0, 40),
      swingPeriodMin: clamp(num(w.swingPeriodMin, DEFAULT_SPARKLE.width.swingPeriodMin), 0.02, 5),
      swingPeriodMax: clamp(num(w.swingPeriodMax, DEFAULT_SPARKLE.width.swingPeriodMax), 0.02, 5),
    },
    stripe: {
      enabled: st.enabled !== undefined ? !!st.enabled : DEFAULT_SPARKLE.stripe.enabled,
      coverage: clamp(num(st.coverage, DEFAULT_SPARKLE.stripe.coverage), 0, 1),
      maxBrightness: clamp(num(st.maxBrightness, DEFAULT_SPARKLE.stripe.maxBrightness), 0, 1),
      speed: clamp(num(st.speed, DEFAULT_SPARKLE.stripe.speed), 0.05, 100),
      thickestCount: clamp(Math.round(num(st.thickestCount, DEFAULT_SPARKLE.stripe.thickestCount)), 1, 64),
      hueDriftDeg: clamp(num(st.hueDriftDeg, DEFAULT_SPARKLE.stripe.hueDriftDeg), -180, 180),
      saturationBoost: clamp(num(st.saturationBoost, DEFAULT_SPARKLE.stripe.saturationBoost), 0, 1),
    },
    motion: {
      enabled: m.enabled !== undefined ? !!m.enabled : DEFAULT_SPARKLE.motion.enabled,
      amplitudePx: clamp(num(m.amplitudePx, DEFAULT_SPARKLE.motion.amplitudePx), 0, 64),
      staggerPx: clamp(num(m.staggerPx, DEFAULT_SPARKLE.motion.staggerPx), 1, 512),
      maxOffsetPx: clamp(num(m.maxOffsetPx, DEFAULT_SPARKLE.motion.maxOffsetPx), 0, 128),
      speed: Math.max(0.05, num(m.speed, DEFAULT_SPARKLE.motion.speed)),
      direction: MOTION_DIRECTIONS.includes(m.direction as MotionDirection)
        ? (m.direction as MotionDirection)
        : DEFAULT_SPARKLE.motion.direction,
    },
  };
}

export const DEFAULT_STRIPE_DOTS: StripeDotsConfig = {
  enabled: false,
  density: 0.5,
  randomVisibility: 1,
  sizePx: 1.5,
  brightness: 0.35,
  hueDriftDeg: 0,
  saturationBoost: 0,
};

export function normalizeStripeDots(i: Partial<StripeDotsConfig> = {}): StripeDotsConfig {
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_STRIPE_DOTS.enabled,
    density: clamp(num(i.density, DEFAULT_STRIPE_DOTS.density), 0, 1),
    randomVisibility: clamp(num(i.randomVisibility, DEFAULT_STRIPE_DOTS.randomVisibility), 0, 1),
    sizePx: clamp(num(i.sizePx, DEFAULT_STRIPE_DOTS.sizePx), 1, 2),
    brightness: clamp(num(i.brightness, DEFAULT_STRIPE_DOTS.brightness), 0, 1),
    hueDriftDeg: clamp(num(i.hueDriftDeg, DEFAULT_STRIPE_DOTS.hueDriftDeg), -180, 180),
    saturationBoost: clamp(num(i.saturationBoost, DEFAULT_STRIPE_DOTS.saturationBoost), 0, 1),
  };
}

export const DEFAULT_STRIPE_BORDER: StripeBorderConfig = {
  enabled: false,
  minWidthPx: 2,
  density: 1,
};

export function normalizeStripeBorder(i: Partial<StripeBorderConfig> = {}): StripeBorderConfig {
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_STRIPE_BORDER.enabled,
    minWidthPx: clamp(num(i.minWidthPx, DEFAULT_STRIPE_BORDER.minWidthPx), 2, 64),
    density: clamp(num(i.density, DEFAULT_STRIPE_BORDER.density), 0, 1),
  };
}

export const DEFAULT_GRID_LINES: GridLinesConfig = {
  enabled: false,
  brightness: 0.35,
  density: 1,
};

export function normalizeGridLines(i: Partial<GridLinesConfig> = {}): GridLinesConfig {
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_GRID_LINES.enabled,
    brightness: clamp(num(i.brightness, DEFAULT_GRID_LINES.brightness), 0, 1),
    density: clamp(num(i.density, DEFAULT_GRID_LINES.density), 0, 1),
  };
}

export const DEFAULT_FRAMES: FramesConfig = {
  enabled: false,
  luminanceThreshold: 0.7,
  highlightedStripeCount: 3,
  groupDistanceCells: 1,
  color: 0xffffff,
  fontSizePx: 10,
  coordinateColor: 0xffffff,
};

export function normalizeFrames(i: Partial<FramesConfig> = {}): FramesConfig {
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_FRAMES.enabled,
    luminanceThreshold: clamp(num(i.luminanceThreshold, DEFAULT_FRAMES.luminanceThreshold), 0, 1),
    highlightedStripeCount: Math.round(
      clamp(num(i.highlightedStripeCount, DEFAULT_FRAMES.highlightedStripeCount), 1, 16),
    ),
    groupDistanceCells: Math.round(clamp(num(i.groupDistanceCells, DEFAULT_FRAMES.groupDistanceCells), 0, 8)),
    color: Math.round(clamp(num(i.color, DEFAULT_FRAMES.color), 0, 0xffffff)),
    fontSizePx: Math.round(clamp(num(i.fontSizePx, DEFAULT_FRAMES.fontSizePx), 6, 48)),
    coordinateColor: Math.round(clamp(num(i.coordinateColor, DEFAULT_FRAMES.coordinateColor), 0, 0xffffff)),
  };
}

export const DEFAULT_VORTEX_SINGULAR: VortexSingularConfig = {
  segCount: 22,
  segSpacingPx: 10,
  turnRate: 0.9,
  turnVariation: 0.8,
  visibleMinMs: 7000,
  visibleMaxMs: 13000,
  hiddenMinMs: 800,
  hiddenMaxMs: 2600,
  lifeMinMs: 12000,
  lifeMaxMs: 24000,
  edgeMarginRatio: 0.12,
};

export const DEFAULT_FLAMES: FlamesConfig = {
  enabled: false,
  direction: "up",
  minWidthRatio: 0.0223,
  maxWidthRatio: 0.0453,
  minHeightRatio: 0.0245,
  maxHeightRatio: 0.08,
  baseSpeedPxPerSec: 40,
  speedVariation: 1,
  spawnIntervalMs: 50,
  spawnJitterMs: 80,
  maxActive: 48,
  edgeSharpness: 1,
  opacityMin: 0.3,
  opacityMax: 1,
  vortexSingular: { ...DEFAULT_VORTEX_SINGULAR },
};

type PartialFlames = Partial<Omit<FlamesConfig, "vortexSingular">> & {
  vortexSingular?: Partial<VortexSingularConfig>;
};

const FLAMES_DIRECTIONS: readonly FlamesDirection[] = [
  "up",
  "down",
  "left",
  "right",
  "upDown",
  "leftRight",
  "vortexSingular",
];

function normalizeFlamesDirection(value: unknown): FlamesDirection {
  return FLAMES_DIRECTIONS.includes(value as FlamesDirection) ? (value as FlamesDirection) : "up";
}

function normalizeVortexSingular(i: Partial<VortexSingularConfig> = {}): VortexSingularConfig {
  const lifeMinMs = clamp(Math.round(num(i.lifeMinMs, DEFAULT_VORTEX_SINGULAR.lifeMinMs)), 500, 60000);
  const visibleMinMs = clamp(Math.round(num(i.visibleMinMs, DEFAULT_VORTEX_SINGULAR.visibleMinMs)), 500, 60000);
  const hiddenMinMs = clamp(Math.round(num(i.hiddenMinMs, DEFAULT_VORTEX_SINGULAR.hiddenMinMs)), 0, 30000);
  return {
    segCount: clamp(Math.round(num(i.segCount, DEFAULT_VORTEX_SINGULAR.segCount)), 2, 80),
    segSpacingPx: clamp(num(i.segSpacingPx, DEFAULT_VORTEX_SINGULAR.segSpacingPx), 2, 60),
    turnRate: clamp(num(i.turnRate, DEFAULT_VORTEX_SINGULAR.turnRate), 0.05, 6),
    turnVariation: clamp(num(i.turnVariation, DEFAULT_VORTEX_SINGULAR.turnVariation), 0, 1),
    visibleMinMs,
    visibleMaxMs: clamp(Math.round(num(i.visibleMaxMs, DEFAULT_VORTEX_SINGULAR.visibleMaxMs)), visibleMinMs, 120000),
    hiddenMinMs,
    hiddenMaxMs: clamp(Math.round(num(i.hiddenMaxMs, DEFAULT_VORTEX_SINGULAR.hiddenMaxMs)), hiddenMinMs, 60000),
    lifeMinMs,
    lifeMaxMs: clamp(Math.round(num(i.lifeMaxMs, DEFAULT_VORTEX_SINGULAR.lifeMaxMs)), lifeMinMs, 120000),
    edgeMarginRatio: clamp(num(i.edgeMarginRatio, DEFAULT_VORTEX_SINGULAR.edgeMarginRatio), 0, 0.4),
  };
}

export function normalizeFlames(i: PartialFlames = {}): FlamesConfig {
  const minWidthRatio = clamp(num(i.minWidthRatio, DEFAULT_FLAMES.minWidthRatio), 0.001, 0.5);
  const maxWidthRatio = clamp(num(i.maxWidthRatio, DEFAULT_FLAMES.maxWidthRatio), minWidthRatio, 0.5);
  const minHeightRatio = clamp(num(i.minHeightRatio, DEFAULT_FLAMES.minHeightRatio), 0.001, 0.5);
  const maxHeightRatio = clamp(num(i.maxHeightRatio, DEFAULT_FLAMES.maxHeightRatio), minHeightRatio, 0.5);
  const opacityMin = clamp(num(i.opacityMin, DEFAULT_FLAMES.opacityMin), 0, 1);
  const opacityMax = clamp(num(i.opacityMax, DEFAULT_FLAMES.opacityMax), opacityMin, 1);
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_FLAMES.enabled,
    direction: normalizeFlamesDirection(i.direction ?? DEFAULT_FLAMES.direction),
    minWidthRatio,
    maxWidthRatio,
    minHeightRatio,
    maxHeightRatio,
    baseSpeedPxPerSec: clamp(num(i.baseSpeedPxPerSec, DEFAULT_FLAMES.baseSpeedPxPerSec), 1, 500),
    speedVariation: clamp(num(i.speedVariation, DEFAULT_FLAMES.speedVariation), 0, 1),
    spawnIntervalMs: clamp(Math.round(num(i.spawnIntervalMs, DEFAULT_FLAMES.spawnIntervalMs)), 20, 5000),
    spawnJitterMs: clamp(Math.round(num(i.spawnJitterMs, DEFAULT_FLAMES.spawnJitterMs)), 0, 2000),
    maxActive: clamp(Math.round(num(i.maxActive, DEFAULT_FLAMES.maxActive)), 1, 200),
    edgeSharpness: clamp(num(i.edgeSharpness, DEFAULT_FLAMES.edgeSharpness), 0, 1),
    opacityMin,
    opacityMax,
    vortexSingular: normalizeVortexSingular(i.vortexSingular),
  };
}

export const DEFAULT_EDGE_MASK: EdgeMaskConfig = {
  enabled: false,
  start: 0,
  end: 0.1,
  power: 1,
  sides: { top: true, right: true, bottom: true, left: true },
};

type PartialEdgeMask = Partial<Omit<EdgeMaskConfig, "sides">> & { sides?: Partial<EdgeMaskSides> };

function normalizeEdgeMaskSides(i: Partial<EdgeMaskSides> = {}): EdgeMaskSides {
  return {
    top: i.top !== undefined ? !!i.top : DEFAULT_EDGE_MASK.sides.top,
    right: i.right !== undefined ? !!i.right : DEFAULT_EDGE_MASK.sides.right,
    bottom: i.bottom !== undefined ? !!i.bottom : DEFAULT_EDGE_MASK.sides.bottom,
    left: i.left !== undefined ? !!i.left : DEFAULT_EDGE_MASK.sides.left,
  };
}

export function normalizeEdgeMask(i: PartialEdgeMask = {}): EdgeMaskConfig {
  const start = clamp(num(i.start, DEFAULT_EDGE_MASK.start), 0, 0.5);
  const end = clamp(num(i.end, DEFAULT_EDGE_MASK.end), start + 0.001, 0.5);
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_EDGE_MASK.enabled,
    start,
    end,
    power: clamp(num(i.power, DEFAULT_EDGE_MASK.power), 0.1, 4),
    sides: normalizeEdgeMaskSides(i.sides),
  };
}

export const DEFAULT_CONSTELLATION_TRAIL: ConstellationTrailConfig = {
  radiusScale: 0.31,
  starDensity: 1,
  starSizePx: 2.2,
  starSizeRandomness: 0.77,
  starGrowScale: 1.35,
  starPushPx: 1.9,
  twinkleAmount: 0.18,
  twinkleSpeed: 1,
  linkThicknessPx: 2.9,
  linkBrightness: 1,
  linkGrooveDepth: 1,
  linkShearPx: 13.5,
  linkMaxDistScale: 0.2184,
  linkFormMs: 210,
  linkHoldMs: 0,
  linkDissolveMs: 540,
  maxLinks: 48,
  maxStars: 64,
  pulseEnabled: true,
  pulseDurationMs: 700,
  pulseCoreLenPx: 3.4,
  pulseTailLenPx: 27,
  pulseBrightness: 1,
  pulseRelayHops: 2,
  pulseCooldownMs: 900,
  flareMs: 460,
  flareScale: 0.85,
  polygonFlashEnabled: true,
  polygonFlashStrength: 1,
};

type PartialConstellationTrail = Partial<ConstellationTrailConfig>;

export function normalizeConstellationTrail(i: PartialConstellationTrail = {}): ConstellationTrailConfig {
  const d = DEFAULT_CONSTELLATION_TRAIL;
  return {
    radiusScale: clamp(num(i.radiusScale, d.radiusScale), 0.02, 2),
    starDensity: clamp(num(i.starDensity, d.starDensity), 0.05, 4),
    starSizePx: clamp(num(i.starSizePx, d.starSizePx), 0.2, 20),
    starSizeRandomness: clamp(num(i.starSizeRandomness, d.starSizeRandomness), 0, 1),
    starGrowScale: clamp(num(i.starGrowScale, d.starGrowScale), 0, 6),
    starPushPx: clamp(num(i.starPushPx, d.starPushPx), 0, 40),
    twinkleAmount: clamp(num(i.twinkleAmount, d.twinkleAmount), 0, 1),
    twinkleSpeed: clamp(num(i.twinkleSpeed, d.twinkleSpeed), 0, 10),
    linkThicknessPx: clamp(num(i.linkThicknessPx, d.linkThicknessPx), 0.2, 20),
    linkBrightness: clamp(num(i.linkBrightness, d.linkBrightness), 0, 4),
    linkGrooveDepth: clamp(num(i.linkGrooveDepth, d.linkGrooveDepth), 0, 4),
    linkShearPx: clamp(num(i.linkShearPx, d.linkShearPx), 0, 80),
    linkMaxDistScale: clamp(num(i.linkMaxDistScale, d.linkMaxDistScale), 0.02, 1),
    linkFormMs: clamp(num(i.linkFormMs, d.linkFormMs), 10, 5000),
    linkHoldMs: clamp(num(i.linkHoldMs, d.linkHoldMs), 0, 10_000),
    linkDissolveMs: clamp(num(i.linkDissolveMs, d.linkDissolveMs), 10, 10_000),
    maxLinks: clampInt(num(i.maxLinks, d.maxLinks), 4, 80),
    maxStars: clampInt(num(i.maxStars, d.maxStars), 4, 160),
    pulseEnabled: i.pulseEnabled !== undefined ? !!i.pulseEnabled : d.pulseEnabled,
    pulseDurationMs: clamp(num(i.pulseDurationMs, d.pulseDurationMs), 60, 10_000),
    pulseCoreLenPx: clamp(num(i.pulseCoreLenPx, d.pulseCoreLenPx), 0.5, 60),
    pulseTailLenPx: clamp(num(i.pulseTailLenPx, d.pulseTailLenPx), 0.5, 240),
    pulseBrightness: clamp(num(i.pulseBrightness, d.pulseBrightness), 0, 4),
    pulseRelayHops: clampInt(num(i.pulseRelayHops, d.pulseRelayHops), 0, 6),
    pulseCooldownMs: clamp(num(i.pulseCooldownMs, d.pulseCooldownMs), 0, 20_000),
    flareMs: clamp(num(i.flareMs, d.flareMs), 30, 5000),
    flareScale: clamp(num(i.flareScale, d.flareScale), 0, 6),
    polygonFlashEnabled: i.polygonFlashEnabled !== undefined ? !!i.polygonFlashEnabled : d.polygonFlashEnabled,
    polygonFlashStrength: clamp(num(i.polygonFlashStrength, d.polygonFlashStrength), 0, 4),
  };
}

export const DEFAULT_COMET_TRAIL: CometTrailConfig = {
  nodeCount: 13,
  headStiffness: 5200,
  headDamping: 104,
  chainStiffness: 4200,
  chainDamping: 80,
  maxLinkPx: 22,
  headRadiusPx: 10.6,
  tailRadiusPx: 3.2,
  stretchThinning: 0.62,
  smoothUnionPx: 5.4,
  bodyBrightness: 1,
  auraStrength: 1,
  bodyPushPx: 12,
  presenceRiseRate: 15,
  presenceFallRate: 2.6,
  embersEnabled: true,
  emberRatePerSec: 92,
  emberMaxCount: 210,
  emberSizePx: 2.9,
  emberSpeedMinPxPerSec: 26,
  emberSpeedMaxPxPerSec: 56,
  emberSpreadRad: 0.85,
  emberLifetimeMinMs: 560,
  emberLifetimeMaxMs: 1400,
  emberBrightness: 1,
  emberFadeInFraction: 0.12,
  seed: 10_368_889,
};

type PartialCometTrail = Partial<CometTrailConfig>;

export function normalizeCometTrail(i: PartialCometTrail = {}): CometTrailConfig {
  const d = DEFAULT_COMET_TRAIL;
  const emberSpeedMinPxPerSec = clamp(num(i.emberSpeedMinPxPerSec, d.emberSpeedMinPxPerSec), 0, 2000);
  const emberSpeedMaxPxPerSec = Math.max(
    emberSpeedMinPxPerSec,
    clamp(num(i.emberSpeedMaxPxPerSec, d.emberSpeedMaxPxPerSec), 0, 2000),
  );
  const emberLifetimeMinMs = clamp(num(i.emberLifetimeMinMs, d.emberLifetimeMinMs), 60, 20_000);
  const emberLifetimeMaxMs = Math.max(
    emberLifetimeMinMs,
    clamp(num(i.emberLifetimeMaxMs, d.emberLifetimeMaxMs), 60, 20_000),
  );
  return {
    nodeCount: clampInt(num(i.nodeCount, d.nodeCount), 2, 48),
    headStiffness: clamp(num(i.headStiffness, d.headStiffness), 100, 40_000),
    headDamping: clamp(num(i.headDamping, d.headDamping), 1, 600),
    chainStiffness: clamp(num(i.chainStiffness, d.chainStiffness), 100, 40_000),
    chainDamping: clamp(num(i.chainDamping, d.chainDamping), 1, 600),
    maxLinkPx: clamp(num(i.maxLinkPx, d.maxLinkPx), 2, 200),
    headRadiusPx: clamp(num(i.headRadiusPx, d.headRadiusPx), 0.5, 60),
    tailRadiusPx: clamp(num(i.tailRadiusPx, d.tailRadiusPx), 0, 40),
    stretchThinning: clamp(num(i.stretchThinning, d.stretchThinning), 0, 1),
    smoothUnionPx: clamp(num(i.smoothUnionPx, d.smoothUnionPx), 0.1, 40),
    bodyBrightness: clamp(num(i.bodyBrightness, d.bodyBrightness), 0, 2),
    auraStrength: clamp(num(i.auraStrength, d.auraStrength), 0, 3),
    bodyPushPx: clamp(num(i.bodyPushPx, d.bodyPushPx), 0, 60),
    presenceRiseRate: clamp(num(i.presenceRiseRate, d.presenceRiseRate), 0.5, 60),
    presenceFallRate: clamp(num(i.presenceFallRate, d.presenceFallRate), 0.2, 60),
    embersEnabled: i.embersEnabled !== undefined ? !!i.embersEnabled : d.embersEnabled,
    emberRatePerSec: clamp(num(i.emberRatePerSec, d.emberRatePerSec), 0, 400),
    emberMaxCount: clampInt(num(i.emberMaxCount, d.emberMaxCount), 1, 512),
    emberSizePx: clamp(num(i.emberSizePx, d.emberSizePx), 0.2, 40),
    emberSpeedMinPxPerSec,
    emberSpeedMaxPxPerSec,
    emberSpreadRad: clamp(num(i.emberSpreadRad, d.emberSpreadRad), 0, Math.PI),
    emberLifetimeMinMs,
    emberLifetimeMaxMs,
    emberBrightness: clamp(num(i.emberBrightness, d.emberBrightness), 0, 4),
    emberFadeInFraction: clamp(num(i.emberFadeInFraction, d.emberFadeInFraction), 0, 0.9),
    seed: clampInt(num(i.seed, d.seed), 0, 100_000_000),
  };
}

export const DEFAULT_CURSOR_TRAIL: CursorTrailConfig = {
  enabled: false,
  type: "default",
  particleRadius: 40,
  particleAlpha: 0.07,
  particleLifeMs: 960,
  particleLifeJitterMs: 100,
  emitterVelocitySmoothing: 0.7,
  particleVelocityScale: 0.01,
  particleTangentVelocity: 1.65,
  particleDamping: 0.96,
  particleSpacingPx: 3,
  maxEmitPerTick: 10,
  spreadMinPx: 1.5,
  spreadMaxPx: 21,
  spinStrength: 0.04,
  densityRadiusMinScale: 0.2,
  densityRadiusLifeScale: 1,
  pushRadiusScale: 0.9,
  pushStrengthPx: 48,
  pushLagPx: 0,
  pushWobblePx: 8,
  pushLeadBlackAlpha: 0,
  constellation: { ...DEFAULT_CONSTELLATION_TRAIL },
  comet: { ...DEFAULT_COMET_TRAIL },
};

type PartialCursorTrail = Partial<CursorTrailConfig>;

function clampInt(v: number, min: number, max: number): number {
  return Math.round(clamp(v, min, max));
}

export function normalizeCursorTrail(i: PartialCursorTrail = {}): CursorTrailConfig {
  const spreadMinPx = clamp(num(i.spreadMinPx, DEFAULT_CURSOR_TRAIL.spreadMinPx), 0, 80);
  const spreadMaxPx = Math.max(spreadMinPx, clamp(num(i.spreadMaxPx, DEFAULT_CURSOR_TRAIL.spreadMaxPx), 0, 120));
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_CURSOR_TRAIL.enabled,
    type: i.type === "wave" || i.type === "constellation" || i.type === "comet" ? i.type : "default",
    particleRadius: clamp(num(i.particleRadius, DEFAULT_CURSOR_TRAIL.particleRadius), 0.5, 80),
    particleAlpha: clamp(num(i.particleAlpha, DEFAULT_CURSOR_TRAIL.particleAlpha), 0, 1),
    particleLifeMs: clamp(num(i.particleLifeMs, DEFAULT_CURSOR_TRAIL.particleLifeMs), 50, 10_000),
    particleLifeJitterMs: clamp(num(i.particleLifeJitterMs, DEFAULT_CURSOR_TRAIL.particleLifeJitterMs), 0, 10_000),
    emitterVelocitySmoothing: clamp(
      num(i.emitterVelocitySmoothing, DEFAULT_CURSOR_TRAIL.emitterVelocitySmoothing),
      0,
      0.98,
    ),
    particleVelocityScale: clamp(num(i.particleVelocityScale, DEFAULT_CURSOR_TRAIL.particleVelocityScale), 0, 2),
    particleTangentVelocity: clamp(num(i.particleTangentVelocity, DEFAULT_CURSOR_TRAIL.particleTangentVelocity), 0, 20),
    particleDamping: clamp(num(i.particleDamping, DEFAULT_CURSOR_TRAIL.particleDamping), 0, 1),
    particleSpacingPx: clamp(num(i.particleSpacingPx, DEFAULT_CURSOR_TRAIL.particleSpacingPx), 0.5, 80),
    maxEmitPerTick: clampInt(num(i.maxEmitPerTick, DEFAULT_CURSOR_TRAIL.maxEmitPerTick), 1, 200),
    spreadMinPx,
    spreadMaxPx,
    spinStrength: clamp(num(i.spinStrength, DEFAULT_CURSOR_TRAIL.spinStrength), 0, 0.2),
    densityRadiusMinScale: clamp(num(i.densityRadiusMinScale, DEFAULT_CURSOR_TRAIL.densityRadiusMinScale), 0, 3),
    densityRadiusLifeScale: clamp(num(i.densityRadiusLifeScale, DEFAULT_CURSOR_TRAIL.densityRadiusLifeScale), 0, 3),
    pushRadiusScale: clamp(num(i.pushRadiusScale, DEFAULT_CURSOR_TRAIL.pushRadiusScale), 0, 8),
    pushStrengthPx: clamp(num(i.pushStrengthPx, DEFAULT_CURSOR_TRAIL.pushStrengthPx), 0, 120),
    pushLagPx: clamp(num(i.pushLagPx, DEFAULT_CURSOR_TRAIL.pushLagPx), 0, 80),
    pushWobblePx: clamp(num(i.pushWobblePx, DEFAULT_CURSOR_TRAIL.pushWobblePx), 0, 80),
    pushLeadBlackAlpha: clamp(num(i.pushLeadBlackAlpha, DEFAULT_CURSOR_TRAIL.pushLeadBlackAlpha), 0, 1),
    constellation: normalizeConstellationTrail(i.constellation),
    comet: normalizeCometTrail(i.comet),
  };
}

export const DEFAULT_DETONATION_CLICK: DetonationClickConfig = {
  maxConcurrent: 4,
  ringReachPx: 168,
  ringDurationMs: 600,
  ringThicknessPx: 24,
  ringRefractionPx: 20,
  flashRadiusPx: 24,
  flashDurationMs: 80,
  flashBrightness: 1,
  debrisCount: 24,
  debrisSpeedPxPerSec: 315,
  debrisSpeedVariation: 0.317,
  debrisDrag: 1.55,
  debrisGravityPxPerSec2: 360,
  debrisLifetimeMs: 1060,
  debrisLifetimeVariation: 0.302,
  debrisSizePx: 2.6,
  debrisBrightness: 1,
  craterRadiusPx: 118,
  craterDepth: 1,
  craterRelaxFastMs: 260,
  craterRelaxSlowMs: 1450,
  craterLifeMs: 3400,
  craterRimStrength: 1,
  seed: 1,
};

type PartialDetonationClick = Partial<DetonationClickConfig>;

export function normalizeDetonationClick(i: PartialDetonationClick = {}): DetonationClickConfig {
  const d = DEFAULT_DETONATION_CLICK;
  return {
    maxConcurrent: clampInt(num(i.maxConcurrent, d.maxConcurrent), 1, 16),
    ringReachPx: clamp(num(i.ringReachPx, d.ringReachPx), 8, 1200),
    ringDurationMs: clamp(num(i.ringDurationMs, d.ringDurationMs), 40, 8000),
    ringThicknessPx: clamp(num(i.ringThicknessPx, d.ringThicknessPx), 1, 200),
    ringRefractionPx: clamp(num(i.ringRefractionPx, d.ringRefractionPx), 0, 160),
    flashRadiusPx: clamp(num(i.flashRadiusPx, d.flashRadiusPx), 1, 400),
    flashDurationMs: clamp(num(i.flashDurationMs, d.flashDurationMs), 8, 2000),
    flashBrightness: clamp(num(i.flashBrightness, d.flashBrightness), 0, 4),
    debrisCount: clampInt(num(i.debrisCount, d.debrisCount), 0, 96),
    debrisSpeedPxPerSec: clamp(num(i.debrisSpeedPxPerSec, d.debrisSpeedPxPerSec), 10, 4000),
    debrisSpeedVariation: clamp(num(i.debrisSpeedVariation, d.debrisSpeedVariation), 0, 1),
    debrisDrag: clamp(num(i.debrisDrag, d.debrisDrag), 0.05, 12),
    debrisGravityPxPerSec2: clamp(num(i.debrisGravityPxPerSec2, d.debrisGravityPxPerSec2), 0, 4000),
    debrisLifetimeMs: clamp(num(i.debrisLifetimeMs, d.debrisLifetimeMs), 60, 10_000),
    debrisLifetimeVariation: clamp(num(i.debrisLifetimeVariation, d.debrisLifetimeVariation), 0, 1),
    debrisSizePx: clamp(num(i.debrisSizePx, d.debrisSizePx), 0.2, 40),
    debrisBrightness: clamp(num(i.debrisBrightness, d.debrisBrightness), 0, 4),
    craterRadiusPx: clamp(num(i.craterRadiusPx, d.craterRadiusPx), 4, 1200),
    craterDepth: clamp(num(i.craterDepth, d.craterDepth), 0, 4),
    craterRelaxFastMs: clamp(num(i.craterRelaxFastMs, d.craterRelaxFastMs), 20, 10_000),
    craterRelaxSlowMs: clamp(num(i.craterRelaxSlowMs, d.craterRelaxSlowMs), 20, 20_000),
    craterLifeMs: clamp(num(i.craterLifeMs, d.craterLifeMs), 100, 20_000),
    craterRimStrength: clamp(num(i.craterRimStrength, d.craterRimStrength), 0, 4),
    seed: Math.round(clamp(num(i.seed, d.seed), 0, 1_000_000)),
  };
}

export const DEFAULT_CLICK_WAVE: ClickWaveConfig = {
  enabled: false,
  type: "default",
  lifeMs: 630,
  startRadiusPx: 6,
  maxRadiusPx: 120,
  startStrokeWidthPx: 24,
  endStrokeWidthPx: 12,
  maxWaves: 12,
  pushStrengthPx: 38,
  pushBandScale: 3.2,
  stripeWhiteAlpha: 0.5,
  detonation: { ...DEFAULT_DETONATION_CLICK },
};

type PartialClickWave = Partial<ClickWaveConfig>;

export function normalizeClickWave(i: PartialClickWave = {}): ClickWaveConfig {
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_CLICK_WAVE.enabled,
    type: i.type === "detonation" ? i.type : "default",
    lifeMs: clamp(num(i.lifeMs, DEFAULT_CLICK_WAVE.lifeMs), 80, 10_000),
    startRadiusPx: clamp(num(i.startRadiusPx, DEFAULT_CLICK_WAVE.startRadiusPx), 1, 120),
    maxRadiusPx: clamp(num(i.maxRadiusPx, DEFAULT_CLICK_WAVE.maxRadiusPx), 4, 600),
    startStrokeWidthPx: clamp(num(i.startStrokeWidthPx, DEFAULT_CLICK_WAVE.startStrokeWidthPx), 0.5, 80),
    endStrokeWidthPx: clamp(num(i.endStrokeWidthPx, DEFAULT_CLICK_WAVE.endStrokeWidthPx), 0.25, 40),
    maxWaves: clampInt(num(i.maxWaves, DEFAULT_CLICK_WAVE.maxWaves), 1, 32),
    pushStrengthPx: clamp(num(i.pushStrengthPx, DEFAULT_CLICK_WAVE.pushStrengthPx), 0, 200),
    pushBandScale: clamp(num(i.pushBandScale, DEFAULT_CLICK_WAVE.pushBandScale), 1, 8),
    stripeWhiteAlpha: clamp(num(i.stripeWhiteAlpha, DEFAULT_CLICK_WAVE.stripeWhiteAlpha), 0, 1),
    detonation: normalizeDetonationClick(i.detonation),
  };
}

export const DEFAULT_LETTERS: LettersConfig = {
  enabled: false,
  mode: "random",
  colorMode: "white",
  color: 0xffffff,
  coverage: 0.1,
  positionX: 0.5,
  positionY: 0.5,
  areaWidth: 1,
  areaHeight: 1,
  text: "CF",
  textCopies: 1,
  fontFamily: "Geist Mono Medium",
  sizeScale: 0.9,
  shuffleSpeed: 1,
};

export const LETTER_FONT_FAMILIES: string[] = [
  "Geist Mono Medium",
  "monospace",
  "Arial, sans-serif",
  "Georgia, serif",
  '"Courier New", monospace',
  '"Times New Roman", serif',
  "Impact, fantasy",
];
const LETTER_FONT_FAMILY_SET = new Set(LETTER_FONT_FAMILIES);

type PartialLetters = Partial<LettersConfig>;

export function normalizeLetters(i: PartialLetters = {}): LettersConfig {
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_LETTERS.enabled,
    mode: i.mode === "text" ? "text" : "random",
    colorMode: i.colorMode === "colorful" ? "colorful" : "white",
    color: Math.round(clamp(num(i.color, DEFAULT_LETTERS.color), 0, 0xffffff)),
    coverage: clamp(num(i.coverage, DEFAULT_LETTERS.coverage), 0, 1),
    positionX: clamp(num(i.positionX, DEFAULT_LETTERS.positionX), 0, 1),
    positionY: clamp(num(i.positionY, DEFAULT_LETTERS.positionY), 0, 1),
    areaWidth: clamp(num(i.areaWidth, DEFAULT_LETTERS.areaWidth), 0.01, 1),
    areaHeight: clamp(num(i.areaHeight, DEFAULT_LETTERS.areaHeight), 0.01, 1),
    text: typeof i.text === "string" ? i.text.slice(0, 512) : DEFAULT_LETTERS.text,
    textCopies: clampInt(num(i.textCopies, DEFAULT_LETTERS.textCopies), 1, 100),
    fontFamily:
      typeof i.fontFamily === "string" && LETTER_FONT_FAMILY_SET.has(i.fontFamily)
        ? i.fontFamily
        : DEFAULT_LETTERS.fontFamily,
    sizeScale: clamp(num(i.sizeScale, DEFAULT_LETTERS.sizeScale), 0.1, 1),
    shuffleSpeed: clamp(num(i.shuffleSpeed, DEFAULT_LETTERS.shuffleSpeed), 0.05, 10),
  };
}

export const STRIPE_BLEND_MODES: StripeBlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "difference",
  "exclusion",
];
export const STRIPE_BLEND_MODE_INDEX: Record<StripeBlendMode, number> = Object.fromEntries(
  STRIPE_BLEND_MODES.map((mode, index) => [mode, index]),
) as Record<StripeBlendMode, number>;

export const DEFAULT_COLORS: ColorsConfig = {
  mode: "luminance",
  stripeBlendMode: "normal",
  imageColorLightness: 0.2,
  imageColorDensity: 1,
  imageColorRemoveThin: 0,
  imageColorBoostThick: 0,
  autoDetectBackground: true,
  backgroundColor: 0x000000,
  gradient: { enabled: false, ...DEFAULT_GRADIENT, stops: [...DEFAULT_GRADIENT.stops] },
};

type PartialColors = {
  mode?: unknown;
  stripeBlendMode?: unknown;
  imageColorLightness?: unknown;
  imageColorDensity?: unknown;
  imageColorRemoveThin?: unknown;
  imageColorBoostThick?: unknown;
  autoDetectBackground?: unknown;
  backgroundColor?: unknown;
  gradient?: Partial<BackgroundGradient>;
};

export function normalizeColors(i: PartialColors = {}): ColorsConfig {
  const gr = i.gradient ?? {};
  return {
    mode: i.mode === "colors" ? "colors" : "luminance",
    stripeBlendMode: STRIPE_BLEND_MODES.includes(i.stripeBlendMode as StripeBlendMode)
      ? (i.stripeBlendMode as StripeBlendMode)
      : DEFAULT_COLORS.stripeBlendMode,
    imageColorLightness: clamp(num(i.imageColorLightness, DEFAULT_COLORS.imageColorLightness), -1, 1),
    imageColorDensity: clamp(num(i.imageColorDensity, DEFAULT_COLORS.imageColorDensity), 0, 1),
    imageColorRemoveThin: clamp(num(i.imageColorRemoveThin, DEFAULT_COLORS.imageColorRemoveThin), 0, 0.95),
    imageColorBoostThick: clamp(num(i.imageColorBoostThick, DEFAULT_COLORS.imageColorBoostThick), 0, 2),
    autoDetectBackground: i.autoDetectBackground !== undefined ? !!i.autoDetectBackground : true,
    backgroundColor: Math.round(clamp(num(i.backgroundColor, 0), 0, 0xffffff)),
    gradient: {
      enabled: gr.enabled === undefined ? DEFAULT_COLORS.gradient.enabled : !!gr.enabled,
      ...normalizeGradient(gr),
    },
  };
}

export const RENDER_MODES: RenderMode[] = [
  "sharp",
  "abstract",
  "charcoal",
  "pencil",
  "brush",
  "halftone",
  "risograph",
  "stainedGlass",
  "paperCutout",
  "crt",
  "glitch",
  "vhs",
  "amber",
  "gummy",
];
function normalizeRenderMode(v: unknown): RenderMode {
  return RENDER_MODES.includes(v as RenderMode) ? (v as RenderMode) : "sharp";
}

function normalizeRenderParams(v: unknown): number[] {
  const arr = Array.isArray(v) ? v : [];
  const out: number[] = [];
  for (let i = 0; i < 4; i++) out.push(clamp(num(arr[i], 0.5), 0, 1));
  return out;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  transform: DEFAULT_TRANSFORM,
  adjustments: DEFAULT_ADJUSTMENTS,
  background: DEFAULT_BACKGROUND,
  grid: DEFAULT_GRID,
  stripes: DEFAULT_STRIPES.map((s) => ({ ...s })),
  stripesEnabled: true,
  fieldScale: 1,
  maxFps: 0,
  reveal: {
    ...DEFAULT_REVEAL,
    wave: { ...DEFAULT_REVEAL.wave },
    assembly: { ...DEFAULT_REVEAL.assembly },
    turbulence: { ...DEFAULT_REVEAL.turbulence },
    glitch: { ...DEFAULT_REVEAL.glitch },
    vortex: { ...DEFAULT_REVEAL.vortex },
    water: { ...DEFAULT_REVEAL.water },
  },
  sparkle: {
    gaps: { ...DEFAULT_SPARKLE.gaps },
    width: { ...DEFAULT_SPARKLE.width },
    stripe: { ...DEFAULT_SPARKLE.stripe },
    motion: { ...DEFAULT_SPARKLE.motion },
  },
  stripeDots: { ...DEFAULT_STRIPE_DOTS },
  stripeBorder: { ...DEFAULT_STRIPE_BORDER },
  gridLines: { ...DEFAULT_GRID_LINES },
  frames: { ...DEFAULT_FRAMES },
  flames: { ...DEFAULT_FLAMES },
  edgeMask: { ...DEFAULT_EDGE_MASK },
  cursorTrail: { ...DEFAULT_CURSOR_TRAIL },
  clickWave: { ...DEFAULT_CLICK_WAVE },
  letters: { ...DEFAULT_LETTERS },
  colors: { ...DEFAULT_COLORS },
  renderMode: "sharp",
  renderIntensity: 1,
  renderParams: [0.5, 0.5, 0.5, 0.5],
  renderColorA: 0x222222,
  renderColorB: 0xffffff,
};

export function normalizeEngineConfig(i: Partial<EngineConfig> = {}): EngineConfig {
  return {
    transform: normalizeTransform(i.transform),
    adjustments: normalizeAdjustments(i.adjustments),
    background: normalizeBackground(i.background),
    grid: normalizeGrid(i.grid),
    stripes: normalizeStripes(i.stripes, DEFAULT_STRIPES),
    stripesEnabled: i.stripesEnabled !== undefined ? !!i.stripesEnabled : true,
    fieldScale: clamp(num(i.fieldScale, 1), 0.25, 2),
    maxFps: Math.max(0, num(i.maxFps, 0)),
    reveal: normalizeReveal(i.reveal as PartialReveal | undefined),
    sparkle: normalizeSparkle(i.sparkle as PartialSparkle | undefined),
    stripeDots: normalizeStripeDots(i.stripeDots),
    stripeBorder: normalizeStripeBorder(i.stripeBorder),
    gridLines: normalizeGridLines(i.gridLines),
    frames: normalizeFrames(i.frames),
    flames: normalizeFlames(i.flames as PartialFlames | undefined),
    edgeMask: normalizeEdgeMask(i.edgeMask),
    cursorTrail: normalizeCursorTrail(i.cursorTrail),
    clickWave: normalizeClickWave(i.clickWave),
    letters: normalizeLetters(i.letters),
    colors: normalizeColors(i.colors),
    renderMode: normalizeRenderMode(i.renderMode),
    renderIntensity: clamp(num(i.renderIntensity, 1), 0, 1),
    renderParams: normalizeRenderParams(i.renderParams),
    renderColorA: Math.round(clamp(num(i.renderColorA, 0x222222), 0, 0xffffff)),
    renderColorB: Math.round(clamp(num(i.renderColorB, 0xffffff), 0, 0xffffff)),
  };
}
