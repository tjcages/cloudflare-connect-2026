import { TwizzlerGradientStop } from './twizzlerGradient';
/** Ribbon color preview + SVG export strategy. */
export type TwizzlerRibbonColorMode = "solid" | "sharedLinear" | "sharedGradient" | "fiberGradient" | "baked";
export declare const TWIZZLER_RIBBON_COLOR_MODES: readonly TwizzlerRibbonColorMode[];
/** 2D hotspot field (SVG exports as a PNG). Saved `sharedGradient` id is this field. */
export declare function twizzlerUsesFieldGradient(mode: TwizzlerRibbonColorMode): boolean;
/** 1D left→right ramp (Figma-editable SVG `linearGradient`). */
export declare function twizzlerUsesLinearRamp(mode: TwizzlerRibbonColorMode): boolean;
export type TwizzlerSettings = {
    color: string;
    /** Left / far of X gradient (Orange Pair). */
    colorFar: string;
    /** Right / near of X gradient (Orange Accent). */
    colorNear: string;
    /** Peak Y accent (Red Accent). */
    colorEdge: string;
    /**
     * Shared / Fiber 2D color hotspots (`x`/`y` UV + color).
     * Legacy 1D ramps (`offset` only) migrate to `x = offset`, `y = 0.5`.
     */
    gradientStops: TwizzlerGradientStop[];
    opacity: number;
    /** Orange-wave camera zoom (HTML `zoom`). */
    scale: number;
    centerY: number;
    /** Wave height multiplier (1 = orange-wave reference). */
    amplitude: number;
    lineCount: number;
    /** Base stroke width (HTML `basew`). */
    lineWidth: number;
    pointSpacing: number;
    leftHeight: number;
    rightHeight: number;
    edgeFluctuation: number;
    edgeSpeed: number;
    edgeTaper: number;
    wrinkles: number;
    wrinkleStrength: number;
    bendPosition: number;
    bendAmount: number;
    bend2Position: number;
    bend2Amount: number;
    bend3Position: number;
    bend3Amount: number;
    depthPosition: number;
    depthAmount: number;
    depthWidth: number;
    depth2Position: number;
    depth2Amount: number;
    depth2Width: number;
    /** Extra fan width when the ribbon faces the camera. */
    depthSpread: number;
    depthLift: number;
    /**
     * Z→Y terrain recipe (experiment switch):
     * 0–2 = classic marketing packs (A/B/C); 3–5 = exact Twizzler sine shader recipes.
     */
    depthTerrain: number;
    /** Legacy twist (unused by orange-wave projection). */
    twist: number;
    /** Orange-wave 3D rotation in degrees (defaults match the reference HTML). */
    rotateXDeg: number;
    rotateYDeg: number;
    rotateZDeg: number;
    /** Perspective FOV (HTML `fov`). */
    fov: number;
    /** Camera distance (HTML `camz`). */
    camDist: number;
    /** Perspective width exaggeration (HTML `perspw`). */
    perspectiveWidth: number;
    /** Stroke width clamp min/max (HTML `minw` / `maxw`). */
    minLineWidth: number;
    maxLineWidth: number;
    /**
     * Master switch for X/Y/Z line-segmentation gradients.
     * Prefer `ribbonColorMode`; kept for older saved configs (synced on normalize).
     */
    gradientsEnabled: boolean;
    /**
     * How ribbon color is previewed + exported:
     * - solid: one fill color per fiber
     * - sharedLinear: one pack-wide 1D X ramp (Figma-editable SVG linearGradient)
     * - sharedGradient: one pack-wide 2D color field (SVG PNG) — id kept for saved layouts
     * - fiberGradient: same 2D field stretched into each ribbon’s AABB
     * - baked: segmented X/Y/Z fills (highest fidelity, heaviest)
     */
    ribbonColorMode: TwizzlerRibbonColorMode;
    /** X length color gradient (left colorFar → right colorNear). */
    gradientXEnabled: boolean;
    gradientXMix: number;
    /** Y peak/trough accents (peaks colorEdge, troughs colorNear). */
    gradientYEnabled: boolean;
    gradientYMix: number;
    /**
     * Z depth fade: near-camera fibers keep foreground colors;
     * farther / higher Z lerps toward `backgroundColor`.
     */
    gradientZEnabled: boolean;
    gradientZStrength: number;
    gradientZCenter: number;
    gradientZWidth: number;
    /**
     * Stage / far color for Z fade (library Neutral White by default).
     * Near-camera fibers keep foreground colors; far fibers lerp toward this.
     */
    backgroundColor: string;
    noiseScaleX: number;
    noiseScaleY: number;
    speed: number;
    drift: number;
    /** Stipple dash length in px. 0 = solid. */
    stippleSize: number;
    /** Stipple gap scale. */
    stippleGap: number;
    /** Exact-shader view: rotate the sampling plane in XYZ (degrees). */
    rotateX: number;
    rotateY: number;
    rotateZ: number;
    /** Orange-wave + exact-shader: translate X (pixels after projection). */
    panX: number;
    /** Orange-wave + exact-shader: translate Y (pixels after projection). */
    panY: number;
    /** Orange-wave: translate Z (world units before projection). */
    panZ: number;
    /** Exact-shader camera distance (30 = identity zoom). */
    viewDistance: number;
};
export declare const TWIZZLER_DEFAULTS: TwizzlerSettings;
/** Deterministic, smooth 3D value noise in the same 0–1 range as p5 noise. */
export declare function twizzlerNoise(x: number, y: number, z: number): number;
/**
 * Normalize a Twizzler hex color. Invalid/null values fall back to `fallback`
 * (per-field defaults) so left/right/peaks never collapse to the same token.
 */
