import type { PlaygroundRevealConfig, PlaygroundWaveRevealPosition } from "../types";
import type { LumaGrid } from "./computeBlockGrid";
import {
  DEFAULT_PLAYGROUND_REVEAL_CONFIG,
  normalizePlaygroundRevealConfig,
} from "./playgroundRevealConfig";

export type PlaygroundRevealState = {
  progress: number;
};

export type PlaygroundRevealOptions = {
  config?: PlaygroundRevealConfig;
  progress?: number;
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

export function applyPlaygroundRevealToLumaGrid(
  grid: LumaGrid,
  options: PlaygroundRevealOptions = {},
): LumaGrid {
  const config = normalizePlaygroundRevealConfig(options.config ?? DEFAULT_PLAYGROUND_REVEAL_CONFIG);
  const progress = clamp01(options.progress ?? 1);
  if (progress >= 1 || grid.luma.length === 0) {
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
      const revealAmount = smoothstep(distance - config.wave.softness, distance + config.wave.softness, progress + edgeNoise);
      output[index] = Math.round((grid.luma[index] ?? 0) * revealAmount);
    }
  }

  return { ...grid, luma: output };
}
