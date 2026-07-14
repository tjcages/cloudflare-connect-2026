import { clamp01 } from "./math";

export function intToHex(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

export function hexToInt(hex: string | null | undefined): number {
  if (typeof hex !== "string") return 0;
  const parsed = Number.parseInt(hex.replace(/^#/, ""), 16);
  return Number.isFinite(parsed) ? parsed & 0xffffff : 0;
}

export function normalizeHexString(value: unknown, fallback: string | null = null): string | null {
  if (typeof value !== "string") return fallback;
  const raw = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return fallback;
  return `#${raw.toLowerCase()}`;
}

export function grayLevelToColor(level: number): number {
  const channel = Math.round(clamp01(level) * 255);
  return (channel << 16) | (channel << 8) | channel;
}

export function grayLevelFromColor(color: number): number {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return clamp01((r + g + b) / (255 * 3));
}
