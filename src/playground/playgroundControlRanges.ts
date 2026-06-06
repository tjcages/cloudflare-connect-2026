/** UI slider bounds for playground duotone tuning. */
export const PLAYGROUND_CONTROL_RANGES = {
  /** Active cell ratio 0–1 (0 = off). Default 0.22. */
  sparkleGapsActivePercent: { min: 0, max: 1, step: 0.01 },
  /** Pulse speed factor. Default 1. Slider 0.5–1.5. */
  sparkleGapsSpeed: { min: 0.5, max: 1.5, step: 0.05 },
  /** Active cell ratio 0–1 (0 = off). Default 0.3. */
  sparkleWidthActivePercent: { min: 0, max: 1, step: 0.01 },
  sparkleWidthSpeed: { min: 0.5, max: 1.5, step: 0.05 },
  /** Texture luminance gamma (positive only). Default 1. */
  textureGamma: { min: 0.05, max: 5, step: 0.05 },
  flamesSizeRatio: { min: 0.001, max: 0.08, step: 0.0005 },
  flamesSpeed: { min: 10, max: 200, step: 1 },
  flamesSpeedVariation: { min: 0, max: 1, step: 0.01 },
  flamesSpawnIntervalMs: { min: 50, max: 2000, step: 10 },
  flamesSpawnJitterMs: { min: 0, max: 500, step: 5 },
  flamesMaxActive: { min: 1, max: 120, step: 1 },
  flamesEdgeSharpness: { min: 0, max: 1, step: 0.01 },
  flamesEdgeMaskInset: { min: 0, max: 50, step: 0.1 },
  flamesEdgeMaskPower: { min: 0.1, max: 4, step: 0.05 },
  revealDurationMs: { min: 100, max: 6000, step: 50 },
  revealSoftness: { min: 0, max: 0.5, step: 0.01 },
  revealWaviness: { min: 0, max: 0.35, step: 0.01 },
  revealNoiseScale: { min: 0.5, max: 16, step: 0.1 },
} as const;

/** Wider bounds for typed values (sliders stay on PLAYGROUND_CONTROL_RANGES). */
export const PLAYGROUND_CONTROL_INPUT_BOUNDS = {
  sparkleGapsActivePercent: { min: 0, max: 1 },
  sparkleGapsSpeed: { min: 0.05, max: 100 },
  sparkleWidthActivePercent: { min: 0, max: 1 },
  sparkleWidthSpeed: { min: 0.05, max: 100 },
  /** Typed gamma; slider stays on PLAYGROUND_CONTROL_RANGES.textureGamma. */
  textureGamma: { min: 0.05, max: 1_000 },
  flamesSizeRatio: { min: 0.0005, max: 0.5 },
  flamesSpeed: { min: 1, max: 500 },
  flamesSpeedVariation: { min: 0, max: 1 },
  flamesSpawnIntervalMs: { min: 20, max: 10_000 },
  flamesSpawnJitterMs: { min: 0, max: 5000 },
  flamesMaxActive: { min: 1, max: 200 },
  flamesEdgeSharpness: { min: 0, max: 1 },
  flamesEdgeMaskInset: { min: 0, max: 50 },
  flamesEdgeMaskPower: { min: 0.1, max: 4 },
  revealDurationMs: { min: 100, max: 30_000 },
  revealSoftness: { min: 0, max: 1 },
  revealWaviness: { min: 0, max: 1 },
  revealNoiseScale: { min: 0.1, max: 50 },
} as const;
