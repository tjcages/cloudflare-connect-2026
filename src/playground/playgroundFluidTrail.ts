export type PlaygroundFluidSplat = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  timeMs: number;
};

export type PlaygroundFluidTrailInput = {
  splat: PlaygroundFluidSplat;
  lastPoint: { x: number; y: number; timeMs: number } | null;
  consumeSplat: () => void;
};

const EMPTY_SPLAT: PlaygroundFluidSplat = {
  active: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  timeMs: 0,
};

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

export function createPlaygroundFluidTrailInput(): PlaygroundFluidTrailInput {
  const input: PlaygroundFluidTrailInput = {
    splat: { ...EMPTY_SPLAT },
    lastPoint: null,
    consumeSplat: () => {
      input.splat = { ...EMPTY_SPLAT };
    },
  };
  return input;
}

export function pushPlaygroundFluidPointer(
  input: PlaygroundFluidTrailInput,
  point: { x: number; y: number },
  display: { width: number; height: number },
  nowMs: number,
) {
  const width = Math.max(1, display.width);
  const height = Math.max(1, display.height);
  const x = clampNumber(point.x / width, 0, 1, 0);
  const y = clampNumber(point.y / height, 0, 1, 0);
  const previous = input.lastPoint;
  if (!previous) {
    input.lastPoint = { x, y, timeMs: nowMs };
    input.splat = { ...EMPTY_SPLAT };
    return;
  }

  const dtSec = Math.max(0.008, (nowMs - previous.timeMs) / 1000);
  const rawVx = (x - previous.x) / dtSec;
  const rawVy = (y - previous.y) / dtSec;

  input.splat = {
    active: true,
    x,
    y,
    vx: clampNumber(rawVx, -1, 1, 0),
    vy: clampNumber(rawVy, -1, 1, 0),
    timeMs: nowMs,
  };
  input.lastPoint = { x, y, timeMs: nowMs };
}

export function flattenPlaygroundFluidSplat(input: PlaygroundFluidTrailInput): number[] {
  if (!input.splat.active) {
    return [0, 0, 0, 0];
  }
  return [input.splat.x, input.splat.y, input.splat.vx, input.splat.vy];
}
