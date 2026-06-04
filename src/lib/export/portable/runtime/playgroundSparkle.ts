/** Sparkle gap mask for stripe grid cells. GLSL in shaders.ts must stay aligned. */

export type PlaygroundSparkleOptions = {
  enabled: boolean;
  /** Fraction of cells (0–1) showing a gap at the same time. */
  coverage: number;
  periodMinSec: number;
  periodMaxSec: number;
};

export const SPARKLE_GAPS_BASE_PERIOD_MIN_SEC = 0.21;
export const SPARKLE_GAPS_BASE_PERIOD_MAX_SEC = 0.55;
export const DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT = 0.22;
export const DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED = 1;
export const DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED_SLIDER = DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED;

export const DEFAULT_PLAYGROUND_SPARKLE_OPTIONS: PlaygroundSparkleOptions = {
  enabled: false,
  coverage: DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT,
  periodMinSec: SPARKLE_GAPS_BASE_PERIOD_MIN_SEC,
  periodMaxSec: SPARKLE_GAPS_BASE_PERIOD_MAX_SEC,
};

function fract(x: number): number {
  return x - Math.floor(x);
}

function hashFromCoords(px: number, py: number): number {
  let p3x = fract(px * 0.1031);
  let p3y = fract(py * 0.103);
  let p3z = fract(px * 0.0973);
  const dotVal = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x = fract(p3x + dotVal);
  p3y = fract(p3y + dotVal);
  p3z = fract(p3z + dotVal);
  return fract((p3x + p3y) * p3z);
}

export function sparklePhaseHash(col: number, row: number): number {
  return hashFromCoords(col + 53, row + 71);
}

export function sparklePeriodHash(col: number, row: number): number {
  return hashFromCoords(col + 89, row + 113);
}

export function normalizeSparkleGapsActivePercent(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT;
  }
  const ratio = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, Math.round(ratio * 1000) / 1000));
}

export function normalizeSparkleGapsSpeed(speed: number): number {
  if (!Number.isFinite(speed)) {
    return DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED;
  }
  return Math.max(0.05, Math.round(speed * 1000) / 1000);
}

export function migrateSparkleGapsSpeedFromWireV1(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED;
  }
  if (value > 1) {
    return 0.5 + value;
  }
  if (value <= 1) {
    return 0.5 + value;
  }
  return value;
}

export function playgroundSparkleOptionsFromSliders(
  activeRatio: number,
  speedFactor: number,
): PlaygroundSparkleOptions {
  const coverage = normalizeSparkleGapsActivePercent(activeRatio);
  const speed = normalizeSparkleGapsSpeed(speedFactor);
  return {
    enabled: coverage > 0,
    coverage,
    periodMinSec: SPARKLE_GAPS_BASE_PERIOD_MIN_SEC / speed,
    periodMaxSec: SPARKLE_GAPS_BASE_PERIOD_MAX_SEC / speed,
  };
}

export function resolvePersistedSparkleGapsActivePercent(config: {
  sparkleGapsActivePercent?: number;
  sparkleRate?: number;
  sparkleEnabled?: boolean;
}): number {
  if (config.sparkleGapsActivePercent !== undefined) {
    return normalizeSparkleGapsActivePercent(config.sparkleGapsActivePercent);
  }
  if (config.sparkleRate !== undefined && config.sparkleRate > 0) {
    return DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT;
  }
  if (config.sparkleEnabled) {
    return DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT;
  }
  return 0;
}

export function resolvePersistedSparkleGapsSpeed(config: {
  sparkleGapsSpeed?: number;
  sparkleRate?: number;
  sparkleEnabled?: boolean;
}): number {
  if (config.sparkleGapsSpeed !== undefined) {
    return normalizeSparkleGapsSpeed(config.sparkleGapsSpeed);
  }
  if (config.sparkleRate !== undefined && config.sparkleRate > 0) {
    return migrateSparkleGapsSpeedFromWireV1(config.sparkleRate);
  }
  if (config.sparkleEnabled) {
    return DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED;
  }
  return DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED;
}

export function resolveSparkleLocalPulseTime(
  col: number,
  row: number,
  timeSec: number,
  options: PlaygroundSparkleOptions = DEFAULT_PLAYGROUND_SPARKLE_OPTIONS,
): { localTime: number; pulsePeriod: number } | null {
  const periodSpan = options.periodMaxSec - options.periodMinSec;
  const pulsePeriod = options.periodMinSec + sparklePeriodHash(col, row) * periodSpan;
  const coverage = Math.max(options.coverage, 0.001);
  const cyclePeriod = pulsePeriod / coverage;
  const phaseOffset = sparklePhaseHash(col, row) * cyclePeriod;
  const scheduledTime = timeSec + phaseOffset;
  const cycleIndex = Math.floor(scheduledTime / cyclePeriod);
  const localTime = scheduledTime - cycleIndex * cyclePeriod;

  if (localTime >= pulsePeriod) {
    return null;
  }

  return { localTime, pulsePeriod };
}

export function sparkleCellHash(col: number, row: number): number {
  const px = col + 17;
  const py = row + 31;
  let p3x = fract(px * 0.1031);
  let p3y = fract(py * 0.103);
  let p3z = fract(px * 0.0973);
  const dotVal = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x = fract(p3x + dotVal);
  p3y = fract(p3y + dotVal);
  p3z = fract(p3z + dotVal);
  return fract((p3x + p3y) * p3z);
}

export function isPlaygroundSparkleCellVisible(
  col: number,
  row: number,
  timeSec: number,
  options: PlaygroundSparkleOptions,
): boolean {
  if (!options.enabled) {
    return true;
  }

  return resolveSparkleLocalPulseTime(col, row, timeSec, options) === null;
}

export function playgroundSparkleOptionsFromRate(rate: number): PlaygroundSparkleOptions {
  const activePercent = rate > 0 ? DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT : 0;
  return playgroundSparkleOptionsFromSliders(
    activePercent,
    rate > 0 ? migrateSparkleGapsSpeedFromWireV1(rate) : DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED,
  );
}

export function playgroundSparkleOptionsFromEnabled(enabled: boolean): PlaygroundSparkleOptions {
  return playgroundSparkleOptionsFromSliders(
    enabled ? DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT : 0,
    DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED,
  );
}
