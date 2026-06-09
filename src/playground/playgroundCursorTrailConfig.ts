export type PlaygroundCursorTrailConfig = {
  enabled: boolean;
  particleRadius: number;
  particleAlpha: number;
  particleLifeMs: number;
  particleLifeJitterMs: number;
  emitterVelocitySmoothing: number;
  particleVelocityScale: number;
  particleTangentVelocity: number;
  particleDamping: number;
  particleSpacingPx: number;
  maxEmitPerTick: number;
  spreadMinPx: number;
  spreadMaxPx: number;
  spinStrength: number;
  densityRadiusMinScale: number;
  densityRadiusLifeScale: number;
  pushRadiusScale: number;
  pushStrengthPx: number;
  pushLagPx: number;
  pushWobblePx: number;
  /** Thin black shell on the outer push edge, applied before displacement. */
  pushLeadBlackAlpha: number;
  /** 0 = auto (one effect pixel per stripe cell). Otherwise fraction of display size. */
  trailScale: number;
};

export const DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG: PlaygroundCursorTrailConfig = {
  enabled: true,
  particleRadius: 13,
  particleAlpha: 0.42,
  particleLifeMs: 960,
  particleLifeJitterMs: 160,
  emitterVelocitySmoothing: 0.35,
  particleVelocityScale: 0.18,
  particleTangentVelocity: 0.9,
  particleDamping: 0.96,
  particleSpacingPx: 3,
  maxEmitPerTick: 45,
  spreadMinPx: 1.5,
  spreadMaxPx: 8.5,
  spinStrength: 0.024,
  densityRadiusMinScale: 0.65,
  densityRadiusLifeScale: 0.55,
  pushRadiusScale: 2.4,
  pushStrengthPx: 9,
  pushLagPx: 4,
  pushWobblePx: 2,
  pushLeadBlackAlpha: 0.36,
  trailScale: 0,
};

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, finiteNumber(value, fallback)));
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(clamp(value, fallback, min, max));
}

export function normalizePlaygroundCursorTrailConfig(
  raw?: Partial<PlaygroundCursorTrailConfig>,
): PlaygroundCursorTrailConfig {
  const base = DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG;
  const spreadMinPx = clamp(raw?.spreadMinPx, base.spreadMinPx, 0, 80);
  const spreadMaxPx = Math.max(spreadMinPx, clamp(raw?.spreadMaxPx, base.spreadMaxPx, 0, 120));

  return {
    enabled: raw?.enabled !== false,
    particleRadius: clamp(raw?.particleRadius, base.particleRadius, 0.5, 80),
    particleAlpha: clamp(raw?.particleAlpha, base.particleAlpha, 0, 1),
    particleLifeMs: clamp(raw?.particleLifeMs, base.particleLifeMs, 50, 10_000),
    particleLifeJitterMs: clamp(raw?.particleLifeJitterMs, base.particleLifeJitterMs, 0, 10_000),
    emitterVelocitySmoothing: clamp(raw?.emitterVelocitySmoothing, base.emitterVelocitySmoothing, 0, 0.98),
    particleVelocityScale: clamp(raw?.particleVelocityScale, base.particleVelocityScale, 0, 2),
    particleTangentVelocity: clamp(raw?.particleTangentVelocity, base.particleTangentVelocity, 0, 20),
    particleDamping: clamp(raw?.particleDamping, base.particleDamping, 0, 1),
    particleSpacingPx: clamp(raw?.particleSpacingPx, base.particleSpacingPx, 0.5, 80),
    maxEmitPerTick: clampInt(raw?.maxEmitPerTick, base.maxEmitPerTick, 1, 200),
    spreadMinPx,
    spreadMaxPx,
    spinStrength: clamp(raw?.spinStrength, base.spinStrength, 0, 0.2),
    densityRadiusMinScale: clamp(raw?.densityRadiusMinScale, base.densityRadiusMinScale, 0, 3),
    densityRadiusLifeScale: clamp(raw?.densityRadiusLifeScale, base.densityRadiusLifeScale, 0, 3),
    pushRadiusScale: clamp(raw?.pushRadiusScale, base.pushRadiusScale, 0, 8),
    pushStrengthPx: clamp(raw?.pushStrengthPx, base.pushStrengthPx, 0, 120),
    pushLagPx: clamp(raw?.pushLagPx, base.pushLagPx, 0, 80),
    pushWobblePx: clamp(raw?.pushWobblePx, base.pushWobblePx, 0, 80),
    pushLeadBlackAlpha: clamp(raw?.pushLeadBlackAlpha, base.pushLeadBlackAlpha, 0, 1),
    trailScale: clamp(raw?.trailScale, base.trailScale, 0, 1),
  };
}

export function isDefaultPlaygroundCursorTrailConfig(config: PlaygroundCursorTrailConfig): boolean {
  const normalized = normalizePlaygroundCursorTrailConfig(config);
  const base = DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG;
  return (Object.keys(base) as (keyof PlaygroundCursorTrailConfig)[]).every((key) => normalized[key] === base[key]);
}

export function resolveCursorTrailEffectSize(
  displayWidth: number,
  displayHeight: number,
  config: PlaygroundCursorTrailConfig,
  cellWidth: number,
  cellHeight: number,
): { width: number; height: number } {
  if (config.trailScale > 0) {
    return {
      width: Math.max(1, Math.round(displayWidth * config.trailScale)),
      height: Math.max(1, Math.round(displayHeight * config.trailScale)),
    };
  }
  const safeCellWidth = Math.max(1, Math.round(cellWidth));
  const safeCellHeight = Math.max(1, Math.round(cellHeight));
  return {
    width: Math.max(1, Math.ceil(displayWidth / safeCellWidth)),
    height: Math.max(1, Math.ceil(displayHeight / safeCellHeight)),
  };
}
