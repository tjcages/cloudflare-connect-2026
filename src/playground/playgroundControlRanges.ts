/** UI slider bounds for playground duotone tuning. */
export const PLAYGROUND_CONTROL_RANGES = {
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
  sparkleGapsActivePercent: { min: 0, max: 1 },
  sparkleGapsSpeed: { min: 0.05, max: 100 },
  sparkleWidthActivePercent: { min: 0, max: 1 },
  sparkleWidthSpeed: { min: 0.05, max: 100 },
} as const;
