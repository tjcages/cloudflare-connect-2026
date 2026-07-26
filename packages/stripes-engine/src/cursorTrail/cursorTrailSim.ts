import type { CursorTrailConfig } from "../config/types";
import { normalizeCursorTrail, DEFAULT_CURSOR_TRAIL } from "../config/normalize";

export type CursorTrailPoint = {
  x: number;
  y: number;
};

export type CursorTrailSample = CursorTrailPoint & {
  alpha: number;
  radius: number;
  pushX: number;
  pushY: number;
  progress: number;
  seed: number;
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

/**
 * Frames the accumulator keeps redrawing after the last particle dies. This one
 * is a count on purpose: it exists to give the ping-ponged cursor field enough
 * *renders* to settle back to zero, so a duration would under-clear at low frame
 * rates and waste draws at high ones.
 */
export const CLEAR_REBUILD_FRAMES = 10;
export const MAX_DT_MS = 48;

/**
 * The frame the trail's per-frame constants are tuned against — damping,
 * emitter smoothing and the one-particle emit floor are all "per 16.67ms".
 * Feeding them `dtScale` powers instead reproduces this frame exactly while
 * holding the trail to one wall-clock behaviour at any refresh rate.
 */
export const REFERENCE_FRAME_MS = 16.67;

export function seededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function pushCenterForDrop(drop: CursorTrailDrop, config: CursorTrailConfig): CursorTrailPoint {
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
  config: CursorTrailConfig,
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
  rawConfig: CursorTrailConfig = DEFAULT_CURSOR_TRAIL,
): { samples: CursorTrailSample[]; changed: boolean } {
  const config = normalizeCursorTrail(rawConfig);
  const dt = Math.max(0, Math.min(MAX_DT_MS, dtMs || REFERENCE_FRAME_MS));
  const hadDrops = state.drops.length > 0;
  const dtScale = dt / REFERENCE_FRAME_MS;

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
    // Powered so the EMA keeps one time constant instead of one per-frame
    // weight: a constant factor decays over 93ms at 30fps and 23ms at 120fps.
    const smoothing = Math.pow(config.emitterVelocitySmoothing, dtScale);
    state.velocity = {
      x: state.velocity.x * smoothing + rawVelocity.x * (1 - smoothing),
      y: state.velocity.y * smoothing + rawVelocity.y * (1 - smoothing),
    };
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    const previous = state.lastEmit ?? state.current;
    const distance = Math.hypot(state.current.x - previous.x, state.current.y - previous.y);
    // The emit floor is one particle per *reference frame*, not per rendered
    // frame, and the burst cap covers the same span — otherwise a 120Hz display
    // lays down twice the particles per second that a 60Hz one does.
    const want = distance / config.particleSpacingPx + dtScale + state.emitRemainder;
    const emitCount = Math.min(Math.max(1, Math.round(config.maxEmitPerTick * dtScale)), Math.floor(want));
    state.emitRemainder = want % 1;

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

  // Damping is a per-reference-frame factor, so a frame worth `dtScale` of one
  // applies it `dtScale` times. Applied once per rendered frame instead, a
  // particle coasts ~4x further at 30fps than at 120fps.
  const damping = Math.pow(config.particleDamping, dtScale);
  const samples: CursorTrailSample[] = [];
  const nextDrops: CursorTrailDrop[] = [];
  for (const drop of state.drops) {
    const ageMs = drop.ageMs + dt;
    if (ageMs >= drop.lifeMs) {
      continue;
    }

    const life = 1 - ageMs / drop.lifeMs;
    const curl = Math.sin(drop.x * 0.017 + drop.y * 0.013 + drop.seed) * drop.spin * dtScale;
    const nextVx = (drop.vx - drop.vy * curl) * damping;
    const nextVy = (drop.vy + drop.vx * curl) * damping;
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
      progress: 1 - life,
      seed: drop.seed,
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
