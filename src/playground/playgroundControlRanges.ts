/** UI slider bounds for playground duotone tuning. */
export const PLAYGROUND_CONTROL_RANGES = {
  bgMatch: { min: 0.01, max: 0.5, step: 0.005 },
  gamma: { min: 0, max: 4, step: 0.05 },
  threshold: { min: 0.05, max: 0.99, step: 0.01 },
  density: { min: 0.25, max: 4, step: 0.05 },
  bandBreakpoint: { min: 1, max: 16, step: 0.1 },
  /** 0 = off; 1 = max sparkle blink rate (4 Hz). Default on is 0.5 → 2 Hz. */
  sparkleRate: { min: 0, max: 1, step: 0.01 },
  /** 0 = off; 100 = all stripe cells may animate width at once. Default 30. */
  sparkleWidthActivePercent: { min: 0, max: 100, step: 1 },
  /** 0 = slowest (0.5×); 1 = fastest (1.5×). Default 0.5 → 1.0×. */
  sparkleWidthSpeed: { min: 0, max: 1, step: 0.01 },
} as const;
