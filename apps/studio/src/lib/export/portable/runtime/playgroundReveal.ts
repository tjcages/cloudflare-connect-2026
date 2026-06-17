import type {
  PlaygroundRandomColumnsRevealConfig,
  PlaygroundRevealConfig,
  PlaygroundWaveRevealPosition,
} from "../types";
import type { LumaGrid } from "./computeBlockGrid";
import { DEFAULT_PLAYGROUND_REVEAL_CONFIG, normalizePlaygroundRevealConfig } from "./playgroundRevealConfig";

export type PlaygroundRevealState = {
  progress: number;
};

export type PlaygroundRevealOptions = {
  config?: PlaygroundRevealConfig;
  progress?: number;
  replayKey?: number;
};

export type RandomColumnRevealMultiplierInput = {
  x: number;
  col: number;
  cols: number;
  cellWidth: number;
  progress: number;
  config: PlaygroundRandomColumnsRevealConfig;
  ranks: Uint32Array;
};

export type RandomColumnRevealProgressInput = {
  col: number;
  cols: number;
  progress: number;
  stagger: number;
  ranks: Uint32Array;
};

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value >= edge1 ? 1 : 0;
  }
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function cubicBezierCoordinate(p1: number, p2: number, t: number): number {
  const inverseT = 1 - t;
  return 3 * inverseT * inverseT * t * p1 + 3 * inverseT * t * t * p2 + t * t * t;
}

function cubicBezierEasing(x1: number, y1: number, x2: number, y2: number, value: number): number {
  const x = clamp01(value);
  let low = 0;
  let high = 1;
  let t = x;
  for (let i = 0; i < 12; i++) {
    const currentX = cubicBezierCoordinate(x1, x2, t);
    if (Math.abs(currentX - x) < 0.0001) {
      break;
    }
    if (currentX < x) {
      low = t;
    } else {
      high = t;
    }
    t = (low + high) / 2;
  }
  return cubicBezierCoordinate(y1, y2, t);
}

export function randomColumnShiftReturnEasing(progress: number): number {
  return cubicBezierEasing(0.6, 0.6, 0, 1, progress);
}

function resolveWaveOrigin(position: PlaygroundWaveRevealPosition): { x: number; y: number } {
  const [xPart, yPart] = position === "center" ? ["center", "center"] : position.split(" ");
  return {
    x: xPart === "left" ? 0 : xPart === "right" ? 1 : 0.5,
    y: yPart === "top" ? 0 : yPart === "bottom" ? 1 : 0.5,
  };
}

function cellNoise(col: number, row: number, scale: number): number {
  const sampleX = Math.floor(col / Math.max(0.1, scale));
  const sampleY = Math.floor(row / Math.max(0.1, scale));
  const seed = sampleX * 374_761_393 + sampleY * 668_265_263;
  const mixed = (seed ^ (seed >> 13)) * 1_274_126_177;
  return ((mixed ^ (mixed >> 16)) >>> 0) / 0xffffffff;
}

function hashUint(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 2_246_822_507);
  x ^= x >>> 13;
  x = Math.imul(x, 3_266_489_909);
  x ^= x >>> 16;
  return x >>> 0;
}

export function buildRandomColumnRevealRanks(cols: number, replayKey = 0): Uint32Array {
  const safeCols = Math.max(0, Math.round(cols));
  const entries = Array.from({ length: safeCols }, (_, col) => ({
    col,
    score: hashUint(col + Math.imul(Math.round(replayKey), 1_048_583)),
  }));
  entries.sort((a, b) => a.score - b.score || a.col - b.col);
  const ranks = new Uint32Array(safeCols);
  entries.forEach((entry, rank) => {
    ranks[entry.col] = rank;
  });
  return ranks;
}

export function randomColumnLocalProgress(input: RandomColumnRevealProgressInput): number {
  const progress = clamp01(input.progress);
  const rank = input.ranks[input.col] ?? 0;
  const rankProgress = input.cols <= 1 ? 0 : rank / Math.max(1, input.cols - 1);
  const start = rankProgress * input.stagger;
  return clamp01((progress - start) / Math.max(0.0001, 1 - start));
}

