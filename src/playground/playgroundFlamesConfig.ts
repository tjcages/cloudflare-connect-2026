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
  /** 0 = soft edges, 1 = sharp edges. */
  edgeSharpness: number;
  /** Fade flames out near the canvas edges in preview and sampling. */
  edgeMaskEnabled: boolean;
  /** Inset from each edge (0–1) where mask alpha stays 0. */
  edgeMaskStart: number;
  /** Inset from each edge (0–1) where mask alpha reaches 1. Must be > edgeMaskStart. */
  edgeMaskEnd: number;
  /** Curve applied to the start→end ramp (1 = linear). */
  edgeMaskPower: number;
};

export const DEFAULT_PLAYGROUND_FLAMES_CONFIG: PlaygroundFlamesConfig = {
  enabled: false,
  direction: "up",
  minWidthRatio: 0.00975,
  maxWidthRatio: 0.02275,
  minHeightRatio: 0.013,
  maxHeightRatio: 0.026,
  baseSpeedPxPerSec: 60,
  speedVariation: 0.5,
  spawnIntervalMs: 180,
  spawnJitterMs: 80,
  maxActive: 48,
  edgeSharpness: 0.88,
  edgeMaskEnabled: true,
  edgeMaskStart: 0,
  edgeMaskEnd: 0.1,
  edgeMaskPower: 1,
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
  const edgeMaskStart = clampNumber(input.edgeMaskStart ?? base.edgeMaskStart, 0, 0.5, base.edgeMaskStart);
  const edgeMaskEnd = clampNumber(
    input.edgeMaskEnd ?? base.edgeMaskEnd,
    edgeMaskStart + 0.001,
    0.5,
    Math.max(edgeMaskStart + 0.001, input.edgeMaskEnd ?? base.edgeMaskEnd),
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
    edgeMaskEnabled: input.edgeMaskEnabled !== false,
    edgeMaskStart,
    edgeMaskEnd,
    edgeMaskPower: clampNumber(input.edgeMaskPower ?? base.edgeMaskPower, 0.1, 4, base.edgeMaskPower),
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
    input.edgeMaskEnabled === base.edgeMaskEnabled &&
    input.edgeMaskStart === base.edgeMaskStart &&
    input.edgeMaskEnd === base.edgeMaskEnd &&
    input.edgeMaskPower === base.edgeMaskPower
  );
}

export function resolveFlamesEdgeMaskAlpha(
  u: number,
  v: number,
  config: Pick<PlaygroundFlamesConfig, "edgeMaskEnabled" | "edgeMaskStart" | "edgeMaskEnd" | "edgeMaskPower">,
): number {
  if (!config.edgeMaskEnabled) {
    return 1;
  }
  const start = config.edgeMaskStart;
  const end = Math.max(config.edgeMaskEnd, start + 0.0001);
  const ramp = (inset: number) => {
    const t = Math.min(1, Math.max(0, (inset - start) / (end - start)));
    return t ** config.edgeMaskPower;
  };
  const insetX = Math.min(u, 1 - u);
  const insetY = Math.min(v, 1 - v);
  return ramp(insetX) * ramp(insetY);
}

export function resolveFlamesGradientStops(sharpness: number): { inner: number; outer: number } {
  const halfBand = 0.4 + (0.06 - 0.4) * clampNumber(sharpness, 0, 1, 0.88);
  return { inner: 0.5 - halfBand, outer: 0.5 + halfBand };
}

export function resolveFlamesSpeedRange(config: PlaygroundFlamesConfig): { minPxPerSec: number; maxPxPerSec: number } {
  const spread = config.baseSpeedPxPerSec * 0.5 * config.speedVariation;
  return {
    minPxPerSec: Math.max(1, config.baseSpeedPxPerSec - spread),
    maxPxPerSec: config.baseSpeedPxPerSec + spread,
  };
}
