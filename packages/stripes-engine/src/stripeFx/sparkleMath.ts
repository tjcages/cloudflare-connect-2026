export const SPARKLE_BASE_PERIOD_MIN_SEC = 0.21;
export const SPARKLE_BASE_PERIOD_MAX_SEC = 0.55;

function fract(x: number): number {
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothStep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

export function sparkleHash(px: number, py: number): number {
  let p3x = fract(px * 0.1031);
  let p3y = fract(py * 0.103);
  let p3z = fract(px * 0.0973);
  const dotVal = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x = fract(p3x + dotVal);
  p3y = fract(p3y + dotVal);
  p3z = fract(p3z + dotVal);
  return fract((p3x + p3y) * p3z);
}

export function phaseHash(col: number, row: number): number {
  return sparkleHash(col + 53, row + 71);
}

export function periodHash(col: number, row: number): number {
  return sparkleHash(col + 89, row + 113);
}

export function cellSeed(col: number, row: number): number {
  return sparkleHash(col + 17, row + 31);
}

export function altHash(col: number, row: number, pulseIndex: number): number {
  return sparkleHash(col + 53 + pulseIndex * 61, row + 71 + pulseIndex * 101);
}

export function cellPulse(
  col: number,
  row: number,
  timeSec: number,
  coverage: number,
  periodMinSec: number,
  periodMaxSec: number,
): { localTime: number; period: number; cycleIndex: number } {
  const periodSpan = periodMaxSec - periodMinSec;
  const period = periodMinSec + periodHash(col, row) * periodSpan;
  const cyclePeriod = period / Math.max(coverage, 0.001);
  const phaseOffset = phaseHash(col, row) * cyclePeriod;
  const scheduledTime = timeSec + phaseOffset;
  const cycleIndex = Math.floor(scheduledTime / cyclePeriod);
  const localTime = scheduledTime - cycleIndex * cyclePeriod;
  return { localTime, period, cycleIndex };
}

export function isGapped(
  col: number,
  row: number,
  timeSec: number,
  coverage: number,
  periodMinSec: number,
  periodMaxSec: number,
): boolean {
  if (coverage <= 0) {
    return false;
  }
  const pulse = cellPulse(col, row, timeSec, coverage, periodMinSec, periodMaxSec);
  return pulse.localTime < pulse.period;
}

function pulseEnvelope(localT: number): number {
  if (localT < 0 || localT > 1) {
    return 0;
  }
  const cosine = 0.5 - 0.5 * Math.cos(2 * Math.PI * localT);
  return smoothStep(cosine);
}

function targetWidth(
  col: number,
  row: number,
  pulseIndex: number,
  defaultWidth: number,
  swingPx: number,
  maxWidth: number,
): number {
  const h = altHash(col, row, pulseIndex);
  const target = defaultWidth + (h * 2 - 1) * Math.max(swingPx, 0);
  return clamp(target, 1, maxWidth);
}

export function shuffledWidth(
  col: number,
  row: number,
  defaultWidth: number,
  timeSec: number,
  coverage: number,
  periodMinSec: number,
  periodMaxSec: number,
  swingPx: number,
  maxWidth: number,
): number {
  if (defaultWidth <= 0) {
    return defaultWidth;
  }

  if (cellSeed(col, row) >= coverage) {
    return defaultWidth;
  }

  const pulse = cellPulse(col, row, timeSec, coverage, periodMinSec, periodMaxSec);

  if (pulse.localTime >= pulse.period) {
    return defaultWidth;
  }

  const localT = pulse.localTime / pulse.period;
  const tw = targetWidth(col, row, pulse.cycleIndex, defaultWidth, swingPx, maxWidth);
  const envelope = pulseEnvelope(localT);

  return defaultWidth + (tw - defaultWidth) * envelope;
}
