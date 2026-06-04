/** Width shuffle for image stripe textures. GLSL in shaders.ts must stay aligned. */

import { STRIPE_MAX_WIDTH_PX, widthPxFromBand } from "./stripeGridConstants";

/** Fraction of stripe cells animating width at any moment (one pulse per cycle, then idle). */
export const WIDTH_SHUFFLE_COVERAGE = 0.3;
export const WIDTH_SHUFFLE_PERIOD_MIN_SEC = 0.21;
export const WIDTH_SHUFFLE_PERIOD_MAX_SEC = 0.55;
export const WIDTH_SHUFFLE_BASE_PERIOD_MIN_SEC = WIDTH_SHUFFLE_PERIOD_MIN_SEC;
export const WIDTH_SHUFFLE_BASE_PERIOD_MAX_SEC = WIDTH_SHUFFLE_PERIOD_MAX_SEC;
export const DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT = 0.3;
export const DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED = 1;
export const DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED_SLIDER = DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED;
export const WIDTH_SHUFFLE_MIN_WIDTH_PX = 1;
export const WIDTH_SHUFFLE_MAX_WIDTH_PX = STRIPE_MAX_WIDTH_PX;
export const WIDTH_SHUFFLE_MIN_SWING_PX = 1.25;

export type PlaygroundWidthShuffleOptions = {
  enabled: boolean;
  coverage: number;
  periodMinSec: number;
  periodMaxSec: number;
};

export const DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS: PlaygroundWidthShuffleOptions = {
  enabled: false,
  coverage: WIDTH_SHUFFLE_COVERAGE,
  periodMinSec: WIDTH_SHUFFLE_PERIOD_MIN_SEC,
  periodMaxSec: WIDTH_SHUFFLE_PERIOD_MAX_SEC,
};

