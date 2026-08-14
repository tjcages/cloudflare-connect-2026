import {
  parseTwizzlerGradientStops,
  serializeTwizzlerGradientStops,
  type TwizzlerGradientStop,
} from "../twizzlerGradient";
import type { TimelineValue } from "./timelineModel";

type TimelineStoreDatum = { value: unknown };

const TWIZZLER_MODE_PATH = "Twizzler.General.twizzlerRibbonColorMode";
const TWIZZLER_GRADIENT_PATH = "Twizzler.General.twizzlerGradientStops";
const TWIZZLER_COLOR_NEAR_PATH = "Twizzler.General.twizzlerColor";
const TWIZZLER_COLOR_FAR_PATH = "Twizzler.General.twizzlerColorFar";
const TWIZZLER_COLOR_PEAK_PATH = "Twizzler.General.twizzlerColorEdge";
const SHARED_TWIZZLER_COLOR_MODES = new Set(["sharedLinear", "sharedGradient", "fiberGradient"]);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function stringValue(
  path: string,
  updates: Readonly<Record<string, TimelineValue>>,
  data: Readonly<Record<string, TimelineStoreDatum>>,
): string {
  const value = updates[path] ?? data[path]?.value;
  return typeof value === "string" ? value : "";
}

function recolorSharedFieldStops(
  stops: readonly TwizzlerGradientStop[],
  far: string | undefined,
  peak: string | undefined,
  near: string | undefined,
): TwizzlerGradientStop[] {
  if (stops.length === 0) return [];
  const peakIndex = Math.max(
    0,
    stops.findIndex((stop) => stop.id === "peak"),
  );
  const fallbackPeakIndex = stops.reduce((best, stop, index) => (stop.y < stops[best]!.y ? index : best), 0);
  const resolvedPeakIndex = stops.some((stop) => stop.id === "peak") ? peakIndex : fallbackPeakIndex;
  return stops.map((stop, index) => {
    const color =
      index === 0 && far
        ? far
        : index === stops.length - 1 && near
          ? near
          : index === resolvedPeakIndex && peak
            ? peak
            : stop.color;
    return color === stop.color ? stop : { ...stop, color };
  });
}

/** Route evaluated timeline values to exact Leva paths and expand shared-field color aliases. */
export function buildTimelineStoreUpdates(
  values: Readonly<Record<string, TimelineValue>>,
  data: Readonly<Record<string, TimelineStoreDatum>>,
): Record<string, TimelineValue> {
  const updates: Record<string, TimelineValue> = {};
  for (const [path, value] of Object.entries(values)) {
    if (path in data && data[path]?.value !== value) updates[path] = value;
  }

  const mode = stringValue(TWIZZLER_MODE_PATH, updates, data);
  if (!SHARED_TWIZZLER_COLOR_MODES.has(mode) || !(TWIZZLER_GRADIENT_PATH in data)) return updates;

  const farValue = values[TWIZZLER_COLOR_FAR_PATH];
  const peakValue = values[TWIZZLER_COLOR_PEAK_PATH];
  const nearValue = values[TWIZZLER_COLOR_NEAR_PATH];
  const far = typeof farValue === "string" && HEX_COLOR.test(farValue) ? farValue : undefined;
  const peak = typeof peakValue === "string" && HEX_COLOR.test(peakValue) ? peakValue : undefined;
  const near = typeof nearValue === "string" && HEX_COLOR.test(nearValue) ? nearValue : undefined;
  if (!far && !peak && !near) return updates;

  const currentFar = stringValue(TWIZZLER_COLOR_FAR_PATH, updates, data);
  const currentNear = stringValue(TWIZZLER_COLOR_NEAR_PATH, updates, data);
  const currentStops = parseTwizzlerGradientStops(data[TWIZZLER_GRADIENT_PATH]?.value, currentFar, currentNear);
  const serialized = serializeTwizzlerGradientStops(recolorSharedFieldStops(currentStops, far, peak, near));
  if (data[TWIZZLER_GRADIENT_PATH]?.value !== serialized) updates[TWIZZLER_GRADIENT_PATH] = serialized;
  return updates;
}
