import type {
  Transform,
  Background,
  Grid,
  Adjustments,
  Stripe,
  EngineConfig,
  RevealConfig,
  SparkleConfig,
  FlamesConfig,
  FlamesDirection,
  WavePosition,
  EdgeMaskConfig,
  CursorTrailConfig,
  ClickWaveConfig,
  LettersConfig,
  ColorsConfig,
  RenderMode,
} from "./types";

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
const num = (v: unknown, dflt: number): number => (typeof v === "number" && Number.isFinite(v) ? v : dflt);

export const DEFAULT_TRANSFORM: Transform = { fit: "stretch", zoom: 1, panX: 0, panY: 0 };
export function normalizeTransform(i: Partial<Transform> = {}): Transform {
  const fit = i.fit === "contain" || i.fit === "cover" || i.fit === "stretch" ? i.fit : "stretch";
  return {
    fit,
    zoom: clamp(num(i.zoom, 1), 0.1, 8),
    panX: clamp(num(i.panX, 0), -1, 1),
    panY: clamp(num(i.panY, 0), -1, 1),
  };
}

export const DEFAULT_BACKGROUND: Background = { color: 0xffffff };
export function normalizeBackground(i: Partial<Background> = {}): Background {
  return { color: Math.round(clamp(num(i.color, 0xffffff), 0, 0xffffff)) };
}

export const DEFAULT_GRID: Grid = {
  cellWidth: 7,
  cellHeight: 7,
  gapX: 0,
  gapY: 0,
  cornerRadius: 0,
  orientation: "vertical",
};
export function normalizeGrid(i: Partial<Grid> = {}): Grid {
  const cellWidth = clamp(Math.round(num(i.cellWidth, 7)), 1, 64);
  const cellHeight = clamp(Math.round(num(i.cellHeight, 7)), 1, 64);
  return {
    cellWidth,
    cellHeight,
    gapX: clamp(num(i.gapX, 0), 0, cellWidth),
    gapY: clamp(num(i.gapY, 0), 0, cellHeight),
    cornerRadius: clamp(num(i.cornerRadius, 0), 0, Math.max(cellWidth, cellHeight)),
    orientation: i.orientation === "horizontal" ? "horizontal" : "vertical",
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
  { color: 0xf3f3f3, startFrom: 0.12, width: 1 },
  { color: 0xfada98, startFrom: 0.28, width: 1 },
  { color: 0xf8bd70, startFrom: 0.44, width: 2 },
  { color: 0xf69e4d, startFrom: 0.6, width: 3 },
  { color: 0xf27c33, startFrom: 0.76, width: 4 },
  { color: 0xeb5729, startFrom: 0.9, width: 5 },
];
export function normalizeStripe(i: Partial<Stripe>): Stripe {
  return {
    color: Math.round(clamp(num(i.color, 0), 0, 0xffffff)),
    startFrom: clamp(num(i.startFrom, 0), 0, 1),
    width: clamp(Math.round(num(i.width, 1)), 1, 64),
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
export const DEFAULT_REVEAL: RevealConfig = {
  enabled: false,
  type: "wave",
  wave: { position: "center", durationMs: 1200, softness: 0.22, waviness: 0.11 },
  assembly: { sliceSizePx: 40, speedMinMs: 300, speedMaxMs: 1600, staggerMs: 900, scatterPx: 50, angleJitterDeg: 22 },
};

type PartialReveal = {
  enabled?: unknown;
  type?: unknown;
  wave?: Partial<RevealConfig["wave"]>;
  assembly?: Partial<RevealConfig["assembly"]>;
};

export function normalizeReveal(i: PartialReveal = {}): RevealConfig {
  const w = i.wave ?? {};
  const a = i.assembly ?? {};
  const position = WAVE_POSITIONS.includes(w.position as WavePosition)
    ? (w.position as WavePosition)
    : DEFAULT_REVEAL.wave.position;
  const speedMinMs = clamp(Math.round(num(a.speedMinMs, DEFAULT_REVEAL.assembly.speedMinMs)), 100, 30000);
  const speedMaxMs = Math.max(
    speedMinMs,
    clamp(Math.round(num(a.speedMaxMs, DEFAULT_REVEAL.assembly.speedMaxMs)), 100, 30000),
  );
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_REVEAL.enabled,
    type: i.type === "assembly" || i.type === "wave" ? i.type : "wave",
    wave: {
      position,
      durationMs: clamp(Math.round(num(w.durationMs, DEFAULT_REVEAL.wave.durationMs)), 100, 30000),
      softness: clamp(num(w.softness, DEFAULT_REVEAL.wave.softness), 0, 1),
      waviness: clamp(num(w.waviness, DEFAULT_REVEAL.wave.waviness), 0, 1),
    },
    assembly: {
      sliceSizePx: clamp(Math.round(num(a.sliceSizePx, DEFAULT_REVEAL.assembly.sliceSizePx)), 8, 200),
      speedMinMs,
      speedMaxMs,
      staggerMs: clamp(Math.round(num(a.staggerMs, DEFAULT_REVEAL.assembly.staggerMs)), 0, 30000),
      scatterPx: clamp(Math.round(num(a.scatterPx, DEFAULT_REVEAL.assembly.scatterPx)), 0, 300),
      angleJitterDeg: clamp(num(a.angleJitterDeg, DEFAULT_REVEAL.assembly.angleJitterDeg), 0, 90),
    },
  };
}

export const DEFAULT_SPARKLE: SparkleConfig = {
  gaps: { enabled: false, coverage: 0.22, speed: 1 },
  width: { enabled: false, coverage: 0.3, swingPx: 1.25, swingPeriodMin: 0.21, swingPeriodMax: 0.55 },
};

type PartialSparkle = {
  gaps?: Partial<SparkleConfig["gaps"]>;
  width?: Partial<SparkleConfig["width"]>;
};

export function normalizeSparkle(i: PartialSparkle = {}): SparkleConfig {
  const g = i.gaps ?? {};
  const w = i.width ?? {};
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
  };
}

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
};