export declare function normalizeTwizzlerColor(value: unknown, fallback?: string): string;
/** Lerp two #rrggbb colors. `t` is clamped to 0–1. */
export declare function twizzlerLerpColor(farHex: string, nearHex: string, t: number): string;
export declare function twizzlerNearness(depth: number, settings: Pick<TwizzlerSettings, "depthAmount" | "depth2Amount">): number;
/** Resolve ribbon color mode, migrating legacy `gradientsEnabled` when needed. */
export declare function resolveTwizzlerRibbonColorMode(input: Partial<TwizzlerSettings> | TwizzlerSettings): TwizzlerRibbonColorMode;
/** True when axis X/Y/Z gradients drive per-point baked colors. */
export declare function twizzlerUsesLineGradients(settings: TwizzlerSettings): boolean;
export declare function normalizeTwizzlerSettings(value: unknown): TwizzlerSettings;
/** Multi-sine ribbon height from the orange-wave reference. */
export declare function orangeWaveY(x: number, z: number, t: number, amplitude?: number, xRange?: number): number;
/** World-space half-width so square framing stays stable; wide canvases see more left/right. */
export declare function orangeWaveXRangeForCanvas(width: number, height: number): number;
export declare function twizzlerEdgeHeights(timeSec: number, rangePhase: number, settings: Pick<TwizzlerSettings, "leftHeight" | "rightHeight" | "edgeFluctuation" | "edgeSpeed">): {
    left: number;
    right: number;
};
export declare function twizzlerPointX(point: number, segmentCount: number, width: number): number;
export declare function twizzlerAnimationTime(timeSec: number, speed: number): number;
/** Advance a speed-adjusted clock without discontinuities when speed changes. */
export declare function advanceTwizzlerAnimationTime(currentTime: number, deltaSec: number, speed: number): number;
export declare function twizzlerBendOffset(xT: number, position: number, amount: number, width?: number): number;
export declare function twizzlerPathBend(xT: number, settings: Pick<TwizzlerSettings, "bendPosition" | "bendAmount" | "bend2Position" | "bend2Amount" | "bend3Position" | "bend3Amount">): number;
export declare function twizzlerDepthScale(xT: number, settings: Pick<TwizzlerSettings, "depthPosition" | "depthAmount" | "depthWidth" | "depth2Position" | "depth2Amount" | "depth2Width">): number;
/** Exact Shadertoy isoline Y in pixel space (for tests / Canvas2D fallbacks). */
export declare function twizzlerShaderPackPixelY(pixelX: number, pixelWidth: number, pixelHeight: number, fiberIndex: number, lineCount: number, time: number, settings: Pick<TwizzlerSettings, "wrinkles" | "centerY">, recipe?: 0 | 1 | 2): number;
/** Normalized-Y wrapper for tests (assumes 5:1 banner). Prefer twizzlerShaderPackPixelY. */
export declare function twizzlerShaderPackY(xT: number, fiberT: number, time: number, settings: Pick<TwizzlerSettings, "wrinkles" | "centerY">, recipe?: 0 | 1 | 2, lineCount?: number): number;
/** depthTerrain 3/4/5 → exact sine-pack recipes 0/1/2 (Canvas2D orange-wave stays on 0–2). */
export declare function twizzlerShaderPackRecipe(depthTerrain: number): 0 | 1 | 2 | null;
/**
 * Marketing banner centerline in normalized Y (0=top, 1=bottom).
 * Each depthTerrain uses a different spine + wave recipe so A/B/C read differently.
 */
