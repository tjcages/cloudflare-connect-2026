/** UI slider bounds for playground duotone tuning. */
export const PLAYGROUND_CONTROL_RANGES = {
  bgMatch: { min: 0.01, max: 0.5, step: 0.005 },
  gamma: { min: 0, max: 4, step: 0.05 },
  threshold: { min: 0.05, max: 0.99, step: 0.01 },
  density: { min: 0.25, max: 4, step: 0.05 },
  bandBreakpoint: { min: 1, max: 16, step: 0.1 },
  /** Active cell ratio 0–1 (0 = off). Default 0.22. */
  sparkleGapsActivePercent: { min: 0, max: 1, step: 0.01 },
  /** Pulse speed factor. Default 1. Slider 0.5–1.5. */
  sparkleGapsSpeed: { min: 0.5, max: 1.5, step: 0.05 },
  /** Active cell ratio 0–1 (0 = off). Default 0.3. */
  sparkleWidthActivePercent: { min: 0, max: 1, step: 0.01 },
  sparkleWidthSpeed: { min: 0.5, max: 1.5, step: 0.05 },
} as const;

/** Wider bounds for typed values (sliders stay on PLAYGROUND_CONTROL_RANGES). */
export const PLAYGROUND_CONTROL_INPUT_BOUNDS = {
  bgMatch: { min: 0.001, max: 10 },
  gamma: { min: 0, max: 32 },
  threshold: { min: 0, max: 1 },
  density: { min: 0.01, max: 32 },
  sparkleGapsActivePercent: { min: 0, max: 1 },
  sparkleGapsSpeed: { min: 0.05, max: 100 },
  sparkleWidthActivePercent: { min: 0, max: 1 },
  sparkleWidthSpeed: { min: 0.05, max: 100 },
} as const;
