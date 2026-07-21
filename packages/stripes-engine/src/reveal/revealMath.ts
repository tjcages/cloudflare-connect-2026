import type { WavePosition, RevealConfig } from "../config/types";

export const WAVE_POSITIONS: readonly WavePosition[] = [
  "center",
  "left top",
  "center top",
  "right top",
  "left center",
  "right center",
  "left bottom",
  "center bottom",
  "right bottom",
];

export function originForPosition(p: WavePosition): [number, number] {
  const [xPart, yPart] = p === "center" ? ["center", "center"] : p.split(" ");
  const x = xPart === "left" ? 0 : xPart === "right" ? 1 : 0.5;
  const y = yPart === "top" ? 0 : yPart === "bottom" ? 1 : 0.5;
  return [x, y];
}

function fract(v: number): number {
  return v - Math.floor(v);
}

function smoothstep(a: number, b: number, x: number): number {
  if (a === b) return x >= b ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function cellNoise(col: number, row: number, scale: number): number {
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

export function assemblyOrderNorm(col: number, row: number, cols: number, rows: number): number {
  const cx = cols <= 1 ? 0.5 : (col + 0.5) / cols;
  const cy = rows <= 1 ? 0.5 : (row + 0.5) / rows;
  const maxDist = Math.hypot(0.5, 0.5);
  return Math.hypot(cx - 0.5, cy - 0.5) / maxDist;
}

export function resolveRevealDurationMs(r: RevealConfig): number {
  if (r.type === "wave") return r.wave.durationMs;
  if (r.type === "whirlpool") return r.whirlpool.durationMs;
  if (r.type === "water") return r.water.durationMs + r.water.settleMs;
  if (r.type === "blackhole") {
    const b = r.blackhole;
    return b.formMs + b.staggerMs + b.speedMaxMs + b.collapseMs;
  }
  const block = r.type === "assembly" ? r.assembly : r[r.type];
  return block.staggerMs + block.speedMaxMs;
}

export function resolveBandRamp(durationMs: number): number {
  return Math.min(0.4, Math.max(0.04, 330 / durationMs));
}

export function waveRevealAt(
  col: number,
  row: number,
  cols: number,
  rows: number,
  progress: number,
  wave: RevealConfig["wave"],
  bandRamp: number,
): number {
  const [ox, oy] = originForPosition(wave.position);
  const maxDistance = Math.max(
    Math.hypot(ox, oy),
    Math.hypot(1 - ox, oy),
    Math.hypot(ox, 1 - oy),
    Math.hypot(1 - ox, 1 - oy),
    0.0001,
  );
  const x = cols <= 1 ? 0.5 : (col + 0.5) / cols;
  const y = rows <= 1 ? 0.5 : (row + 0.5) / rows;
  const normalizedDistance = Math.hypot(x - ox, y - oy) / maxDistance;
  const edgeNoise = (cellNoise(col, row, 0.1) - 0.5) * wave.waviness;
  const softness = Math.max(0, wave.softness);
  const ramp = Math.max(0, bandRamp);
  return smoothstep(
    normalizedDistance - softness,
    normalizedDistance + softness + ramp,
    Math.max(0, progress) + edgeNoise,
  );
}

export function assemblyRevealAt(
  col: number,
  row: number,
  cols: number,
  rows: number,
  progress: number,
  assembly: RevealConfig["assembly"],
  bandRamp: number,
): number {
  const dur = Math.max(1, assembly.staggerMs + assembly.speedMaxMs);
  const speedMin = Math.max(0, assembly.speedMinMs);
  const speedMax = Math.max(speedMin, assembly.speedMaxMs);
  const avgTotal = Math.min(0.98, Math.max(0.05, (speedMin + speedMax) / 2 / dur));
  const o = assemblyOrderNorm(col, row, cols, rows);
  const start = (assembly.staggerMs / dur) * o;
  const arrival = start + avgTotal;
  return smoothstep(arrival, arrival + Math.max(0, bandRamp), Math.max(0, progress));
}

export function serpentinePoint(progress: number, rows: number, wobble: number): { x: number; y: number } {
  const r = Math.max(1, Math.round(rows));
  const t = Math.min(1, Math.max(0, progress));
  const f = Math.min(r - 1e-6, t * r);
  const row = Math.floor(f);
  const frac = f - row;
  const x = row % 2 === 0 ? frac : 1 - frac;
  const half = 1 / (2 * r);
  const yBase = half + t * (1 - 2 * half);
  const wobbleAmp = (wobble * 0.35) / r;
  const wob = Math.sin(frac * Math.PI * 5 + row * 1.7) * wobbleAmp;
  const y = Math.min(1, Math.max(0, yBase + wob));
  return { x, y };
}
