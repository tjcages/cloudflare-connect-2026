import type { StripeBandBreakpoints } from "../types";

export type Rgb01 = [number, number, number];

export type StripeDuotoneOptions = {
  ignoreTolerance: number;
  threshold: number;
  density: number;
  bandBreakpoints: StripeBandBreakpoints;
};

export const DEFAULT_STRIPE_THRESHOLD = 0.95;
export const DEFAULT_STRIPE_DENSITY = 1;

export const DEFAULT_STRIPE_DUOTONE_OPTIONS: StripeDuotoneOptions = {
  ignoreTolerance: 0.08,
  threshold: DEFAULT_STRIPE_THRESHOLD,
  density: DEFAULT_STRIPE_DENSITY,
  bandBreakpoints: [1, 2, 3, 4],
};