type PartialFlames = Partial<FlamesConfig>;

function normalizeFlamesDirection(value: unknown): FlamesDirection {
  if (value === "down" || value === "left" || value === "right") return value;
  return "up";
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
  };
}

export const DEFAULT_EDGE_MASK: EdgeMaskConfig = {
  enabled: false,
  start: 0,
  end: 0.1,
  power: 1,
};

type PartialEdgeMask = Partial<EdgeMaskConfig>;

export function normalizeEdgeMask(i: PartialEdgeMask = {}): EdgeMaskConfig {
  const start = clamp(num(i.start, DEFAULT_EDGE_MASK.start), 0, 0.5);
  const end = clamp(num(i.end, DEFAULT_EDGE_MASK.end), start + 0.001, 0.5);
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_EDGE_MASK.enabled,
    start,
    end,
    power: clamp(num(i.power, DEFAULT_EDGE_MASK.power), 0.1, 4),
  };
}

export const DEFAULT_CURSOR_TRAIL: CursorTrailConfig = {
  enabled: false,
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
  };
}

export const DEFAULT_CLICK_WAVE: ClickWaveConfig = {
  enabled: false,
  lifeMs: 630,
  startRadiusPx: 6,
  maxRadiusPx: 120,
  startStrokeWidthPx: 24,
  endStrokeWidthPx: 12,
  maxWaves: 12,
  pushStrengthPx: 38,
  pushBandScale: 3.2,
  stripeWhiteAlpha: 0.5,
};

type PartialClickWave = Partial<ClickWaveConfig>;

