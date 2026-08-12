/** Shared X-ramp stops for Twizzler Shared / Fiber gradient rendering. */

export type TwizzlerGradientStop = {
  id: string;
  offset: number;
  color: string;
};

export const TWIZZLER_GRADIENT_STOP_MIN = 2;
export const TWIZZLER_GRADIENT_STOP_MAX = 8;

const HEX_RE = /^#[0-9a-f]{6}$/i;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value === "string" && HEX_RE.test(value)) return value.toLowerCase();
  if (typeof fallback === "string" && HEX_RE.test(fallback)) return fallback.toLowerCase();
  return "#f46021";
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const value = normalizeHex(hex, "#f46021").slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function lerpHex(a: string, b: string, t: number): string {
  const amount = clamp01(t);
  const from = parseHexRgb(a);
  const to = parseHexRgb(b);
  const channel = (x: number, y: number) => Math.round(x + (y - x) * amount);
  const r = channel(from.r, to.r).toString(16).padStart(2, "0");
  const g = channel(from.g, to.g).toString(16).padStart(2, "0");
  const bCh = channel(from.b, to.b).toString(16).padStart(2, "0");
  return `#${r}${g}${bCh}`;
}

let stopSeq = 0;

export function createTwizzlerGradientStopId(seed = 0): string {
  stopSeq += 1;
  return `g${(seed + stopSeq).toString(36)}`;
}

export function defaultTwizzlerGradientStops(colorFar: string, colorNear: string): TwizzlerGradientStop[] {
  return [
    { id: "far", offset: 0, color: normalizeHex(colorFar, "#fea700") },
    { id: "near", offset: 1, color: normalizeHex(colorNear, "#f46021") },
  ];
}

export function sortTwizzlerGradientStops(stops: readonly TwizzlerGradientStop[]): TwizzlerGradientStop[] {
  return [...stops].sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id));
}

function parseStop(value: unknown, index: number, fallbackColor: string): TwizzlerGradientStop | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { id?: unknown; offset?: unknown; color?: unknown };
  const offset = typeof record.offset === "number" && Number.isFinite(record.offset) ? clamp01(record.offset) : null;
  if (offset === null) return null;
  const id =
    typeof record.id === "string" && record.id.trim() ? record.id.trim() : createTwizzlerGradientStopId(index + 10);
  return { id, offset, color: normalizeHex(record.color, fallbackColor) };
}

/**
 * Canonicalize ramp stops. Invalid / missing lists fall back to colorFar@0 → colorNear@1.
 * Extra stops are kept (up to max); order is left→right by offset.
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

/** Baked/Solid knobs drive endpoint colors; extra stop offsets stay put. */
export function withTwizzlerGradientEndpointColors(
  stops: readonly TwizzlerGradientStop[],
  colorFar: string,
  colorNear: string,
): TwizzlerGradientStop[] {
  const sorted = sortTwizzlerGradientStops(stops);
  if (sorted.length < TWIZZLER_GRADIENT_STOP_MIN) return defaultTwizzlerGradientStops(colorFar, colorNear);
  const next = sorted.map((stop) => ({ ...stop }));
  next[0] = { ...next[0]!, color: normalizeHex(colorFar, next[0]!.color) };
  next[next.length - 1] = {
    ...next[next.length - 1]!,
    color: normalizeHex(colorNear, next[next.length - 1]!.color),
  };
  return next;
}

export function serializeTwizzlerGradientStops(stops: readonly TwizzlerGradientStop[]): string {
  return JSON.stringify(
    sortTwizzlerGradientStops(stops).map((stop) => ({ id: stop.id, offset: stop.offset, color: stop.color })),
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

export function sampleTwizzlerGradientColor(stops: readonly TwizzlerGradientStop[], t: number): string {
  const sorted = sortTwizzlerGradientStops(stops);
  if (sorted.length === 0) return "#f46021";
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
      return lerpHex(a.color, b.color, u);
    }
  }
  return last.color;
}

