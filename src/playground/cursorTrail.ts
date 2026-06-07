export type CursorTrailPoint = {
  x: number;
  y: number;
};

export type CursorTrailSample = CursorTrailPoint & {
  alpha: number;
  radius: number;
};

export type CursorTrailVisual = CursorTrailSample & {
  color: number;
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

const BASE_PARTICLE_RADIUS = 13;
const BASE_PARTICLE_ALPHA = 0.42;
const PARTICLE_LIFE_MS = 860;
const CLEAR_REBUILD_FRAMES = 10;
const EMITTER_VELOCITY_SMOOTHING = 0.35;
const PARTICLE_VELOCITY_SCALE = 0.18;
const PARTICLE_TANGENT_VELOCITY = 0.9;
const PARTICLE_DAMPING = 0.96;
const PARTICLE_SPACING_PX = 3;
const MAX_EMIT_PER_TICK = 30;
const MAX_PARTICLES = 560;
const MAX_DT_MS = 48;
const MAGNETIC_RADIUS_SCALE = 1.85;
const MAGNETIC_DISPLACEMENT_PX = 7.5;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function blendChannel(channel: number, alpha: number): number {
  return Math.round(channel + (255 - channel) * alpha);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function falloff(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) {
    return 0;
  }
  const t = 1 - distance / radius;
  return t * t * (3 - 2 * t);
}

function seededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function emitParticle(
  state: CursorTrailState,
  point: CursorTrailPoint,
  emitterVelocity: CursorTrailPoint,
  speed: number,
): CursorTrailDrop {
  const seed = state.nextSeed++;
  const angle = seededUnit(seed, 1) * Math.PI * 2;
  const spread = 1.5 + seededUnit(seed, 2) * 7;
  const tangent = speed > 0 ? { x: -emitterVelocity.y / speed, y: emitterVelocity.x / speed } : { x: 0, y: 0 };
  const side = seededUnit(seed, 3) * 2 - 1;
  return {
    x: point.x + Math.cos(angle) * spread,
    y: point.y + Math.sin(angle) * spread,
    vx: emitterVelocity.x * PARTICLE_VELOCITY_SCALE + tangent.x * side * PARTICLE_TANGENT_VELOCITY,
    vy: emitterVelocity.y * PARTICLE_VELOCITY_SCALE + tangent.y * side * PARTICLE_TANGENT_VELOCITY,
    ageMs: 0,
    lifeMs: PARTICLE_LIFE_MS + seededUnit(seed, 4) * 260,
    radius: BASE_PARTICLE_RADIUS * (0.75 + seededUnit(seed, 5) * 0.8),
    spin: (seededUnit(seed, 6) * 2 - 1) * 0.024,
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
): { samples: CursorTrailSample[]; changed: boolean } {
  const dt = Math.max(0, Math.min(MAX_DT_MS, dtMs || 16.67));
  const hadDrops = state.drops.length > 0;
  const dtScale = dt / 16.67;

  if (state.target) {
    const previousCurrent = state.current;
    state.current = { ...state.target };
    const rawVelocity = {
      x: (state.current.x - previousCurrent.x) / dtScale,
      y: (state.current.y - previousCurrent.y) / dtScale,
    };
    state.velocity = {
      x: state.velocity.x * EMITTER_VELOCITY_SMOOTHING + rawVelocity.x * (1 - EMITTER_VELOCITY_SMOOTHING),
      y: state.velocity.y * EMITTER_VELOCITY_SMOOTHING + rawVelocity.y * (1 - EMITTER_VELOCITY_SMOOTHING),
    };
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    const previous = state.lastEmit ?? state.current;
    const distance = Math.hypot(state.current.x - previous.x, state.current.y - previous.y);
    const emitCount = Math.min(MAX_EMIT_PER_TICK, Math.floor(distance / PARTICLE_SPACING_PX + state.emitRemainder) + 1);
    state.emitRemainder = (distance / PARTICLE_SPACING_PX + state.emitRemainder) % 1;

    for (let i = 0; i < emitCount; i++) {
      const t = emitCount <= 1 ? 1 : i / (emitCount - 1);
      const point = {
        x: previous.x + (state.current.x - previous.x) * t,
        y: previous.y + (state.current.y - previous.y) * t,
      };
      state.drops.push(emitParticle(state, point, state.velocity, speed));
    }
    if (state.drops.length > MAX_PARTICLES) {
      state.drops.splice(0, state.drops.length - MAX_PARTICLES);
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
    const nextVx = (drop.vx - drop.vy * curl) * PARTICLE_DAMPING;
    const nextVy = (drop.vy + drop.vx * curl) * PARTICLE_DAMPING;
    const next = {
      ...drop,
      ageMs,
      vx: nextVx,
      vy: nextVy,
      x: drop.x + nextVx * dtScale,
      y: drop.y + nextVy * dtScale,
    };
    nextDrops.push(next);
    samples.push({
      x: next.x,
      y: next.y,
      radius: next.radius * (0.65 + life * 0.55),
      alpha: BASE_PARTICLE_ALPHA * life * life,
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

export function applyCursorTrailToPixels(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  samples: readonly CursorTrailSample[],
): void {
  if (imageWidth <= 0 || imageHeight <= 0 || samples.length === 0) {
    return;
  }

  const source = new Uint8ClampedArray(pixels);
  const pixelCount = imageWidth * imageHeight;
  const offsetX = new Float32Array(pixelCount);
  const offsetY = new Float32Array(pixelCount);

  for (const sample of samples) {
    const radius = Math.max(0, sample.radius * MAGNETIC_RADIUS_SCALE);
    const alpha = clamp01(sample.alpha);
    if (radius <= 0 || alpha <= 0) {
      continue;
    }

    const minX = Math.max(0, Math.floor(sample.x - radius));
    const maxX = Math.min(imageWidth - 1, Math.ceil(sample.x + radius));
    const minY = Math.max(0, Math.floor(sample.y - radius));
    const maxY = Math.min(imageHeight - 1, Math.ceil(sample.y + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - sample.x;
        const dy = y - sample.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 0 || distance >= radius) {
          continue;
        }

        const force = MAGNETIC_DISPLACEMENT_PX * alpha * falloff(distance, radius);
        const idx = y * imageWidth + x;
        offsetX[idx] += (dx / distance) * force;
        offsetY[idx] += (dy / distance) * force;
      }
    }
  }

  for (let idx = 0; idx < pixelCount; idx++) {
    const dx = offsetX[idx] ?? 0;
    const dy = offsetY[idx] ?? 0;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
      continue;
    }

    const x = idx % imageWidth;
    const y = Math.floor(idx / imageWidth);
    const sourceX = clampInt(x - dx, 0, imageWidth - 1);
    const sourceY = clampInt(y - dy, 0, imageHeight - 1);
    const sourceIdx = (sourceY * imageWidth + sourceX) * 4;
    const pixelIdx = idx * 4;
    pixels[pixelIdx] = source[sourceIdx] ?? 0;
    pixels[pixelIdx + 1] = source[sourceIdx + 1] ?? 0;
    pixels[pixelIdx + 2] = source[sourceIdx + 2] ?? 0;
    pixels[pixelIdx + 3] = source[sourceIdx + 3] ?? 255;
  }

  for (const sample of samples) {
    const radius = Math.max(0, sample.radius);
    const alpha = clamp01(sample.alpha);
    if (radius <= 0 || alpha <= 0) {
      continue;
    }

    const minX = Math.max(0, Math.floor(sample.x - radius));
    const maxX = Math.min(imageWidth - 1, Math.ceil(sample.x + radius));
    const minY = Math.max(0, Math.floor(sample.y - radius));
    const maxY = Math.min(imageHeight - 1, Math.ceil(sample.y + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const distance = Math.hypot(x - sample.x, y - sample.y);
        const pixelAlpha = alpha * falloff(distance, radius);
        if (pixelAlpha <= 0) {
          continue;
        }

        const idx = (y * imageWidth + x) * 4;
        pixels[idx] = blendChannel(pixels[idx] ?? 0, pixelAlpha);
        pixels[idx + 1] = blendChannel(pixels[idx + 1] ?? 0, pixelAlpha);
        pixels[idx + 2] = blendChannel(pixels[idx + 2] ?? 0, pixelAlpha);
      }
    }
  }
}

export function buildCursorTrailVisuals(samples: readonly CursorTrailSample[]): CursorTrailVisual[] {
  void samples;
  return [];
}
