import type { Transform, Background, Grid, Adjustments, Stripe, EngineConfig } from "./types";

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

export const DEFAULT_BACKGROUND: Background = { color: 0xffffff };
export function normalizeBackground(i: Partial<Background> = {}): Background {
  return { color: Math.round(clamp(num(i.color, 0xffffff), 0, 0xffffff)) };
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

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  exposure: 0,
  contrast: 1,
  blackPoint: 0,
  whitePoint: 1,
  gamma: 1,
  invert: false,
  posterizeLevels: 0,
  thresholdBias: 0,
  noiseAmount: 0,
  blurRadius: 0,
  sharpenAmount: 0,
};
export function normalizeAdjustments(i: Partial<Adjustments> = {}): Adjustments {
  const blackPoint = clamp(num(i.blackPoint, 0), 0, 1);
  return {
    brightness: clamp(num(i.brightness, 0), -1, 1),
    exposure: clamp(num(i.exposure, 0), -5, 5),
    contrast: clamp(num(i.contrast, 1), 0, 4),
    blackPoint,
    whitePoint: clamp(num(i.whitePoint, 1), blackPoint + 0.01, 1),
    gamma: Math.max(0.05, num(i.gamma, 1)),
    invert: !!i.invert,
    posterizeLevels: clamp(Math.round(num(i.posterizeLevels, 0)), 0, 16),
    thresholdBias: clamp(num(i.thresholdBias, 0), -1, 1),
    noiseAmount: clamp(num(i.noiseAmount, 0), 0, 1),
    blurRadius: clamp(num(i.blurRadius, 0), 0, 4),
    sharpenAmount: clamp(num(i.sharpenAmount, 0), 0, 4),
  };
}

export const DEFAULT_STRIPES: Stripe[] = [
  { color: 0xf3f3f3, startFrom: 0.12, width: 1 },
  { color: 0xfada98, startFrom: 0.28, width: 1 },
  { color: 0xf8bd70, startFrom: 0.44, width: 2 },
  { color: 0xf69e4d, startFrom: 0.6, width: 3 },
  { color: 0xf27c33, startFrom: 0.76, width: 4 },
  { color: 0xeb5729, startFrom: 0.9, width: 5 },
];
export function normalizeStripe(i: Partial<Stripe>): Stripe {
  return {
    color: Math.round(clamp(num(i.color, 0), 0, 0xffffff)),
    startFrom: clamp(num(i.startFrom, 0), 0, 1),
    width: clamp(Math.round(num(i.width, 1)), 1, 64),
  };
}
export function normalizeStripes(i: Partial<Stripe>[] | undefined, fallback: Stripe[]): Stripe[] {
  if (!i || i.length === 0) return fallback.map((s) => ({ ...s }));
  return i.map(normalizeStripe);
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  transform: DEFAULT_TRANSFORM,
  adjustments: DEFAULT_ADJUSTMENTS,
  background: DEFAULT_BACKGROUND,
  grid: DEFAULT_GRID,
  stripes: DEFAULT_STRIPES.map((s) => ({ ...s })),
  stripesEnabled: true,
  fieldScale: 1,
};

export function normalizeEngineConfig(i: Partial<EngineConfig> = {}): EngineConfig {
  return {
    transform: normalizeTransform(i.transform),
    adjustments: normalizeAdjustments(i.adjustments),
    background: normalizeBackground(i.background),
    grid: normalizeGrid(i.grid),
    stripes: normalizeStripes(i.stripes, DEFAULT_STRIPES),
    stripesEnabled: i.stripesEnabled !== undefined ? !!i.stripesEnabled : true,
    fieldScale: clamp(num(i.fieldScale, 1), 0.25, 2),
  };
}
