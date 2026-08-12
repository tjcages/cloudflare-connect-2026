/** Shared 2D color-field hotspots for Twizzler Shared / Fiber rendering. */

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
export const TWIZZLER_GRADIENT_FIELD_SVG_COLS = 48;
export const TWIZZLER_GRADIENT_FIELD_SVG_ROWS = 32;
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

export function sortTwizzlerGradientStops(stops: readonly TwizzlerGradientStop[]): TwizzlerGradientStop[] {
  return [...stops].sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
}

function parseStop(value: unknown, index: number, fallbackColor: string): TwizzlerGradientStop | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { id?: unknown; offset?: unknown; x?: unknown; y?: unknown; color?: unknown };
  const xRaw = isFiniteNumber(record.x) ? record.x : isFiniteNumber(record.offset) ? record.offset : null;
  if (xRaw === null) return null;
  const x = clamp01(xRaw);
  const y = isFiniteNumber(record.y) ? clamp01(record.y) : 0.5;
  const id =
    typeof record.id === "string" && record.id.trim() ? record.id.trim() : createTwizzlerGradientStopId(index + 10);
  return { id, x, y, offset: x, color: normalizeHex(record.color, fallbackColor) };
}

function withPosition(stop: TwizzlerGradientStop, x: number, y: number): TwizzlerGradientStop {
  const nextX = clamp01(x);
  const nextY = clamp01(y);
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
    if (seen.has(id)) id = createTwizzlerGradientStopId(i + 100 + parsed.length);
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
      x: stop.x,
      y: stop.y,
      offset: stop.offset,
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

/** Node-safe SVG field: a grid of rects inside a `userSpaceOnUse` pattern. */
export function twizzlerGradientSvgPattern(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  stops: readonly TwizzlerGradientStop[],
  cols = TWIZZLER_GRADIENT_FIELD_SVG_COLS,
  rows = TWIZZLER_GRADIENT_FIELD_SVG_ROWS,
): string {
  const w = Math.max(width, 0.001);
  const h = Math.max(height, 0.001);
  const cellW = w / Math.max(1, cols);
  const cellH = h / Math.max(1, rows);
  const overlapX = cellW * 0.04;
  const overlapY = cellH * 0.04;
  const rects: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    const v = (row + 0.5) / rows;
    const ry = row * cellH - overlapY * 0.5;
    for (let col = 0; col < cols; col += 1) {
      const rgb = sampleTwizzlerGradientRgb(stops, (col + 0.5) / cols, v);
      const rx = col * cellW - overlapX * 0.5;
      rects.push(
        `      <rect x="${svgNumber(rx)}" y="${svgNumber(ry)}" width="${svgNumber(cellW + overlapX)}" height="${svgNumber(cellH + overlapY)}" fill="rgb(${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)})" />`,
      );
    }
  }
  return [
    `    <pattern id="${id}" patternUnits="userSpaceOnUse" x="${svgNumber(x, 1)}" y="${svgNumber(y, 1)}" width="${svgNumber(w, 1)}" height="${svgNumber(h, 1)}">`,
    ...rects,
    "    </pattern>",
  ].join("\n");
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
  const nextColor = color ?? sampleTwizzlerGradientColor(stops, uv.x, uv.y);
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