export declare function twizzlerMarketingCenterY(xT: number, settings: TwizzlerSettings, time: number): number;
/**
 * Intrinsic ribbon half-height (before twist projection).
 * Smooth pinch → wide fan. No high-freq width chatter.
 */
export declare function twizzlerMarketingWidth(xT: number, settings: TwizzlerSettings): number;
/**
 * Twist angle θ(x): soft pinch at valley, open face on the right fan.
 */
export declare function twizzlerMarketingTwist(xT: number, settings: TwizzlerSettings, time: number): number;
/** Face-on amount 0..1 from twist (1 = full fan, 0 = edge-on). */
export declare function twizzlerFaceAmount(theta: number): number;
/** Horizontal color mix 0..1 along the marketing ribbon (pale → coral). */
export declare function twizzlerColorT(xT: number): number;
/**
 * Camera nearness 0..1 for a fiber at (across, xT).
 * Z = into the screen (away from camera = far / low nearness).
 * Stretches mid-pack toward near/far poles so the depth stack is not condensed.
 */
export declare function twizzlerFiberNearness(across: number, xT: number, settings: TwizzlerSettings, time: number): number;
/** Fog blend 0..1 toward background (white). Far fibers dissolve hard into the stage. */
export declare function twizzlerFogAmount(nearness: number): number;
/** Blend ribbon hex into white by fog amount (cheap distance fade). */
export declare function twizzlerFogColor(hex: string, fog: number, backgroundHex?: string): string;
/** Stroke width scale from nearness — thick toward camera, hairline when far. */
export declare function twizzlerStrokeWidthScale(nearness: number): number;
/**
 * Pull fiber slots toward near/far poles so Z depth is not a tight mid cluster.
 * `expand` 0 = leave slots; higher = stronger pole stretch.
 */
export declare function twizzlerExpandAcross(across: number, expand: number): number;
/**
 * Warp fiber across-position along X with noise so inter-ribbon gaps
 * open/close irregularly from left → right (not a fixed parallel pack).
 */
export declare function twizzlerGapWarpedAcross(across: number, xT: number, fiberIndex: number, gapNoise?: number, seed?: number): number;
/**
 * Top-down amplitude heat map over (x along ribbon, across = Z / depth stack).
 * Multiple scattered hot spots through Z×X — not one pack-wide L→R swell.
 * `patchScale` >1 = fewer larger lobes; <1 = denser Z spots.
 */
export declare function twizzlerAmpHeat(xT: number, across: number, patchScale?: number, seed?: number): number;
/**
 * Signed Y swell: narrow Z-bands with phase-shifted hills along X.
 * Far / mid / near bands peak at different X — multiple peaks through the stack.
 */
export declare function twizzlerAmpSwell(xT: number, across: number, patchScale?: number, seed?: number): number;
/**
 * Y-amplitude from Z-scattered heat patches (pixel units).
 * Strong enough to read as extra peaks/valleys inside the pack, still capped on-canvas.
 */
