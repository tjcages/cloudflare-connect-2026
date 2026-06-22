export type PlaygroundFlamesDirection = "up" | "down" | "left" | "right";

export type PlaygroundFlamesConfig = {
  enabled: boolean;
  /** Travel direction for flame streaks. */
  direction: PlaygroundFlamesDirection;
  /** Fraction of canvas width. */
  minWidthRatio: number;
  maxWidthRatio: number;
  /** Fraction of canvas height. */
  minHeightRatio: number;
  maxHeightRatio: number;
  baseSpeedPxPerSec: number;
  /** 0 = uniform speed, 1 = full ±50% spread around base speed. */
  speedVariation: number;
  spawnIntervalMs: number;
  spawnJitterMs: number;
  maxActive: number;
  /** Gradient plateau width (0 = wide solid core, 1 = narrow core with longer edge fades). */
  edgeSharpness: number;
  /** Per-flame peak opacity (gradient stops scale with this). */
  opacityMin: number;
  opacityMax: number;
};

export const DEFAULT_PLAYGROUND_FLAMES_CONFIG: PlaygroundFlamesConfig = {
  enabled: false,
  direction: "up",
  minWidthRatio: 0.0223,
  maxWidthRatio: 0.0453,
  minHeightRatio: 0.0245,
  maxHeightRatio: 0.0485,
  baseSpeedPxPerSec: 60,
  speedVariation: 0.5,
  spawnIntervalMs: 50,
  spawnJitterMs: 80,
  maxActive: 48,
  edgeSharpness: 1,
  opacityMin: 0.65,
  opacityMax: 1,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

export function normalizePlaygroundFlamesDirection(value: unknown): PlaygroundFlamesDirection {
  if (value === "down" || value === "left" || value === "right") {
    return value;
  }
  return "up";
}

export function isVerticalPlaygroundFlamesDirection(direction: PlaygroundFlamesDirection): boolean {
  return direction === "up" || direction === "down";
}

export function normalizePlaygroundFlamesConfig(
  input: Partial<PlaygroundFlamesConfig> | undefined,
): PlaygroundFlamesConfig {
  const base = DEFAULT_PLAYGROUND_FLAMES_CONFIG;
  if (!input) {
    return { ...base };
  }

  const minWidthRatio = clampNumber(input.minWidthRatio ?? base.minWidthRatio, 0.001, 0.5, base.minWidthRatio);
  const maxWidthRatio = clampNumber(
    input.maxWidthRatio ?? base.maxWidthRatio,
    minWidthRatio,
    0.5,
    Math.max(minWidthRatio, base.maxWidthRatio),
  );
  const minHeightRatio = clampNumber(input.minHeightRatio ?? base.minHeightRatio, 0.001, 0.5, base.minHeightRatio);
  const maxHeightRatio = clampNumber(
    input.maxHeightRatio ?? base.maxHeightRatio,
    minHeightRatio,
    0.5,
    Math.max(minHeightRatio, base.maxHeightRatio),
  );
  return {
    enabled: input.enabled !== false,
    direction: normalizePlaygroundFlamesDirection(input.direction ?? base.direction),
    minWidthRatio,
    maxWidthRatio,
    minHeightRatio,
    maxHeightRatio,
    baseSpeedPxPerSec: clampNumber(input.baseSpeedPxPerSec ?? base.baseSpeedPxPerSec, 1, 500, base.baseSpeedPxPerSec),
    speedVariation: clampNumber(input.speedVariation ?? base.speedVariation, 0, 1, base.speedVariation),
    spawnIntervalMs: clampInt(input.spawnIntervalMs ?? base.spawnIntervalMs, 20, 5000, base.spawnIntervalMs),
    spawnJitterMs: clampInt(input.spawnJitterMs ?? base.spawnJitterMs, 0, 2000, base.spawnJitterMs),
    maxActive: clampInt(input.maxActive ?? base.maxActive, 1, 200, base.maxActive),
    edgeSharpness: clampNumber(input.edgeSharpness ?? base.edgeSharpness, 0, 1, base.edgeSharpness),
    opacityMin: clampNumber(input.opacityMin ?? base.opacityMin, 0, 1, base.opacityMin),
    opacityMax: clampNumber(
      input.opacityMax ?? base.opacityMax,
      clampNumber(input.opacityMin ?? base.opacityMin, 0, 1, base.opacityMin),
      1,
      Math.max(
        clampNumber(input.opacityMin ?? base.opacityMin, 0, 1, base.opacityMin),
        input.opacityMax ?? base.opacityMax,
      ),
    ),
  };
}

export function isDefaultPlaygroundFlamesConfig(input: PlaygroundFlamesConfig): boolean {
  const base = DEFAULT_PLAYGROUND_FLAMES_CONFIG;
  return (
    input.enabled === base.enabled &&
    input.direction === base.direction &&
    input.minWidthRatio === base.minWidthRatio &&
    input.maxWidthRatio === base.maxWidthRatio &&
    input.minHeightRatio === base.minHeightRatio &&
    input.maxHeightRatio === base.maxHeightRatio &&
    input.baseSpeedPxPerSec === base.baseSpeedPxPerSec &&
    input.speedVariation === base.speedVariation &&
    input.spawnIntervalMs === base.spawnIntervalMs &&
    input.spawnJitterMs === base.spawnJitterMs &&
    input.maxActive === base.maxActive &&
    input.edgeSharpness === base.edgeSharpness &&
    input.opacityMin === base.opacityMin &&
    input.opacityMax === base.opacityMax
  );
}

export function resolveFlamesGradientStops(sharpness: number): { inner: number; outer: number } {
  const halfBand = 0.4 + (0.06 - 0.4) * clampNumber(sharpness, 0, 1, 1);
  return { inner: 0.5 - halfBand, outer: 0.5 + halfBand };
}

export function resolveFlamesSpeedRange(config: PlaygroundFlamesConfig): { minPxPerSec: number; maxPxPerSec: number } {
  const spread = config.baseSpeedPxPerSec * 0.5 * config.speedVariation;
  return {
    minPxPerSec: Math.max(1, config.baseSpeedPxPerSec - spread),
    maxPxPerSec: config.baseSpeedPxPerSec + spread,
  };
}
