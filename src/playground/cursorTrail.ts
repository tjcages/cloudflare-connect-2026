import {
  DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  normalizePlaygroundCursorTrailConfig,
  type PlaygroundCursorTrailConfig,
} from "./playgroundCursorTrailConfig";

export type CursorTrailPoint = {
  x: number;
  y: number;
};

export type CursorTrailSample = CursorTrailPoint & {
  alpha: number;
  radius: number;
  pushX: number;
  pushY: number;
};

export type CursorTrailPixelBounds = {
  dirtyMinX: number;
  dirtyMinY: number;
  dirtyMaxX: number;
  dirtyMaxY: number;
};

type CursorTrailDrop = CursorTrailPoint & {
  ageMs: number;
  lifeMs: number;
  radius: number;
  vx: number;
  vy: number;
  spin: number;
  seed: number;
};

export type CursorTrailState = {
  current: CursorTrailPoint;
  velocity: CursorTrailPoint;
  target: CursorTrailPoint | null;
  drops: CursorTrailDrop[];
  hasPointer: boolean;
  clearFramesRemaining: number;
  emitRemainder: number;
  lastEmit: CursorTrailPoint | null;
  nextSeed: number;
};

const CLEAR_REBUILD_FRAMES = 10;
const MAX_DT_MS = 48;

function seededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function mergeCursorTrailPixelBounds(
  a: CursorTrailPixelBounds,
  b: CursorTrailPixelBounds,
): CursorTrailPixelBounds {
  return {
    dirtyMinX: Math.min(a.dirtyMinX, b.dirtyMinX),
    dirtyMinY: Math.min(a.dirtyMinY, b.dirtyMinY),
    dirtyMaxX: Math.max(a.dirtyMaxX, b.dirtyMaxX),
    dirtyMaxY: Math.max(a.dirtyMaxY, b.dirtyMaxY),
  };
}

export function resolveCursorTrailRebuildBounds(
  current: CursorTrailPixelBounds | null,
  previous: CursorTrailPixelBounds | null,
): CursorTrailPixelBounds | null {
  if (current && previous) {
    return mergeCursorTrailPixelBounds(current, previous);
  }
  return current ?? previous;
}

function pushCenterForDrop(drop: CursorTrailDrop, config: PlaygroundCursorTrailConfig): CursorTrailPoint {
  const speed = Math.hypot(drop.vx, drop.vy);
  const lagX = speed > 0 ? (-drop.vx / speed) * config.pushLagPx : 0;
  const lagY = speed > 0 ? (-drop.vy / speed) * config.pushLagPx : 0;
  const wobbleX = Math.cos(drop.seed * 1.37 + drop.ageMs * 0.01) * config.pushWobblePx;
  const wobbleY = Math.sin(drop.seed * 1.91 + drop.ageMs * 0.012) * config.pushWobblePx;
  return {
    x: drop.x + lagX + wobbleX,
    y: drop.y + lagY + wobbleY,
  };
}

function emitParticle(
  state: CursorTrailState,
  point: CursorTrailPoint,
  emitterVelocity: CursorTrailPoint,
  speed: number,
  config: PlaygroundCursorTrailConfig,
): CursorTrailDrop {
  const seed = state.nextSeed++;
  const angle = seededUnit(seed, 1) * Math.PI * 2;
  const spread = config.spreadMinPx + seededUnit(seed, 2) * (config.spreadMaxPx - config.spreadMinPx);
  const tangent = speed > 0 ? { x: -emitterVelocity.y / speed, y: emitterVelocity.x / speed } : { x: 0, y: 0 };
  const side = seededUnit(seed, 3) * 2 - 1;
  return {
    x: point.x + Math.cos(angle) * spread,
    y: point.y + Math.sin(angle) * spread,
    vx: emitterVelocity.x * config.particleVelocityScale + tangent.x * side * config.particleTangentVelocity,
    vy: emitterVelocity.y * config.particleVelocityScale + tangent.y * side * config.particleTangentVelocity,
    ageMs: 0,
    lifeMs: config.particleLifeMs + seededUnit(seed, 4) * config.particleLifeJitterMs,
    radius: config.particleRadius * (0.75 + seededUnit(seed, 5) * 0.8),
    spin: (seededUnit(seed, 6) * 2 - 1) * config.spinStrength,
    seed,
  };
}

export function createCursorTrailState(): CursorTrailState {
  return {
    current: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    target: null,
    drops: [],
    hasPointer: false,
    clearFramesRemaining: 0,
    emitRemainder: 0,
    lastEmit: null,
    nextSeed: 1,
  };
}

export function setCursorTrailTarget(state: CursorTrailState, target: CursorTrailPoint | null): void {
  state.target = target;
  if (!target) {
    state.hasPointer = false;
    return;
  }

  if (!state.hasPointer) {
    state.current = { ...target };
    state.velocity = { x: 0, y: 0 };
    state.lastEmit = { ...target };
  }
  state.hasPointer = true;
}