export function normalizeClickWave(i: PartialClickWave = {}): ClickWaveConfig {
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_CLICK_WAVE.enabled,
    lifeMs: clamp(num(i.lifeMs, DEFAULT_CLICK_WAVE.lifeMs), 80, 10_000),
    startRadiusPx: clamp(num(i.startRadiusPx, DEFAULT_CLICK_WAVE.startRadiusPx), 1, 120),
    maxRadiusPx: clamp(num(i.maxRadiusPx, DEFAULT_CLICK_WAVE.maxRadiusPx), 4, 600),
    startStrokeWidthPx: clamp(num(i.startStrokeWidthPx, DEFAULT_CLICK_WAVE.startStrokeWidthPx), 0.5, 80),
    endStrokeWidthPx: clamp(num(i.endStrokeWidthPx, DEFAULT_CLICK_WAVE.endStrokeWidthPx), 0.25, 40),
    maxWaves: clampInt(num(i.maxWaves, DEFAULT_CLICK_WAVE.maxWaves), 1, 32),
    pushStrengthPx: clamp(num(i.pushStrengthPx, DEFAULT_CLICK_WAVE.pushStrengthPx), 0, 200),
    pushBandScale: clamp(num(i.pushBandScale, DEFAULT_CLICK_WAVE.pushBandScale), 1, 8),
    stripeWhiteAlpha: clamp(num(i.stripeWhiteAlpha, DEFAULT_CLICK_WAVE.stripeWhiteAlpha), 0, 1),
  };
}

export const DEFAULT_LETTERS: LettersConfig = {
  enabled: false,
  coverage: 0.1,
  sizeScale: 0.9,
  shuffleSpeed: 1,
};

type PartialLetters = Partial<LettersConfig>;

export function normalizeLetters(i: PartialLetters = {}): LettersConfig {
  return {
    enabled: i.enabled !== undefined ? !!i.enabled : DEFAULT_LETTERS.enabled,
    coverage: clamp(num(i.coverage, DEFAULT_LETTERS.coverage), 0, 1),
    sizeScale: clamp(num(i.sizeScale, DEFAULT_LETTERS.sizeScale), 0.1, 1),
    shuffleSpeed: clamp(num(i.shuffleSpeed, DEFAULT_LETTERS.shuffleSpeed), 0.05, 10),
  };
}

export const DEFAULT_COLORS: ColorsConfig = {
  mode: "luminance",
  autoDetectBackground: true,
  backgroundColor: 0x000000,
};

type PartialColors = Partial<ColorsConfig>;

export function normalizeColors(i: PartialColors = {}): ColorsConfig {
  return {
    mode: i.mode === "colors" ? "colors" : "luminance",
    autoDetectBackground: i.autoDetectBackground !== undefined ? !!i.autoDetectBackground : true,
    backgroundColor: Math.round(clamp(num(i.backgroundColor, 0), 0, 0xffffff)),
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
  reveal: { ...DEFAULT_REVEAL, wave: { ...DEFAULT_REVEAL.wave }, assembly: { ...DEFAULT_REVEAL.assembly } },
  sparkle: { gaps: { ...DEFAULT_SPARKLE.gaps }, width: { ...DEFAULT_SPARKLE.width } },
  flames: { ...DEFAULT_FLAMES },
  edgeMask: { ...DEFAULT_EDGE_MASK },
  cursorTrail: { ...DEFAULT_CURSOR_TRAIL },
  clickWave: { ...DEFAULT_CLICK_WAVE },
  letters: { ...DEFAULT_LETTERS },
  colors: { ...DEFAULT_COLORS },
  renderMode: "sharp",
  renderIntensity: 1,
  renderParams: [0.5, 0.5, 0.5, 0.5],
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
    reveal: normalizeReveal(i.reveal as PartialReveal | undefined),
    sparkle: normalizeSparkle(i.sparkle as PartialSparkle | undefined),
    flames: normalizeFlames(i.flames as PartialFlames | undefined),
    edgeMask: normalizeEdgeMask(i.edgeMask),
    cursorTrail: normalizeCursorTrail(i.cursorTrail),
    clickWave: normalizeClickWave(i.clickWave),
    letters: normalizeLetters(i.letters),
    colors: normalizeColors(i.colors),
    renderMode: normalizeRenderMode(i.renderMode),
    renderIntensity: clamp(num(i.renderIntensity, 1), 0, 1),
    renderParams: normalizeRenderParams(i.renderParams),
  };
}
