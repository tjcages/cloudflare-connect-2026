/** Shared 2D color-field hotspots for Twizzler Shared / Fiber rendering. */

import { nextOrangeRedLibraryHex } from "./components/colorLibrary";
import { rgbaPngDataUri } from "./export/pngRgba";

export type TwizzlerGradientStop = {
  id: string;
  /** Horizontal UV (0 = left, 1 = right). */
  x: number;
  /** Vertical UV (0 = top, 1 = bottom). */
  y: number;
  /** Alias of `x` so saved 1D ramps (`offset`) round-trip. */
  offset: number;
  color: string;
};

export const TWIZZLER_GRADIENT_STOP_MIN = 1;
export const TWIZZLER_GRADIENT_STOP_MAX = 16;
export const TWIZZLER_GRADIENT_FIELD_RASTER_WIDTH = 160;
export const TWIZZLER_GRADIENT_FIELD_RASTER_HEIGHT = 100;
/** Per-ribbon PNG size for Fiber SVG patterns (shared pack uses the larger raster). */
export const TWIZZLER_GRADIENT_FIELD_SVG_COLS = 48;
export const TWIZZLER_GRADIENT_FIELD_SVG_ROWS = 32;
export const TWIZZLER_GRADIENT_HANDLE_HIT_PX = 26;
const IDW_POWER = 2;
const IDW_HIT_EPS2 = 1e-12;
const HEX_RE = /^#[0-9a-f]{6}$/i;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value === "string" && HEX_RE.test(value)) return value.toLowerCase();
  if (typeof fallback === "string" && HEX_RE.test(fallback)) return fallback.toLowerCase();
  return "#f46021";
}

export function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const value = normalizeHex(hex, "#f46021").slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const channel = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

let stopSeq = 0;

export function createTwizzlerGradientStopId(seed = 0): string {
  stopSeq += 1;
  return `g${(seed + stopSeq).toString(36)}`;
}

export function defaultTwizzlerGradientStops(colorFar: string, colorNear: string): TwizzlerGradientStop[] {
  return [
    { id: "far", x: 0, y: 0.5, offset: 0, color: normalizeHex(colorFar, "#fea700") },
    { id: "near", x: 1, y: 0.5, offset: 1, color: normalizeHex(colorNear, "#f46021") },
  ];
}

/** Authored Shared/Fiber default: three off-axis hotspots so the field is visibly 2D. */
export function defaultTwizzlerGradientFieldStops(
  colorFar: string,
  colorNear: string,
  colorEdge: string,
): TwizzlerGradientStop[] {
  return [
    { id: "far", x: 0.08, y: 0.78, offset: 0.08, color: normalizeHex(colorFar, "#fea700") },
    { id: "peak", x: 0.5, y: 0.16, offset: 0.5, color: normalizeHex(colorEdge, "#e92e28") },
    { id: "near", x: 0.92, y: 0.72, offset: 0.92, color: normalizeHex(colorNear, "#f46021") },
  ];
}

export function sortTwizzlerGradientStops(stops: readonly TwizzlerGradientStop[]): TwizzlerGradientStop[] {
  return [...stops].sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
}

function quantize01(value: number): number {
  return Number(clamp01(value).toFixed(4));
}

function parseStop(value: unknown, index: number, fallbackColor: string): TwizzlerGradientStop | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { id?: unknown; offset?: unknown; x?: unknown; y?: unknown; color?: unknown };
  const xRaw = isFiniteNumber(record.x) ? record.x : isFiniteNumber(record.offset) ? record.offset : null;
  if (xRaw === null) return null;
  const x = quantize01(xRaw);
  const y = isFiniteNumber(record.y) ? quantize01(record.y) : 0.5;
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : `g${index}`;
  return { id, x, y, offset: x, color: normalizeHex(record.color, fallbackColor) };
}

function withPosition(stop: TwizzlerGradientStop, x: number, y: number): TwizzlerGradientStop {
  const nextX = quantize01(x);
  const nextY = quantize01(y);
  return { ...stop, x: nextX, y: nextY, offset: nextX };
}

/**
 * Canonicalize hotspot lists. Invalid / missing lists fall back to colorFar@(0,0.5) → colorNear@(1,0.5).
 * Saved 1D ramps (`offset` only) migrate to `x = offset`, `y = 0.5`.
 */