export function randomColumnRevealMultiplier(input: RandomColumnRevealMultiplierInput): number {
  const localProgress = randomColumnLocalProgress({
    col: input.col,
    cols: input.cols,
    progress: input.progress,
    stagger: input.config.stagger,
    ranks: input.ranks,
  });
  if (localProgress >= 1) {
    return 1;
  }
  const localX = input.x - input.col * input.cellWidth;
  const centerX = input.cellWidth / 2;
  const halfOverlayWidth = (input.cellWidth / 2) * (1 - localProgress);
  const distanceFromOverlayEdge = halfOverlayWidth - Math.abs(localX - centerX);
  return distanceFromOverlayEdge >= 0 ? 0 : 1;
}

function randomColumnShiftRows(col: number, rows: number, yShift: number, replayKey = 0): number {
  if (rows <= 1 || yShift <= 0) {
    return 0;
  }
  const maxShift = Math.max(1, Math.round(rows * yShift));
  const magnitude = 1 + (hashUint(col + Math.imul(Math.round(replayKey), 4099)) % maxShift);
  const sign = hashUint(col + Math.imul(Math.round(replayKey), 8191) + 17) % 2 === 0 ? -1 : 1;
  return magnitude * sign;
}

function shiftedLumaAt(grid: LumaGrid, col: number, sourceRow: number): number {
  if (sourceRow < 0 || sourceRow >= grid.rows) {
    return 0;
  }
  return grid.luma[sourceRow * grid.cols + col] ?? 0;
}

function applyRandomColumnsShiftReveal(
  grid: LumaGrid,
  progress: number,
  replayKey = 0,
  config: PlaygroundRandomColumnsRevealConfig,
): LumaGrid {
  const ranks = buildRandomColumnRevealRanks(grid.cols, replayKey);
  const output = new Uint8Array(grid.luma.length);
  for (let col = 0; col < grid.cols; col++) {
    const localProgress = randomColumnLocalProgress({ col, cols: grid.cols, progress, stagger: config.stagger, ranks });
    const offset =
      randomColumnShiftRows(col, grid.rows, config.yShift, replayKey) *
      (1 - randomColumnShiftReturnEasing(localProgress));
    for (let row = 0; row < grid.rows; row++) {
      const sourceY = row - offset;
      const top = Math.floor(sourceY);
      const fraction = sourceY - top;
      const a = shiftedLumaAt(grid, col, top);
      const b = shiftedLumaAt(grid, col, top + 1);
      output[row * grid.cols + col] = Math.round(a * (1 - fraction) + b * fraction);
    }
  }
  return { ...grid, luma: output };
}

export function applyPlaygroundRevealToLumaGrid(grid: LumaGrid, options: PlaygroundRevealOptions = {}): LumaGrid {
  const config = normalizePlaygroundRevealConfig(options.config ?? DEFAULT_PLAYGROUND_REVEAL_CONFIG);
  const progress = clamp01(options.progress ?? 1);
  if (config.preset !== "wave" || progress >= 1 || grid.luma.length === 0) {
    if (config.preset === "randomColumns" && progress < 1 && grid.luma.length > 0 && config.randomColumns.yShift > 0) {
      return applyRandomColumnsShiftReveal(grid, progress, options.replayKey, config.randomColumns);
    }
    return grid;
  }

  const output = new Uint8Array(grid.luma);
  const origin = resolveWaveOrigin(config.wave.position);
  const maxDistance = Math.max(
    Math.hypot(origin.x, origin.y),
    Math.hypot(1 - origin.x, origin.y),
    Math.hypot(origin.x, 1 - origin.y),
    Math.hypot(1 - origin.x, 1 - origin.y),
    0.0001,
  );

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const index = row * grid.cols + col;
      const x = grid.cols <= 1 ? 0.5 : (col + 0.5) / grid.cols;
      const y = grid.rows <= 1 ? 0.5 : (row + 0.5) / grid.rows;
      const distance = Math.hypot(x - origin.x, y - origin.y) / maxDistance;
      const edgeNoise = (cellNoise(col, row, config.wave.noiseScale) - 0.5) * config.wave.waviness;
      const revealAmount = smoothstep(
        distance - config.wave.softness,
        distance + config.wave.softness,
        progress + edgeNoise,
      );
      output[index] = Math.round((grid.luma[index] ?? 0) * revealAmount);
    }
  }

  return { ...grid, luma: output };
}
