/** Sparkle blink mask for stripe grid cells. GLSL in shaders.ts must stay aligned. */

export type PlaygroundSparkleOptions = {
  enabled: boolean;
  /** Fraction of cells (0–1) that participate in sparkle. */
  coverage: number;
  /** Blink frequency in Hz. */
  rateHz: number;
};

export const DEFAULT_PLAYGROUND_SPARKLE_COVERAGE = 0.22;
export const DEFAULT_PLAYGROUND_SPARKLE_RATE_HZ = 2;
export const PLAYGROUND_SPARKLE_RATE_SLIDER_MAX_HZ = 4;
export const DEFAULT_PLAYGROUND_SPARKLE_RATE_SLIDER = DEFAULT_PLAYGROUND_SPARKLE_RATE_HZ / PLAYGROUND_SPARKLE_RATE_SLIDER_MAX_HZ;

export const DEFAULT_PLAYGROUND_SPARKLE_OPTIONS: PlaygroundSparkleOptions = {
  enabled: false,
  coverage: DEFAULT_PLAYGROUND_SPARKLE_COVERAGE,
  rateHz: DEFAULT_PLAYGROUND_SPARKLE_RATE_HZ,
};

export function normalizeSparkleRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    return 0;
  }
  return Math.min(1, Math.max(0, Math.round(rate * 100) / 100));
}

export function playgroundSparkleOptionsFromRate(rate: number): PlaygroundSparkleOptions {
  const sparkleRate = normalizeSparkleRate(rate);
  return {
    ...DEFAULT_PLAYGROUND_SPARKLE_OPTIONS,
    enabled: sparkleRate > 0,
    rateHz: sparkleRate * PLAYGROUND_SPARKLE_RATE_SLIDER_MAX_HZ,
  };
}

export function playgroundSparkleOptionsFromEnabled(enabled: boolean): PlaygroundSparkleOptions {
  return playgroundSparkleOptionsFromRate(enabled ? DEFAULT_PLAYGROUND_SPARKLE_RATE_SLIDER : 0);
}

function fract(x: number): number {
  return x - Math.floor(x);
}

/** Deterministic 0..1 hash per grid cell (matches shaders.ts sparkleCellHash). */
export function sparkleCellHash(col: number, row: number): number {
  const px = col + 17;
  const py = row + 31;
  let p3x = fract(px * 0.1031);
  let p3y = fract(py * 0.1030);
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

  const h = sparkleCellHash(col, row);
  if (h >= options.coverage) {
    return true;
  }

  const phase = h * 17;
  const slot = Math.floor(timeSec * options.rateHz + phase);
  return slot % 2 === 0;
}