function fract(x: number): number {
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothStep(t: number): number {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
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

/** Stable per-cell participation seed (matches shaders.ts widthShuffleCellSeed). */
export function widthShuffleCellSeed(col: number, row: number): number {
  return hashFromCoords(col + 17, row + 31);
}

/** Per-cell phase offset 0..1 (matches shaders.ts widthShufflePhaseHash). */
export function widthShufflePhaseHash(col: number, row: number): number {
  return hashFromCoords(col + 53, row + 71);
}

/** Per-cell period variation 0..1 (matches shaders.ts widthShufflePeriodHash). */
export function widthShufflePeriodHash(col: number, row: number): number {
  return hashFromCoords(col + 89, row + 113);
}

/** Target-width hash for a cell pulse (matches shaders.ts widthShuffleAltHash). */
export function widthShuffleAltHash(col: number, row: number, pulseIndex: number): number {
  return hashFromCoords(col + 53 + pulseIndex * 61, row + 71 + pulseIndex * 101);
}

/** Continuous alternate width in px, kept far enough from default for a visible swing. */
export function widthShuffleTargetWidth(col: number, row: number, pulseIndex: number, defaultWidth: number): number {
  const h = widthShuffleAltHash(col, row, pulseIndex);
  const span = WIDTH_SHUFFLE_MAX_WIDTH_PX - WIDTH_SHUFFLE_MIN_WIDTH_PX;
  let target = WIDTH_SHUFFLE_MIN_WIDTH_PX + h * span;

  if (Math.abs(target - defaultWidth) < WIDTH_SHUFFLE_MIN_SWING_PX) {
    if (defaultWidth <= (WIDTH_SHUFFLE_MIN_WIDTH_PX + WIDTH_SHUFFLE_MAX_WIDTH_PX) * 0.5) {
      target =
        defaultWidth +
        WIDTH_SHUFFLE_MIN_SWING_PX +
        h * (WIDTH_SHUFFLE_MAX_WIDTH_PX - defaultWidth - WIDTH_SHUFFLE_MIN_SWING_PX);
    } else {
      target =
        defaultWidth -
        WIDTH_SHUFFLE_MIN_SWING_PX -
        h * (defaultWidth - WIDTH_SHUFFLE_MIN_WIDTH_PX - WIDTH_SHUFFLE_MIN_SWING_PX);
    }
    target = clamp(target, WIDTH_SHUFFLE_MIN_WIDTH_PX, WIDTH_SHUFFLE_MAX_WIDTH_PX);
  }

  return target;
}

export function isWidthShuffleParticipant(
  col: number,
  row: number,
  coverage: number = WIDTH_SHUFFLE_COVERAGE,
): boolean {
  return widthShuffleCellSeed(col, row) < coverage;
}

export function resolveWidthShuffleCyclePeriod(
  pulsePeriodSec: number,
  coverage: number = WIDTH_SHUFFLE_COVERAGE,
): number {
  return pulsePeriodSec / Math.max(coverage, 0.001);
}

export function resolveWidthShuffleLocalPulseTime(
  col: number,
  row: number,
  timeSec: number,
  options: PlaygroundWidthShuffleOptions = DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS,
): { localTime: number; cycleIndex: number; pulsePeriod: number } | null {
  const pulsePeriod = resolveWidthShuffleCellPeriod(col, row, options);
  const cyclePeriod = resolveWidthShuffleCyclePeriod(pulsePeriod, options.coverage);
  const phaseOffset = widthShufflePhaseHash(col, row) * cyclePeriod;
  const scheduledTime = timeSec + phaseOffset;
  const cycleIndex = Math.floor(scheduledTime / cyclePeriod);
  const localTime = scheduledTime - cycleIndex * cyclePeriod;

  if (localTime >= pulsePeriod) {
    return null;
  }

  return { localTime, cycleIndex, pulsePeriod };
}

export function isWidthShuffleActive(
  col: number,
  row: number,
  timeSec: number,
  options: PlaygroundWidthShuffleOptions = DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS,
): boolean {
  return resolveWidthShuffleLocalPulseTime(col, row, timeSec, options) !== null;
}

export function resolveWidthShuffleCellPeriod(
  col: number,
  row: number,
  options: PlaygroundWidthShuffleOptions = DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS,
): number {
  const span = options.periodMaxSec - options.periodMinSec;
  return options.periodMinSec + widthShufflePeriodHash(col, row) * span;
}

/** One-shot 0..1..0 envelope for a single pulse (localT must stay in 0..1). */
export function widthShufflePulseEnvelope(localT: number): number {
  if (localT < 0 || localT > 1) {
    return 0;
  }
  const cosine = 0.5 - 0.5 * Math.cos(2 * Math.PI * localT);
  return smoothStep(cosine);
}

export function resolveWidthShuffleStripeWidth(
  col: number,
  row: number,
  band: number,
  timeSec: number,
  options: PlaygroundWidthShuffleOptions = DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS,
): number {
  const defaultWidth = widthPxFromBand(band);
  if (!options.enabled || band <= 0) {
    return defaultWidth;
  }

  const pulse = resolveWidthShuffleLocalPulseTime(col, row, timeSec, options);
  if (!pulse) {
    return defaultWidth;
  }

  const localT = pulse.localTime / pulse.pulsePeriod;
  const targetWidth = widthShuffleTargetWidth(col, row, pulse.cycleIndex, defaultWidth);
  const envelope = widthShufflePulseEnvelope(localT);

  return defaultWidth + (targetWidth - defaultWidth) * envelope;
}

export function resolveWidthShuffleHalfWidth(
  col: number,
  row: number,
  band: number,
  timeSec: number,
  options: PlaygroundWidthShuffleOptions = DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS,
): number {
  return resolveWidthShuffleStripeWidth(col, row, band, timeSec, options) * 0.5;
}

export function normalizeSparkleWidthActivePercent(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT;
  }
  const ratio = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, Math.round(ratio * 1000) / 1000));
}

export function normalizeSparkleWidthSpeed(speed: number): number {
  if (!Number.isFinite(speed)) {
    return DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED;
  }
  return Math.max(0.05, Math.round(speed * 1000) / 1000);
}

export function migrateSparkleWidthSpeedFromWireV1(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED;
  }
  if (value > 1) {
    return 0.5 + value;
  }
  if (value <= 1) {
    return 0.5 + value;
  }
  return value;
}

export function playgroundWidthShuffleOptionsFromSliders(
  activeRatio: number,
  speedFactor: number,
): PlaygroundWidthShuffleOptions {
  const coverage = normalizeSparkleWidthActivePercent(activeRatio);
  const speed = normalizeSparkleWidthSpeed(speedFactor);
  return {
    enabled: coverage > 0,
    coverage,
    periodMinSec: WIDTH_SHUFFLE_BASE_PERIOD_MIN_SEC / speed,
    periodMaxSec: WIDTH_SHUFFLE_BASE_PERIOD_MAX_SEC / speed,
  };
}

export function resolvePersistedSparkleWidthActivePercent(config: { sparkleWidthActivePercent?: number }): number {
  if (config.sparkleWidthActivePercent !== undefined) {
    return normalizeSparkleWidthActivePercent(config.sparkleWidthActivePercent);
  }
  return DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT;
}

export function resolvePersistedSparkleWidthSpeed(config: { sparkleWidthSpeed?: number }): number {
  if (config.sparkleWidthSpeed !== undefined) {
    return normalizeSparkleWidthSpeed(config.sparkleWidthSpeed);
  }
  return DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED;
}
