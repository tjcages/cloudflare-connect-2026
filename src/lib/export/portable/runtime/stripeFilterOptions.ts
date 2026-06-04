import type { StripeBandBreakpoints } from "../types";

export type Rgb01 = [number, number, number];

/** Playground parity: background ignore is always black. */
export const PLAYGROUND_IGNORE_BG_RGB: Rgb01 = [0, 0, 0];

export type StripeDuotoneOptions = {
  ignoreColorRgb: Rgb01;
  ignoreTolerance: number;
  gamma: number;
  threshold: number;
  density: number;
  bandBreakpoints: StripeBandBreakpoints;
  referenceColorRgb?: Rgb01;
};

export const DEFAULT_STRIPE_THRESHOLD = 0.72;
export const DEFAULT_STRIPE_DENSITY = 1;

export const DEFAULT_STRIPE_DUOTONE_OPTIONS: StripeDuotoneOptions = {
  ignoreColorRgb: PLAYGROUND_IGNORE_BG_RGB,
  ignoreTolerance: 0.08,
  gamma: 1,
  threshold: DEFAULT_STRIPE_THRESHOLD,
  density: DEFAULT_STRIPE_DENSITY,
  bandBreakpoints: [1, 2, 3, 4],
};
