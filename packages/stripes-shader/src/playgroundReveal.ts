import type {
  PlaygroundAssemblyRevealConfig,
  PlaygroundAssemblyRevealOrder,
  PlaygroundWaveRevealConfig,
  PlaygroundWaveRevealPosition,
} from "./playgroundRevealConfig";

export type PlaygroundRevealState = {
  progress: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value >= edge1 ? 1 : 0;
  }
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function resolveWaveRevealGeometry(position: PlaygroundWaveRevealPosition): {
  x: number;
  y: number;
  maxDistance: number;
} {
  const [xPart, yPart] = position === "center" ? ["center", "center"] : position.split(" ");
  const x = xPart === "left" ? 0 : xPart === "right" ? 1 : 0.5;
  const y = yPart === "top" ? 0 : yPart === "bottom" ? 1 : 0.5;
  const maxDistance = Math.max(
    Math.hypot(x, y),
    Math.hypot(1 - x, y),
    Math.hypot(x, 1 - y),
    Math.hypot(1 - x, 1 - y),
    0.0001,
  );
  return { x, y, maxDistance };
}

function fract(value: number): number {
  return value - Math.floor(value);
}

// Same float-hash recipe as revealCellNoise in stripeFilterShaders.ts so the CPU letters
// mask agrees with the GPU stripe mask.
function cellNoise(col: number, row: number, scale: number): number {
  const s = Math.max(0.1, scale);
  const px = Math.floor(col / s);
  const py = Math.floor(row / s);
  let p3x = fract(px * 0.1031);
  let p3y = fract(py * 0.103);
  let p3z = fract(px * 0.0973);
  const d = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x += d;
  p3y += d;
  p3z += d;
  return fract((p3x + p3y) * p3z);
}

/**
 * Wave reveal amount for a cell — the exact per-cell mask the shader applies to the
 * bucketing luma, shared with the CPU letters pass and tests.
 */
export function waveRevealAmountAtCell(
  col: number,
  row: number,
  cols: number,
  rows: number,
  progress: number,
  wave: PlaygroundWaveRevealConfig,
  bandRamp = 0,
): number {
  const geometry = resolveWaveRevealGeometry(wave.position);
  const x = cols <= 1 ? 0.5 : (col + 0.5) / cols;
  const y = rows <= 1 ? 0.5 : (row + 0.5) / rows;
  const normalizedDistance = Math.hypot(x - geometry.x, y - geometry.y) / geometry.maxDistance;
  const edgeNoise = (cellNoise(col, row, wave.noiseScale) - 0.5) * wave.waviness;
  const softness = Math.max(0, wave.softness);
  const ramp = Math.max(0, bandRamp);
  // Progress may exceed 1: the reveal animates past its nominal end so trailing band
  // climbs ease out instead of snapping at the deadline.
  return smoothstep(
    normalizedDistance - softness,
    normalizedDistance + softness + ramp,
    Math.max(0, progress) + edgeNoise,
  );
}

/** Extra progress past 1 the reveal needs so every cell finishes its feather/ramp naturally. */
export function resolveRevealOvershoot(wave: PlaygroundWaveRevealConfig, bandRamp: number): number {
  return Math.max(0, wave.softness) + Math.max(0, bandRamp) + 0.5 * wave.waviness;
}

// Progress past 1 the assembly keeps animating so landed puzzle cells finish sharpening
// from circle → tile (post-landing settle) before the static field takes over.
export const ASSEMBLY_SETTLE = 0.06;
const ASSEMBLY_MAX_CENTER_DIST = 0.70710678; // hypot(0.5, 0.5)

/** 0..1 ordering key for a cell: 0 assembles first, 1 last. Mirrors the GPU assembly branch. */
export function assemblyOrderNorm(
  col: number,
  row: number,
  cols: number,
  rows: number,
  order: PlaygroundAssemblyRevealOrder,
): number {
  if (order === "sweep") {
    return cols <= 1 ? 0 : clamp01(col / (cols - 1));
  }
  if (order === "random") {
    return cellNoise(col, row, 1);
  }
  const cx = cols <= 1 ? 0.5 : (col + 0.5) / cols;
  const cy = rows <= 1 ? 0.5 : (row + 0.5) / rows;
  const centerNorm = clamp01(Math.hypot(cx - 0.5, cy - 0.5) / ASSEMBLY_MAX_CENTER_DIST);
  return order === "edges" ? 1 - centerNorm : centerNorm;
}

/**
 * Per-cell stripe reveal mask for the assembly (fly-in) reveal — the stripe materializes
 * when its circle lands (arrival = emitterStart + flight). Kept in sync with the
 * uRevealMode == 2 branch in stripeFilterShaders.ts.
 */
export function assemblyRevealAmountAtCell(
  col: number,
  row: number,
  cols: number,
  rows: number,
  progress: number,
  assembly: PlaygroundAssemblyRevealConfig,
  bandRamp = 0,
): number {
  const o = assemblyOrderNorm(col, row, cols, rows, assembly.order);
  const dur = Math.max(1, assembly.durationMs);
  const speedMin = Math.max(0, assembly.speedMinMs);
  const speedMax = Math.max(speedMin, assembly.speedMaxMs);
  const avgTotal = Math.min(0.98, Math.max(0.05, (speedMin + speedMax) / 2 / dur));
  const spread = Math.max(0, assembly.spread);
  const arrival = o * (1 - avgTotal) * spread + avgTotal;
  return smoothstep(arrival, arrival + Math.max(0, bandRamp), Math.max(0, progress));
}

/** Extra progress past 1 the assembly reveal needs so glow settle + band climbs finish. */
export function resolveAssemblyRevealOvershoot(bandRamp: number): number {
  return Math.max(ASSEMBLY_SETTLE, Math.max(0, bandRamp));
}