export function twizzlerGradientCss(stops: readonly TwizzlerGradientStop[]): string {
  const sorted = sortTwizzlerGradientStops(stops);
  if (sorted.length === 0) return "linear-gradient(90deg, #fea700 0%, #f46021 100%)";
  const parts = sorted.map((stop) => `${stop.color} ${(stop.offset * 100).toFixed(2)}%`);
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

/** Apply canonical stops to a Canvas2D linear gradient (Shared + Fiber). */
export function applyTwizzlerGradientStops(gradient: CanvasGradient, stops: readonly TwizzlerGradientStop[]): void {
  const sorted = sortTwizzlerGradientStops(stops);
  const usable =
    sorted.length >= TWIZZLER_GRADIENT_STOP_MIN ? sorted : defaultTwizzlerGradientStops("#fea700", "#f46021");
  for (const stop of usable) {
    gradient.addColorStop(clamp01(stop.offset), stop.color);
  }
}

export function twizzlerGradientSvgStops(stops: readonly TwizzlerGradientStop[]): string {
  const sorted = sortTwizzlerGradientStops(stops);
  const usable =
    sorted.length >= TWIZZLER_GRADIENT_STOP_MIN ? sorted : defaultTwizzlerGradientStops("#fea700", "#f46021");
  return usable
    .map((stop) => {
      const rgb = parseHexRgb(stop.color);
      const offset = Number(stop.offset.toFixed(4)).toString();
      return `      <stop offset="${offset}" stop-color="rgb(${rgb.r},${rgb.g},${rgb.b})" />`;
    })
    .join("\n");
}

export function addTwizzlerGradientStop(
  stops: readonly TwizzlerGradientStop[],
  offset: number,
  color?: string,
): TwizzlerGradientStop[] {
  if (stops.length >= TWIZZLER_GRADIENT_STOP_MAX) return sortTwizzlerGradientStops(stops);
  const nextOffset = clamp01(offset);
  const nextColor = color ?? sampleTwizzlerGradientColor(stops, nextOffset);
  const id = createTwizzlerGradientStopId();
  return sortTwizzlerGradientStops([...stops, { id, offset: nextOffset, color: normalizeHex(nextColor, "#f46021") }]);
}

export function removeTwizzlerGradientStop(stops: readonly TwizzlerGradientStop[], id: string): TwizzlerGradientStop[] {
  if (stops.length <= TWIZZLER_GRADIENT_STOP_MIN) return sortTwizzlerGradientStops(stops);
  const next = stops.filter((stop) => stop.id !== id);
  if (next.length < TWIZZLER_GRADIENT_STOP_MIN) return sortTwizzlerGradientStops(stops);
  return sortTwizzlerGradientStops(next);
}

export function moveTwizzlerGradientStop(
  stops: readonly TwizzlerGradientStop[],
  id: string,
  offset: number,
): TwizzlerGradientStop[] {
  return sortTwizzlerGradientStops(stops.map((stop) => (stop.id === id ? { ...stop, offset: clamp01(offset) } : stop)));
}

export function recolorTwizzlerGradientStop(
  stops: readonly TwizzlerGradientStop[],
  id: string,
  color: string,
): TwizzlerGradientStop[] {
  return stops.map((stop) => (stop.id === id ? { ...stop, color: normalizeHex(color, stop.color) } : stop));
}

export function offsetFromClientX(clientX: number, bounds: { left: number; width: number }): number {
  if (bounds.width <= 0) return 0;
  return clamp01((clientX - bounds.left) / bounds.width);
}

export function nearestTwizzlerGradientStopId(
  stops: readonly TwizzlerGradientStop[],
  clientX: number,
  bounds: { left: number; width: number },
  thresholdPx = 14,
): string | null {
  if (bounds.width <= 0 || stops.length === 0) return null;
  let bestId: string | null = null;
  let bestDist = thresholdPx;
  for (const stop of stops) {
    const x = bounds.left + stop.offset * bounds.width;
    const dist = Math.abs(clientX - x);
    if (dist <= bestDist) {
      bestDist = dist;
      bestId = stop.id;
    }
  }
  return bestId;
}
