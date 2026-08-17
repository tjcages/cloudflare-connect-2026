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
export declare const TWIZZLER_GRADIENT_STOP_MIN = 1;
export declare const TWIZZLER_GRADIENT_STOP_MAX = 16;
export declare const TWIZZLER_GRADIENT_FIELD_RASTER_WIDTH = 160;
export declare const TWIZZLER_GRADIENT_FIELD_RASTER_HEIGHT = 100;
/** Per-ribbon PNG size for Fiber SVG patterns (shared pack uses the larger raster). */
export declare const TWIZZLER_GRADIENT_FIELD_SVG_COLS = 48;
export declare const TWIZZLER_GRADIENT_FIELD_SVG_ROWS = 32;
export declare const TWIZZLER_GRADIENT_HANDLE_HIT_PX = 26;
export declare function parseHexRgb(hex: string): {
    r: number;
    g: number;
    b: number;
};
export declare function createTwizzlerGradientStopId(seed?: number): string;
export declare function defaultTwizzlerGradientStops(colorFar: string, colorNear: string): TwizzlerGradientStop[];
/** Authored Shared/Fiber default: three off-axis hotspots so the field is visibly 2D. */
export declare function defaultTwizzlerGradientFieldStops(colorFar: string, colorNear: string, colorEdge: string): TwizzlerGradientStop[];
export declare function sortTwizzlerGradientStops(stops: readonly TwizzlerGradientStop[]): TwizzlerGradientStop[];
/**
 * Canonicalize hotspot lists. Invalid / missing lists fall back to colorFar@(0,0.5) → colorNear@(1,0.5).
 * Saved 1D ramps (`offset` only) migrate to `x = offset`, `y = 0.5`.
 */
export declare function normalizeTwizzlerGradientStops(value: unknown, colorFar: string, colorNear: string): TwizzlerGradientStop[];
/** Baked/Solid knobs drive leftmost/rightmost hotspot colors; other points stay put. */
export declare function withTwizzlerGradientEndpointColors(stops: readonly TwizzlerGradientStop[], colorFar: string, colorNear: string): TwizzlerGradientStop[];
export declare function serializeTwizzlerGradientStops(stops: readonly TwizzlerGradientStop[]): string;
export declare function parseTwizzlerGradientStops(value: unknown, colorFar: string, colorNear: string): TwizzlerGradientStop[];
/** Inverse-distance weighting (power 2). An exact hotspot hit returns that color. */
export declare function sampleTwizzlerGradientRgb(stops: readonly TwizzlerGradientStop[], x: number, y: number): {
    r: number;
    g: number;
    b: number;
};
export declare function sampleTwizzlerGradientColor(stops: readonly TwizzlerGradientStop[], x: number, y?: number): string;
/** 1D lerp along stop `offset` / `x` (Shared gradient — not the 2D IDW field). */
export declare function sampleTwizzlerGradientRampColor(stops: readonly TwizzlerGradientStop[], t: number): string;
export declare function twizzlerGradientCss(stops: readonly TwizzlerGradientStop[]): string;
/** Apply canonical 1D stops to a Canvas2D linear gradient. */
export declare function applyTwizzlerGradientStops(gradient: CanvasGradient, stops: readonly TwizzlerGradientStop[]): void;
export declare function twizzlerGradientSvgStops(stops: readonly TwizzlerGradientStop[]): string;
export declare function rasterizeTwizzlerGradientField(stops: readonly TwizzlerGradientStop[], width: number, height: number): Uint8ClampedArray;
/**
 * Figma-safe 2D field fill: one PNG `<image>` stretched to the placement box.
 * Do not wrap this in `<pattern>` — Figma tiles patterns at the PNG's intrinsic
 * pixel size, so a 160×100 field repeats across the export frame.
 */
export declare function twizzlerGradientSvgImage(id: string, x: number, y: number, width: number, height: number, stops: readonly TwizzlerGradientStop[], cols?: number, rows?: number, extraAttrs?: string): string;
export declare function addTwizzlerGradientStop(stops: readonly TwizzlerGradientStop[], x?: number, y?: number, color?: string): TwizzlerGradientStop[];
export declare function removeTwizzlerGradientStop(stops: readonly TwizzlerGradientStop[], id: string): TwizzlerGradientStop[];
export declare function moveTwizzlerGradientStop(stops: readonly TwizzlerGradientStop[], id: string, x: number, y: number): TwizzlerGradientStop[];
/** Slide a ramp stop on X only so Field Y positions survive Shared gradient ↔ Shared field. */
export declare function moveTwizzlerGradientStopOffset(stops: readonly TwizzlerGradientStop[], id: string, offset: number): TwizzlerGradientStop[];
export declare function recolorTwizzlerGradientStop(stops: readonly TwizzlerGradientStop[], id: string, color: string): TwizzlerGradientStop[];
export declare function uvFromClient(clientX: number, clientY: number, bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
}): {
    x: number;
    y: number;
};
export declare function offsetFromClientX(clientX: number, bounds: {
    left: number;
    width: number;
}): number;
export declare function nearestTwizzlerGradientStopId(stops: readonly TwizzlerGradientStop[], x: number, y: number, threshold?: number): string | null;
/** Inner field rect in client pixels (viewBox pad mapped through the SVG box). */
export declare function gradientFieldClientPlane(bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
}, viewWidth: number, viewHeight: number, pad: number): {
    left: number;
    top: number;
    width: number;
    height: number;
};
/** Hit-test hotspots in screen pixels so a wide-short graph still has a round click target. */
export declare function nearestTwizzlerGradientStopIdPx(stops: readonly TwizzlerGradientStop[], clientX: number, clientY: number, plane: {
    left: number;
    top: number;
    width: number;
    height: number;
}, thresholdPx?: number): string | null;
