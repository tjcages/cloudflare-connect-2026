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
};

export type CursorTrailState = {
  current: CursorTrailPoint;
  velocity: CursorTrailPoint;
  target: CursorTrailPoint | null;
  drops: CursorTrailDrop[];
  hasPointer: boolean;
  clearFramesRemaining: number;
};

const DEFAULT_TRAIL_RADIUS = 26;
const DEFAULT_TRAIL_ALPHA = 0.58;
const TRAIL_VISUAL_HALO_COLOR = 0x111111;
const TRAIL_VISUAL_CORE_COLOR = 0xffffff;
const DROP_LIFE_MS = 420;
const CLEAR_REBUILD_FRAMES = 6;
const SPRING_STIFFNESS = 0.018;
const SPRING_DAMPING = 0.74;
const MAX_DT_MS = 48;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function blendChannel(channel: number, alpha: number): number {
  return Math.round(channel + (255 - channel) * alpha);
}

function falloff(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) {
    return 0;
  }
  const t = 1 - distance / radius;
  return t * t * (3 - 2 * t);
}

export function createCursorTrailState(): CursorTrailState {
  return {
    current: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    target: null,
    drops: [],
    hasPointer: false,
    clearFramesRemaining: 0,
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
  }
  state.hasPointer = true;
}

export function updateCursorTrail(
  state: CursorTrailState,
  dtMs: number,
): { samples: CursorTrailSample[]; changed: boolean } {
  const dt = Math.max(0, Math.min(MAX_DT_MS, dtMs || 16.67));
  const hadDrops = state.drops.length > 0;

  if (state.target) {
    const spring = SPRING_STIFFNESS * dt;
    state.velocity.x = (state.velocity.x + (state.target.x - state.current.x) * spring) * SPRING_DAMPING;
    state.velocity.y = (state.velocity.y + (state.target.y - state.current.y) * spring) * SPRING_DAMPING;
    state.current.x += state.velocity.x;
    state.current.y += state.velocity.y;
    state.drops.push({
      x: state.current.x,
      y: state.current.y,
      ageMs: 0,
      lifeMs: DROP_LIFE_MS,
      radius: DEFAULT_TRAIL_RADIUS,
    });
  }

  const samples: CursorTrailSample[] = [];
  const nextDrops: CursorTrailDrop[] = [];
  for (const drop of state.drops) {
    const ageMs = drop.ageMs + dt;
    if (ageMs >= drop.lifeMs) {
      continue;
    }

    const life = 1 - ageMs / drop.lifeMs;
    nextDrops.push({ ...drop, ageMs });
    samples.push({
      x: drop.x,
      y: drop.y,
      radius: drop.radius * (0.72 + life * 0.28),
      alpha: DEFAULT_TRAIL_ALPHA * life * life,
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
  const visuals: CursorTrailVisual[] = [];
  for (const sample of samples) {
    visuals.push({
      x: sample.x,
      y: sample.y,
      radius: sample.radius * 1.4,
      alpha: clamp01(sample.alpha * 0.3),
      color: TRAIL_VISUAL_HALO_COLOR,
    });
    visuals.push({
      x: sample.x,
      y: sample.y,
      radius: sample.radius,
      alpha: clamp01(sample.alpha * 0.7),
      color: TRAIL_VISUAL_CORE_COLOR,
    });
  }
  return visuals;
}
