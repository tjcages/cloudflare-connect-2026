/** UI slider bounds for playground duotone tuning. */
export const PLAYGROUND_CONTROL_RANGES = {
  bgMatch: { min: 0.01, max: 0.5, step: 0.005 },
  gamma: { min: 0, max: 4, step: 0.05 },
  threshold: { min: 0.05, max: 0.99, step: 0.01 },
  density: { min: 0.25, max: 4, step: 0.05 },
} as const;
