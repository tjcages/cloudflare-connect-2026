import { STRIPE_BAND_COUNT } from "./stripeGridConstants";

/** Upper distance limit (after density) for bands 1…4; band 5 is everything above. */
export type StripeBandBreakpoints = readonly [number, number, number, number];

export const DEFAULT_STRIPE_BAND_BREAKPOINTS: StripeBandBreakpoints = [1, 2, 3, 4];

export const STRIPE_BAND_DISTANCE_MIN = 1;
/** Minimum space between adjacent breakpoint sliders (0 = fine-grained control). */
export const STRIPE_BAND_BREAKPOINT_MIN_GAP = 0;
/** Keeps bands distinct when min gap is 0. */
export const STRIPE_BAND_BREAKPOINT_ORDER_EPS = 0.01;
export const STRIPE_BAND_BREAKPOINT_LIMIT = 16;

function breakpointOrderGap(): number {
  return STRIPE_BAND_BREAKPOINT_MIN_GAP || STRIPE_BAND_BREAKPOINT_ORDER_EPS;
}

function clampBreakpoint(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Keeps four breakpoints strictly increasing with a minimum gap. */
export function normalizeStripeBandBreakpoints(breakpoints: readonly number[]): StripeBandBreakpoints {
  const minLimit = STRIPE_BAND_DISTANCE_MIN;
  const maxLimit = STRIPE_BAND_BREAKPOINT_LIMIT;
  const gap = breakpointOrderGap();

  const upperMax = maxLimit - gap * (STRIPE_BAND_COUNT - 2);
  const b0 = clampBreakpoint(breakpoints[0] ?? minLimit, minLimit, upperMax);
  const b1 = clampBreakpoint(breakpoints[1] ?? b0 + gap, b0 + gap, upperMax + gap);
  const b2 = clampBreakpoint(breakpoints[2] ?? b1 + gap, b1 + gap, upperMax + gap * 2);
  const b3 = clampBreakpoint(breakpoints[3] ?? b2 + gap, b2 + gap, maxLimit);

  return [b0, b1, b2, b3];
}

/**
 * Sets one breakpoint and pushes/pulls neighbors so ranges stay contiguous.
 * Expanding a band's upper bound shrinks bands above; shrinking expands bands below.
 */
export function setStripeBandBreakpoint(
  breakpoints: StripeBandBreakpoints,
  index: number,
  value: number,
): StripeBandBreakpoints {
  const gap = breakpointOrderGap();
  const next = [...breakpoints] as number[];
  const lastIndex = STRIPE_BAND_COUNT - 2;

  const floor = STRIPE_BAND_DISTANCE_MIN + index * STRIPE_BAND_BREAKPOINT_MIN_GAP;
  const ceiling = STRIPE_BAND_BREAKPOINT_LIMIT - STRIPE_BAND_BREAKPOINT_MIN_GAP * (lastIndex - index);
  next[index] = clampBreakpoint(value, floor, ceiling);

  for (let i = index + 1; i <= lastIndex; i++) {
    if (next[i]! < next[i - 1]! + gap) {
      next[i] = next[i - 1]! + gap;
    }
  }

  for (let i = index - 1; i >= 0; i--) {
    if (next[i]! > next[i + 1]! - gap) {
      next[i] = next[i + 1]! - gap;
    }
  }

  return normalizeStripeBandBreakpoints(next);
}

export function bandFromDistance(
  distance: number,
  isBg: boolean,
  density: number,
  breakpoints: StripeBandBreakpoints = DEFAULT_STRIPE_BAND_BREAKPOINTS,
): number {
  if (isBg || distance < 1) {
    return 0;
  }
  const scaled = distance / density;
  for (let band = 0; band < STRIPE_BAND_COUNT; band++) {
    if (scaled <= breakpoints[band]) {
      return band + 1;
    }
  }
  return STRIPE_BAND_COUNT;
}

/** Human-readable fg distance span for sidebar (band index 0…4). */
export function stripeBandDistanceLabel(breakpoints: StripeBandBreakpoints, bandIndex: number): string {
  const min = bandIndex === 0 ? STRIPE_BAND_DISTANCE_MIN : breakpoints[bandIndex - 1]!;
  const roundedMin = Math.round(min * 10) / 10;
  if (bandIndex >= STRIPE_BAND_COUNT - 1) {
    const tail = Math.round(breakpoints[STRIPE_BAND_COUNT - 2]! * 10) / 10;
    return `>${tail}`;
  }
  const max = Math.round(breakpoints[bandIndex]! * 10) / 10;
  if (roundedMin >= max) {
    return `${max}`;
  }
  return `${roundedMin}–${max}`;
}