export function normalizeTwizzlerGradientStops(
  value: unknown,
  colorFar: string,
  colorNear: string,
): TwizzlerGradientStop[] {
  const far = normalizeHex(colorFar, "#fea700");
  const near = normalizeHex(colorNear, "#f46021");
  const raw = Array.isArray(value) ? value : [];
  const parsed: TwizzlerGradientStop[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i += 1) {
    const stop = parseStop(raw[i], i, i === 0 ? far : near);
    if (!stop) continue;
    let id = stop.id;
    if (seen.has(id)) id = `${stop.id}-${parsed.length}`;
    seen.add(id);
    parsed.push({ ...stop, id });
    if (parsed.length >= TWIZZLER_GRADIENT_STOP_MAX) break;
  }
  if (parsed.length < TWIZZLER_GRADIENT_STOP_MIN) return defaultTwizzlerGradientStops(far, near);
  return sortTwizzlerGradientStops(parsed);
}

/** Baked/Solid knobs drive leftmost/rightmost hotspot colors; other points stay put. */
export function withTwizzlerGradientEndpointColors(
  stops: readonly TwizzlerGradientStop[],
  colorFar: string,
  colorNear: string,
): TwizzlerGradientStop[] {
  const sorted = sortTwizzlerGradientStops(stops);
  if (sorted.length < TWIZZLER_GRADIENT_STOP_MIN) return defaultTwizzlerGradientStops(colorFar, colorNear);
  const next = sorted.map((stop) => ({ ...stop }));
  next[0] = { ...next[0]!, color: normalizeHex(colorFar, next[0]!.color) };
  if (next.length === 1) return next;
  next[next.length - 1] = {
    ...next[next.length - 1]!,
    color: normalizeHex(colorNear, next[next.length - 1]!.color),
  };
  return next;
}

export function serializeTwizzlerGradientStops(stops: readonly TwizzlerGradientStop[]): string {
  return JSON.stringify(
    sortTwizzlerGradientStops(stops).map((stop) => ({
      id: stop.id,
      x: quantize01(stop.x),
      y: quantize01(stop.y),
      offset: quantize01(stop.offset),
      color: stop.color,
    })),
  );
}

export function parseTwizzlerGradientStops(
  value: unknown,
  colorFar: string,
  colorNear: string,
): TwizzlerGradientStop[] {
  if (Array.isArray(value)) return normalizeTwizzlerGradientStops(value, colorFar, colorNear);
  if (typeof value !== "string" || value.trim() === "") return defaultTwizzlerGradientStops(colorFar, colorNear);
  try {
    return normalizeTwizzlerGradientStops(JSON.parse(value) as unknown, colorFar, colorNear);
  } catch {
    return defaultTwizzlerGradientStops(colorFar, colorNear);
  }
}

function usableStops(stops: readonly TwizzlerGradientStop[]): TwizzlerGradientStop[] {
  return stops.length > 0 ? [...stops] : defaultTwizzlerGradientStops("#fea700", "#f46021");
}

/** Inverse-distance weighting (power 2). An exact hotspot hit returns that color. */
export function sampleTwizzlerGradientRgb(
  stops: readonly TwizzlerGradientStop[],
  x: number,
  y: number,
): { r: number; g: number; b: number } {
  const points = usableStops(stops);
  const u = clamp01(x);
  const v = clamp01(y);
  if (points.length === 1) return parseHexRgb(points[0]!.color);

  let weightR = 0;
  let weightG = 0;
  let weightB = 0;
  let weightSum = 0;
  for (const stop of points) {
    const dx = u - stop.x;
    const dy = v - stop.y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 <= IDW_HIT_EPS2) return parseHexRgb(stop.color);
    const weight = 1 / dist2 ** (IDW_POWER / 2);
    const rgb = parseHexRgb(stop.color);
    weightR += weight * rgb.r;
    weightG += weight * rgb.g;
    weightB += weight * rgb.b;
    weightSum += weight;
  }
  if (weightSum <= 0) return parseHexRgb(points[0]!.color);
  return {
    r: weightR / weightSum,
    g: weightG / weightSum,
    b: weightB / weightSum,
  };
}

export function sampleTwizzlerGradientColor(stops: readonly TwizzlerGradientStop[], x: number, y = 0.5): string {
  return rgbToHex(sampleTwizzlerGradientRgb(stops, x, y));
}

/** 1D lerp along stop `offset` / `x` (Shared gradient — not the 2D IDW field). */
export function sampleTwizzlerGradientRampColor(stops: readonly TwizzlerGradientStop[], t: number): string {
  const sorted = sortTwizzlerGradientStops(usableStops(stops));
  const x = clamp01(t);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (x <= first.offset) return first.color;
  if (x >= last.offset) return last.color;
  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1]!;
    const b = sorted[i]!;
    if (x <= b.offset) {
      const span = b.offset - a.offset;
      const u = span < 1e-6 ? 1 : (x - a.offset) / span;
      return rgbToHex(lerpRgb(parseHexRgb(a.color), parseHexRgb(b.color), u));
    }
  }
  return last.color;
}

function lerpRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export function twizzlerGradientCss(stops: readonly TwizzlerGradientStop[]): string {
  const sorted = sortTwizzlerGradientStops(usableStops(stops));
  const parts = sorted.map((stop) => `${stop.color} ${(stop.offset * 100).toFixed(2)}%`);
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

function uniqueRampStops(stops: readonly TwizzlerGradientStop[]): TwizzlerGradientStop[] {
  const sorted = sortTwizzlerGradientStops(usableStops(stops));
  const unique: TwizzlerGradientStop[] = [];
  let lastOffset = -1;
  for (const stop of sorted) {
    let offset = clamp01(stop.offset);
    if (offset <= lastOffset) offset = Math.min(1, lastOffset + 0.0001);
    unique.push({ ...stop, offset, x: offset });
    lastOffset = offset;
  }
  return unique;
}

/** Apply canonical 1D stops to a Canvas2D linear gradient. */
export function applyTwizzlerGradientStops(gradient: CanvasGradient, stops: readonly TwizzlerGradientStop[]): void {
  for (const stop of uniqueRampStops(stops)) {
    gradient.addColorStop(clamp01(stop.offset), stop.color);
  }
}

export function twizzlerGradientSvgStops(stops: readonly TwizzlerGradientStop[]): string {
  return uniqueRampStops(stops)
    .map((stop) => {
      const rgb = parseHexRgb(stop.color);
      const offset = Number(stop.offset.toFixed(4)).toString();
      return `      <stop offset="${offset}" stop-color="rgb(${rgb.r},${rgb.g},${rgb.b})" />`;
    })
    .join("\n");
}

export function rasterizeTwizzlerGradientField(
  stops: readonly TwizzlerGradientStop[],
  width: number,
  height: number,
): Uint8ClampedArray {
  const cols = Math.max(1, Math.round(width));
  const rows = Math.max(1, Math.round(height));
  const pixels = new Uint8ClampedArray(cols * rows * 4);
  for (let row = 0; row < rows; row += 1) {
    const v = (row + 0.5) / rows;
    for (let col = 0; col < cols; col += 1) {
      const rgb = sampleTwizzlerGradientRgb(stops, (col + 0.5) / cols, v);
      const i = (row * cols + col) * 4;
      pixels[i] = rgb.r;
      pixels[i + 1] = rgb.g;
      pixels[i + 2] = rgb.b;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

function svgNumber(value: number, digits = 3): string {
  return Number(value.toFixed(digits)).toString();
}

/**
 * Figma-safe 2D field fill: one PNG `<image>` stretched to the placement box.
 * Do not wrap this in `<pattern>` — Figma tiles patterns at the PNG's intrinsic
 * pixel size, so a 160×100 field repeats across the export frame.
 */
export function twizzlerGradientSvgImage(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  stops: readonly TwizzlerGradientStop[],
  cols = TWIZZLER_GRADIENT_FIELD_RASTER_WIDTH,
  rows = TWIZZLER_GRADIENT_FIELD_RASTER_HEIGHT,
  extraAttrs = "",
): string {
  const w = Math.max(width, 0.001);
  const h = Math.max(height, 0.001);
  const pixels = rasterizeTwizzlerGradientField(stops, cols, rows);
  const href = rgbaPngDataUri(pixels, cols, rows);
  const extra = extraAttrs.trim() ? ` ${extraAttrs.trim()}` : "";
  return `    <image id="${id}" href="${href}" xlink:href="${href}" x="${svgNumber(x, 1)}" y="${svgNumber(y, 1)}" width="${svgNumber(w, 1)}" height="${svgNumber(h, 1)}" preserveAspectRatio="none"${extra} />`;
}

function vacantHotspotUv(stops: readonly TwizzlerGradientStop[]): { x: number; y: number } {
  const candidates: Array<[number, number]> = [
    [0.5, 0.5],
    [0.35, 0.35],
    [0.65, 0.65],
    [0.5, 0.22],
    [0.5, 0.78],
    [0.22, 0.5],
    [0.78, 0.5],
    [0.28, 0.72],
    [0.72, 0.28],
  ];
  for (const [x, y] of candidates) {
    const occupied = stops.some((stop) => Math.hypot(stop.x - x, stop.y - y) < 0.08);
    if (!occupied) return { x, y };
  }
  const n = stops.length;
  return { x: clamp01(0.12 + ((n * 0.17) % 0.76)), y: clamp01(0.18 + ((n * 0.23) % 0.64)) };
}

export function addTwizzlerGradientStop(
  stops: readonly TwizzlerGradientStop[],
  x?: number,
  y?: number,
  color?: string,
): TwizzlerGradientStop[] {
  if (stops.length >= TWIZZLER_GRADIENT_STOP_MAX) return [...stops];
  const uv = isFiniteNumber(x) && isFiniteNumber(y) ? { x: clamp01(x), y: clamp01(y) } : vacantHotspotUv(stops);
  const nextColor = color ?? nextOrangeRedLibraryHex(stops.map((stop) => stop.color));
  const id = createTwizzlerGradientStopId();
  return [
    ...stops,
    withPosition({ id, x: uv.x, y: uv.y, offset: uv.x, color: normalizeHex(nextColor, "#f46021") }, uv.x, uv.y),
  ];
}

export function removeTwizzlerGradientStop(stops: readonly TwizzlerGradientStop[], id: string): TwizzlerGradientStop[] {
  if (stops.length <= TWIZZLER_GRADIENT_STOP_MIN) return [...stops];
  const next = stops.filter((stop) => stop.id !== id);
  if (next.length < TWIZZLER_GRADIENT_STOP_MIN) return [...stops];
  return next;
}

export function moveTwizzlerGradientStop(
  stops: readonly TwizzlerGradientStop[],
  id: string,
  x: number,
  y: number,
): TwizzlerGradientStop[] {
  return stops.map((stop) => (stop.id === id ? withPosition(stop, x, y) : stop));
}

/** Slide a ramp stop on X only so Field Y positions survive Shared gradient ↔ Shared field. */
export function moveTwizzlerGradientStopOffset(
  stops: readonly TwizzlerGradientStop[],
  id: string,
  offset: number,
): TwizzlerGradientStop[] {
  return stops.map((stop) => (stop.id === id ? withPosition(stop, offset, stop.y) : stop));
}

export function recolorTwizzlerGradientStop(
  stops: readonly TwizzlerGradientStop[],
  id: string,
  color: string,
): TwizzlerGradientStop[] {
  return stops.map((stop) => (stop.id === id ? { ...stop, color: normalizeHex(color, stop.color) } : stop));
}

export function uvFromClient(
  clientX: number,
  clientY: number,
  bounds: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp01((clientX - bounds.left) / bounds.width),
    y: clamp01((clientY - bounds.top) / bounds.height),
  };
}

export function offsetFromClientX(clientX: number, bounds: { left: number; width: number }): number {
  if (bounds.width <= 0) return 0;
  return clamp01((clientX - bounds.left) / bounds.width);
}

export function nearestTwizzlerGradientStopId(
  stops: readonly TwizzlerGradientStop[],
  x: number,
  y: number,
  threshold = 0.08,
): string | null {
  if (stops.length === 0) return null;
  let bestId: string | null = null;
  let bestDist = threshold;
  for (const stop of stops) {
    const dist = Math.hypot(stop.x - x, stop.y - y);
    if (dist <= bestDist) {
      bestDist = dist;
      bestId = stop.id;
    }
  }
  return bestId;
}

/** Inner field rect in client pixels (viewBox pad mapped through the SVG box). */
export function gradientFieldClientPlane(
  bounds: { left: number; top: number; width: number; height: number },
  viewWidth: number,
  viewHeight: number,
  pad: number,
): { left: number; top: number; width: number; height: number } {
  return {
    left: bounds.left + (pad / viewWidth) * bounds.width,
    top: bounds.top + (pad / viewHeight) * bounds.height,
    width: ((viewWidth - pad * 2) / viewWidth) * bounds.width,
    height: ((viewHeight - pad * 2) / viewHeight) * bounds.height,
  };
}

/** Hit-test hotspots in screen pixels so a wide-short graph still has a round click target. */
export function nearestTwizzlerGradientStopIdPx(
  stops: readonly TwizzlerGradientStop[],
  clientX: number,
  clientY: number,
  plane: { left: number; top: number; width: number; height: number },
  thresholdPx = TWIZZLER_GRADIENT_HANDLE_HIT_PX,
): string | null {
  if (stops.length === 0 || plane.width <= 0 || plane.height <= 0) return null;
  let bestId: string | null = null;
  let bestDist = thresholdPx;
  for (const stop of stops) {
    const hx = plane.left + stop.x * plane.width;
    const hy = plane.top + stop.y * plane.height;
    const dist = Math.hypot(clientX - hx, clientY - hy);
    if (dist <= bestDist) {
      bestDist = dist;
      bestId = stop.id;
    }
  }
  return bestId;
}
