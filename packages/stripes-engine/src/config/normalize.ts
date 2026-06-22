import type { Transform, FieldConfig, Background, Grid } from "./types";

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
const num = (v: unknown, dflt: number): number => (typeof v === "number" && Number.isFinite(v) ? v : dflt);

export const DEFAULT_TRANSFORM: Transform = { fit: "stretch", zoom: 1, panX: 0, panY: 0 };
export function normalizeTransform(i: Partial<Transform> = {}): Transform {
  const fit = i.fit === "contain" || i.fit === "cover" || i.fit === "stretch" ? i.fit : "stretch";
  return {
    fit,
    zoom: clamp(num(i.zoom, 1), 0.1, 8),
    panX: clamp(num(i.panX, 0), -1, 1),
    panY: clamp(num(i.panY, 0), -1, 1),
  };
}

export const DEFAULT_FIELD: FieldConfig = { mode: "luminance" };
export function normalizeField(i: Partial<FieldConfig> = {}): FieldConfig {
  return { mode: i.mode === "overlay" ? "overlay" : "luminance" };
}

export const DEFAULT_BACKGROUND: Background = { color: 0x000000 };
export function normalizeBackground(i: Partial<Background> = {}): Background {
  return { color: Math.round(clamp(num(i.color, 0), 0, 0xffffff)) };
}

export const DEFAULT_GRID: Grid = {
  cellWidth: 7,
  cellHeight: 7,
  gapX: 0,
  gapY: 0,
  cornerRadius: 0,
  orientation: "vertical",
};
export function normalizeGrid(i: Partial<Grid> = {}): Grid {
  const cellWidth = clamp(Math.round(num(i.cellWidth, 7)), 1, 64);
  const cellHeight = clamp(Math.round(num(i.cellHeight, 7)), 1, 64);
  return {
    cellWidth,
    cellHeight,
    gapX: clamp(num(i.gapX, 0), 0, cellWidth),
    gapY: clamp(num(i.gapY, 0), 0, cellHeight),
    cornerRadius: clamp(num(i.cornerRadius, 0), 0, Math.max(cellWidth, cellHeight)),
    orientation: i.orientation === "horizontal" ? "horizontal" : "vertical",
  };
}