export declare function twizzlerAmpNoiseY(xT: number, across: number, pixelHeight: number, amplitude: number, wrinkleStrength: number, patchScale?: number, seed?: number): number;
/**
 * Uneven fiber slots across [-1,1] — irregular gaps instead of even spacing.
 * `gapNoise` 0 = uniform; ~0.35–0.7 = organic cluster/spread.
 */
export declare function twizzlerUnevenAcross(lineCount: number, gapNoise?: number, seed?: number): number[];
/**
 * Screen-space Y bias from Z nearness + along-X terrain.
 * Right edge rule: furthest-from-camera fibers go lowest (largest +Y).
 * `depthTerrain`: 0 rolling (A), 1 jagged (B), 2 long far-drop sweep (C).
 */
export declare function twizzlerDepthYBias(nearness: number, pixelHeight: number, depthLift: number, xT?: number, waveAmp?: number, depthTerrain?: number): number;
export type TwizzlerLine = {
    /** -1..1 across ribbon width. */
    across: number;
    opacity: number;
    /** Primary stroke color for this fiber (SVG + canvas). */
    color: string;
    /** Typical nearness 0..1 (toward camera). */
    nearness: number;
    /** Stroke width in px for this fiber. */
    strokeWidth: number;
    points: Array<{
        x: number;
        y: number;
        depth: number;
        along: number;
        nearness: number;
        /** Per-point opacity before settings.opacity (orange-wave). */
        alpha?: number;
        /** Per-point hex color (orange-wave gradients). */
        color?: string;
    }>;
};
/** Soften sharp corners along a fiber via short Gaussian Y blur (keeps macro shape). */
export declare function twizzlerSoftenFiberCorners(points: Array<{
    x: number;
    y: number;
    depth: number;
    along: number;
    nearness: number;
}>, radius?: number): void;
export declare function buildTwizzlerLines(width: number, height: number, timeSec: number, input?: Partial<TwizzlerSettings>): {
    settings: TwizzlerSettings;
    lines: TwizzlerLine[];
};
/** Outline a centerline into left/right polygons for filled ribbons. */
export declare function outlinePolylinePolygon(points: readonly {
    x: number;
    y: number;
}[], strokeWidth: number): {
    x: number;
    y: number;
}[] | null;
export type TwizzlerCanvas = HTMLCanvasElement | OffscreenCanvas;
type TwizzlerContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/**
 * Horizontal span for a fiber-local X gradient (colorFar at left → colorNear at right).
 * Includes half stroke width so the ramp covers the outlined ribbon silhouette.
 */
export declare function ribbonGradientXSpan(points: readonly {
    x: number;
    y: number;
}[], strokeWidth: number): {
    x1: number;
    x2: number;
} | null;
/** Axis-aligned box for a fiber-local 2D color field, padded by half stroke. */
export declare function ribbonGradientXYSpan(points: readonly {
    x: number;
    y: number;
}[], strokeWidth: number): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
} | null;
export declare function renderTwizzler(canvas: TwizzlerCanvas, width: number, height: number, timeSec: number, input?: Partial<TwizzlerSettings>): void;
export declare function clearTwizzler(canvas: TwizzlerCanvas): void;
/** Catmull-Rom → cubic Bézier controls for segment p1 → p2 (passes through samples). */
export declare function twizzlerCubicControls(p0: {
    x: number;
    y: number;
}, p1: {
    x: number;
    y: number;
}, p2: {
    x: number;
    y: number;
}, p3: {
    x: number;
    y: number;
}): {
    cp1x: number;
    cp1y: number;
    cp2x: number;
    cp2y: number;
};
/**
 * Stroke a fiber as cubic Béziers (Catmull-Rom). Same samples, no polyline kinks.
 */
export declare function twizzlerTraceCubic(context: TwizzlerContext, points: ReadonlyArray<{
    x: number;
    y: number;
}>): void;
/** SVG path `d` using cubic Béziers through the same samples (matches canvas). */
export declare function twizzlerSvgPathCubic(points: ReadonlyArray<{
    x: number;
    y: number;
}>): string;
export {};