export function updateCursorTrail(
  state: CursorTrailState,
  dtMs: number,
  rawConfig: PlaygroundCursorTrailConfig = DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
): { samples: CursorTrailSample[]; changed: boolean } {
  const config = normalizePlaygroundCursorTrailConfig(rawConfig);
  const dt = Math.max(0, Math.min(MAX_DT_MS, dtMs || 16.67));
  const hadDrops = state.drops.length > 0;
  const dtScale = dt / 16.67;

  if (!config.enabled) {
    state.drops = [];
    state.emitRemainder = 0;
    if (hadDrops) {
      state.clearFramesRemaining = CLEAR_REBUILD_FRAMES;
    }
    const isClearing = state.clearFramesRemaining > 0;
    if (isClearing) {
      state.clearFramesRemaining--;
    }
    return { samples: [], changed: isClearing };
  }

  if (state.target) {
    const previousCurrent = state.current;
    state.current = { ...state.target };
    const rawVelocity = {
      x: (state.current.x - previousCurrent.x) / dtScale,
      y: (state.current.y - previousCurrent.y) / dtScale,
    };
    state.velocity = {
      x: state.velocity.x * config.emitterVelocitySmoothing + rawVelocity.x * (1 - config.emitterVelocitySmoothing),
      y: state.velocity.y * config.emitterVelocitySmoothing + rawVelocity.y * (1 - config.emitterVelocitySmoothing),
    };
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    const previous = state.lastEmit ?? state.current;
    const distance = Math.hypot(state.current.x - previous.x, state.current.y - previous.y);
    const emitCount = Math.min(
      config.maxEmitPerTick,
      Math.floor(distance / config.particleSpacingPx + state.emitRemainder) + 1,
    );
    state.emitRemainder = (distance / config.particleSpacingPx + state.emitRemainder) % 1;

    for (let i = 0; i < emitCount; i++) {
      const t = emitCount <= 1 ? 1 : i / (emitCount - 1);
      const point = {
        x: previous.x + (state.current.x - previous.x) * t,
        y: previous.y + (state.current.y - previous.y) * t,
      };
      state.drops.push(emitParticle(state, point, state.velocity, speed, config));
    }
    state.lastEmit = { ...state.current };
  }

  const samples: CursorTrailSample[] = [];
  const nextDrops: CursorTrailDrop[] = [];
  for (const drop of state.drops) {
    const ageMs = drop.ageMs + dt;
    if (ageMs >= drop.lifeMs) {
      continue;
    }

    const life = 1 - ageMs / drop.lifeMs;
    const curl = Math.sin(drop.x * 0.017 + drop.y * 0.013 + drop.seed) * drop.spin * dtScale;
    const nextVx = (drop.vx - drop.vy * curl) * config.particleDamping;
    const nextVy = (drop.vy + drop.vx * curl) * config.particleDamping;
    const next = {
      ...drop,
      ageMs,
      vx: nextVx,
      vy: nextVy,
      x: drop.x + nextVx * dtScale,
      y: drop.y + nextVy * dtScale,
    };
    const pushCenter = pushCenterForDrop(next, config);
    nextDrops.push(next);
    samples.push({
      x: next.x,
      y: next.y,
      pushX: pushCenter.x,
      pushY: pushCenter.y,
      radius: next.radius * (config.densityRadiusMinScale + life * config.densityRadiusLifeScale),
      alpha: config.particleAlpha * life * life,
    });
  }
  state.drops = nextDrops;

  if (hadDrops && nextDrops.length === 0) {
    state.clearFramesRemaining = CLEAR_REBUILD_FRAMES;
  }

  const isClearing = samples.length === 0 && state.clearFramesRemaining > 0;
  if (isClearing) {
    state.clearFramesRemaining--;
  }

  return {
    samples,
    changed: samples.length > 0 || isClearing,
  };
}

export function downsamplePixelsNearest(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  target: Uint8ClampedArray,
  targetWidth: number,
  targetHeight: number,
): void {
  for (let y = 0; y < targetHeight; y++) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / targetHeight));
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / targetWidth));
      const sourceIdx = (sourceY * sourceWidth + sourceX) * 4;
      const targetIdx = (y * targetWidth + x) * 4;
      target[targetIdx] = source[sourceIdx] ?? 0;
      target[targetIdx + 1] = source[sourceIdx + 1] ?? 0;
      target[targetIdx + 2] = source[sourceIdx + 2] ?? 0;
      target[targetIdx + 3] = source[sourceIdx + 3] ?? 255;
    }
  }
}

export function upscalePixelsNearest(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  target: Uint8ClampedArray,
  targetWidth: number,
  targetHeight: number,
): void {
  upscalePixelsNearestRegion(source, sourceWidth, sourceHeight, target, targetWidth, targetHeight, {
    dirtyMinX: 0,
    dirtyMinY: 0,
    dirtyMaxX: targetWidth - 1,
    dirtyMaxY: targetHeight - 1,
  });
}

/** Nearest-neighbor upscale for one display rectangle (reuses the full-frame mapping). */
export function upscalePixelsNearestRegion(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  target: Uint8ClampedArray,
  targetWidth: number,
  targetHeight: number,
  bounds: CursorTrailPixelBounds,
): void {
  const minX = Math.max(0, Math.floor(bounds.dirtyMinX));
  const minY = Math.max(0, Math.floor(bounds.dirtyMinY));
  const maxX = Math.min(targetWidth - 1, Math.ceil(bounds.dirtyMaxX));
  const maxY = Math.min(targetHeight - 1, Math.ceil(bounds.dirtyMaxY));
  if (maxX < minX || maxY < minY) {
    return;
  }

  for (let y = minY; y <= maxY; y++) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / targetHeight));
    for (let x = minX; x <= maxX; x++) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / targetWidth));
      const sourceIdx = (sourceY * sourceWidth + sourceX) * 4;
      const targetIdx = (y * targetWidth + x) * 4;
      target[targetIdx] = source[sourceIdx] ?? 0;
      target[targetIdx + 1] = source[sourceIdx + 1] ?? 0;
      target[targetIdx + 2] = source[sourceIdx + 2] ?? 0;
      target[targetIdx + 3] = source[sourceIdx + 3] ?? 255;
    }
  }
}
