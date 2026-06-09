export type PlaygroundClickWaveConfig = {
  enabled: boolean;
  lifeMs: number;
  startRadiusPx: number;
  maxRadiusPx: number;
  startStrokeWidthPx: number;
  endStrokeWidthPx: number;
  maxWaves: number;
  /** Peak radial push in display pixels at wave birth. */
  pushStrengthPx: number;
  /** Multiplier on stroke width for how wide the push band is. */
  pushBandScale: number;
  /** Thin black ring just ahead of the push front (applied before displacement). */
  pushLeadBlackAlpha: number;
  pushLeadBlackOffsetPx: number;
  pushLeadBlackStrokePx: number;
  /** Subtle white brighten on the ring (feeds lighter stripe cells). */
  stripeWhiteAlpha: number;
  /** Random interior slice whites inside the wave disk (0–1 peak multiplier). */
  sliceWhiteAlpha: number;
  sliceCountMin: number;
  sliceCountMax: number;
  /** Per-wave random cell skip rate range (higher = sparser slices). */
  sliceSkipMin: number;
  sliceSkipMax: number;
  sliceLevelMin: number;
  sliceLevelMax: number;
  /** Angular ripples on the wave front (display px). */
  smokeRadiusWobblePx: number;
  /** How much noise breaks up solid rings (0 = crisp, 1 = wispy). */
  smokeStrengthJitter: number;
  /** Widen and soften the push/smoke band. */
  smokeSoftness: number;
  /** Feather slice fills near the expanding disk edge. */
  smokeSliceEdgeFeather: number;
};

export const DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG: PlaygroundClickWaveConfig = {
  enabled: true,
  lifeMs: 1050,
  startRadiusPx: 6,
  maxRadiusPx: 120,
  startStrokeWidthPx: 24,
  endStrokeWidthPx: 4,
  maxWaves: 12,
  pushStrengthPx: 38,
  pushBandScale: 3.2,
  pushLeadBlackAlpha: 0.52,
  pushLeadBlackOffsetPx: 5,
  pushLeadBlackStrokePx: 7,
  stripeWhiteAlpha: 0.42,
  sliceWhiteAlpha: 0.95,
  sliceCountMin: 12,
  sliceCountMax: 36,
  sliceSkipMin: 0,
  sliceSkipMax: 0.04,
  sliceLevelMin: 7,
  sliceLevelMax: 11,
  smokeRadiusWobblePx: 18,
  smokeStrengthJitter: 0.52,
  smokeSoftness: 1.45,
  smokeSliceEdgeFeather: 0.24,
};

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, finiteNumber(value, fallback)));
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(clamp(value, fallback, min, max));
}

export function normalizePlaygroundClickWaveConfig(
  raw?: Partial<PlaygroundClickWaveConfig>,
): PlaygroundClickWaveConfig {
  const base = DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG;
  const sliceCountMin = clampInt(raw?.sliceCountMin, base.sliceCountMin, 3, 64);
  const sliceCountMax = Math.max(sliceCountMin, clampInt(raw?.sliceCountMax, base.sliceCountMax, 3, 64));
  const sliceSkipMin = clamp(raw?.sliceSkipMin, base.sliceSkipMin, 0, 0.95);
  const sliceSkipMax = Math.max(sliceSkipMin, clamp(raw?.sliceSkipMax, base.sliceSkipMax, 0, 0.95));
  const sliceLevelMin = clampInt(raw?.sliceLevelMin, base.sliceLevelMin, 2, 16);
  const sliceLevelMax = Math.max(sliceLevelMin, clampInt(raw?.sliceLevelMax, base.sliceLevelMax, 2, 16));

  return {
    enabled: raw?.enabled !== false,
    lifeMs: clamp(raw?.lifeMs, base.lifeMs, 80, 10_000),
    startRadiusPx: clamp(raw?.startRadiusPx, base.startRadiusPx, 1, 120),
    maxRadiusPx: clamp(raw?.maxRadiusPx, base.maxRadiusPx, 4, 600),
    startStrokeWidthPx: clamp(raw?.startStrokeWidthPx, base.startStrokeWidthPx, 0.5, 80),
    endStrokeWidthPx: clamp(raw?.endStrokeWidthPx, base.endStrokeWidthPx, 0.25, 40),
    maxWaves: clampInt(raw?.maxWaves, base.maxWaves, 1, 32),
    pushStrengthPx: clamp(raw?.pushStrengthPx, base.pushStrengthPx, 0, 200),
    pushBandScale: clamp(raw?.pushBandScale, base.pushBandScale, 1, 8),
    pushLeadBlackAlpha: clamp(raw?.pushLeadBlackAlpha, base.pushLeadBlackAlpha, 0, 1),
    pushLeadBlackOffsetPx: clamp(raw?.pushLeadBlackOffsetPx, base.pushLeadBlackOffsetPx, 0, 40),
    pushLeadBlackStrokePx: clamp(raw?.pushLeadBlackStrokePx, base.pushLeadBlackStrokePx, 0.5, 40),
    stripeWhiteAlpha: clamp(raw?.stripeWhiteAlpha, base.stripeWhiteAlpha, 0, 1),
    sliceWhiteAlpha: clamp(raw?.sliceWhiteAlpha, base.sliceWhiteAlpha, 0, 1),
    sliceCountMin,
    sliceCountMax,
    sliceSkipMin,
    sliceSkipMax,
    sliceLevelMin,
    sliceLevelMax,
    smokeRadiusWobblePx: clamp(raw?.smokeRadiusWobblePx, base.smokeRadiusWobblePx, 0, 80),
    smokeStrengthJitter: clamp(raw?.smokeStrengthJitter, base.smokeStrengthJitter, 0, 1),
    smokeSoftness: clamp(raw?.smokeSoftness, base.smokeSoftness, 1, 3),
    smokeSliceEdgeFeather: clamp(raw?.smokeSliceEdgeFeather, base.smokeSliceEdgeFeather, 0, 0.8),
  };
}

export function isDefaultPlaygroundClickWaveConfig(config: PlaygroundClickWaveConfig): boolean {
  const normalized = normalizePlaygroundClickWaveConfig(config);
  const base = DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG;
  return (Object.keys(base) as (keyof PlaygroundClickWaveConfig)[]).every((key) => normalized[key] === base[key]);
}
