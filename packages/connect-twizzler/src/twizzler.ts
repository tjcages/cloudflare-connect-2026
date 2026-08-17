/**
 * Connect Twizzler — orange-wave 3D projected ribbon (Canvas2D + SVG-exportable paths).
 *
 * Geometry (orange-wave-vector): layered Z ribbons with multi-sine waveY(x,z,t),
 * rotated in 3D, perspective-projected, stroked as solid orange hairlines.
 * Legacy marketing helpers below are kept for tests / experiment tooling.
 */

import {
  applyTwizzlerGradientStops,
  defaultTwizzlerGradientFieldStops,
  parseTwizzlerGradientStops,
  rasterizeTwizzlerGradientField,
  serializeTwizzlerGradientStops,
  TWIZZLER_GRADIENT_FIELD_RASTER_HEIGHT,
  TWIZZLER_GRADIENT_FIELD_RASTER_WIDTH,
  type TwizzlerGradientStop,
} from "./twizzlerGradient";

/** Ribbon color preview + SVG export strategy. */
export type TwizzlerRibbonColorMode = "solid" | "sharedLinear" | "sharedGradient" | "fiberGradient" | "baked";

export const TWIZZLER_RIBBON_COLOR_MODES: readonly TwizzlerRibbonColorMode[] = [
  "solid",
  "sharedLinear",
  "sharedGradient",
  "fiberGradient",
  "baked",
] as const;

/** 2D hotspot field (SVG exports as a PNG). Saved `sharedGradient` id is this field. */
export function twizzlerUsesFieldGradient(mode: TwizzlerRibbonColorMode): boolean {
  switch (mode) {
    case "sharedGradient":
    case "fiberGradient":
      return true;
    case "solid":
    case "sharedLinear":
    case "baked":
      return false;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/** 1D left→right ramp (Figma-editable SVG `linearGradient`). */
export function twizzlerUsesLinearRamp(mode: TwizzlerRibbonColorMode): boolean {
  return mode === "sharedLinear";
}

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

export const TWIZZLER_DEFAULTS: TwizzlerSettings = {
  // Library tokens approximating HTML #ff6709 / #ffcc33 / #ff2a2a
  color: "#f46021",
  colorFar: "#fea700",
  colorNear: "#f46021",
  colorEdge: "#e92e28",
  gradientStops: defaultTwizzlerGradientFieldStops("#fea700", "#f46021", "#e92e28"),
  opacity: 1,
  scale: 1,
  centerY: 0.5,
  amplitude: 1,
  lineCount: 56,
  lineWidth: 2.3,
  pointSpacing: 10,
  leftHeight: 0.58,
  rightHeight: 0.32,
  edgeFluctuation: 0,
  edgeSpeed: 0,
  edgeTaper: 0.08,
  wrinkles: 1.8,
  wrinkleStrength: 0.032,
  bendPosition: 0.2,
  bendAmount: 0,
  bend2Position: 0.4,
  bend2Amount: 0,
  bend3Position: 0.75,
  bend3Amount: 0,
  depthPosition: 0.86,
  depthAmount: 1.15,
  depthWidth: 0.36,
  depth2Position: 0.42,
  depth2Amount: 0.2,
  depth2Width: 0.12,
  depthSpread: 1.05,
  depthLift: 0.85,
  depthTerrain: 0,
  twist: 1.15,
  rotateXDeg: 12,
  rotateYDeg: -18,
  rotateZDeg: 0,
  fov: 1.05,
  camDist: 10.5,
  perspectiveWidth: 1.8,
  minLineWidth: 0.4,
  maxLineWidth: 3.2,
  gradientsEnabled: true,
  ribbonColorMode: "sharedGradient",
  gradientXEnabled: true,
  gradientXMix: 1,
  gradientYEnabled: true,
  gradientYMix: 0.85,
  gradientZEnabled: true,
  gradientZStrength: 0.75,
  gradientZCenter: 0,
  gradientZWidth: 0.95,
  backgroundColor: "#ffffff",
  noiseScaleX: 0.0004,
  noiseScaleY: 0.01,
  speed: 1,
  drift: 0.02,
  stippleSize: 0,
  stippleGap: 0.8,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  panX: 0,
  panY: 0,
  panZ: 0,
  viewDistance: 30,
};

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function fade(value: number): number {
  return value * value * (3 - 2 * value);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Matches orange-wave-vector.html (allows reverse edges when e1 < e0). */
function orangeWaveSmoothstep(edge0: number, edge1: number, x: number): number {
  const denom = edge1 - edge0;
  if (Math.abs(denom) < 1e-12) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / denom));
  return t * t * (3 - 2 * t);
}

function hash3(x: number, y: number, z: number): number {
  let hash = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

/** Deterministic, smooth 3D value noise in the same 0–1 range as p5 noise. */
export function twizzlerNoise(x: number, y: number, z: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const ty = fade(y - y0);
  const tz = fade(z - z0);
  const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;
  const zNear = mix(
    mix(hash3(x0, y0, z0), hash3(x0 + 1, y0, z0), tx),
    mix(hash3(x0, y0 + 1, z0), hash3(x0 + 1, y0 + 1, z0), tx),
    ty,
  );
  const zFar = mix(
    mix(hash3(x0, y0, z0 + 1), hash3(x0 + 1, y0, z0 + 1), tx),
    mix(hash3(x0, y0 + 1, z0 + 1), hash3(x0 + 1, y0 + 1, z0 + 1), tx),
    ty,
  );
  return mix(zNear, zFar, tz);
}

/**
 * Normalize a Twizzler hex color. Invalid/null values fall back to `fallback`
 * (per-field defaults) so left/right/peaks never collapse to the same token.
 */
export function normalizeTwizzlerColor(value: unknown, fallback: string = TWIZZLER_DEFAULTS.color): string {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (typeof fallback === "string" && /^#[0-9a-f]{6}$/i.test(fallback)) return fallback.toLowerCase();
  return TWIZZLER_DEFAULTS.color;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

/** Lerp two #rrggbb colors. `t` is clamped to 0–1. */
export function twizzlerLerpColor(farHex: string, nearHex: string, t: number): string {
  const amount = Math.max(0, Math.min(1, t));
  const far = parseHexColor(farHex);
  const near = parseHexColor(nearHex);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * amount);
  const r = channel(far.r, near.r).toString(16).padStart(2, "0");
  const g = channel(far.g, near.g).toString(16).padStart(2, "0");
  const b = channel(far.b, near.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

export function twizzlerNearness(
  depth: number,
  settings: Pick<TwizzlerSettings, "depthAmount" | "depth2Amount">,
): number {
  const maxNear = Math.max(settings.depthAmount, 0) + Math.max(settings.depth2Amount, 0);
  if (maxNear <= 0) return 0;
  return Math.max(0, Math.min(1, (depth - 1) / maxNear));
}

/** Resolve ribbon color mode, migrating legacy `gradientsEnabled` when needed. */
export function resolveTwizzlerRibbonColorMode(
  input: Partial<TwizzlerSettings> | TwizzlerSettings,
): TwizzlerRibbonColorMode {
  const raw = input.ribbonColorMode;
  if (typeof raw === "string" && (TWIZZLER_RIBBON_COLOR_MODES as readonly string[]).includes(raw)) {
    return raw as TwizzlerRibbonColorMode;
  }
  if (typeof input.gradientsEnabled === "boolean") {
    return input.gradientsEnabled ? "baked" : "solid";
  }
  return TWIZZLER_DEFAULTS.ribbonColorMode;
}

/** True when axis X/Y/Z gradients drive per-point baked colors. */
export function twizzlerUsesLineGradients(settings: TwizzlerSettings): boolean {
  if (resolveTwizzlerRibbonColorMode(settings) !== "baked") return false;
  return (
    settings.gradientXEnabled ||
    settings.gradientYEnabled ||
    (settings.gradientZEnabled && settings.gradientZStrength > 0)
  );
}

export function normalizeTwizzlerSettings(value: unknown): TwizzlerSettings {
  const input = value && typeof value === "object" ? (value as Partial<TwizzlerSettings>) : {};
  const color = normalizeTwizzlerColor(input.color, TWIZZLER_DEFAULTS.color);
  const ribbonColorMode = resolveTwizzlerRibbonColorMode(input);
  const colorFarInput = normalizeTwizzlerColor(input.colorFar, TWIZZLER_DEFAULTS.colorFar);
  const colorNearInput = normalizeTwizzlerColor(input.colorNear ?? input.color, TWIZZLER_DEFAULTS.colorNear);
  const gradientStops = parseTwizzlerGradientStops(input.gradientStops, colorFarInput, colorNearInput);
  const colorFar = gradientStops[0]?.color ?? colorFarInput;
  const colorNear = gradientStops[gradientStops.length - 1]?.color ?? colorNearInput;
  return {
    color: ribbonColorMode === "solid" ? colorNearInput : color,
    colorFar,
    colorNear,
    colorEdge: normalizeTwizzlerColor(input.colorEdge, TWIZZLER_DEFAULTS.colorEdge),
    gradientStops,
    opacity: clamp(input.opacity, TWIZZLER_DEFAULTS.opacity, 0, 1),
    scale: clamp(input.scale, TWIZZLER_DEFAULTS.scale, 0.01, 50),
    centerY: clamp(input.centerY, TWIZZLER_DEFAULTS.centerY, -2, 3),
    amplitude: clamp(input.amplitude, TWIZZLER_DEFAULTS.amplitude, 0, 20),
    lineCount: Math.round(clamp(input.lineCount, TWIZZLER_DEFAULTS.lineCount, 1, 800)),
    lineWidth: clamp(input.lineWidth, TWIZZLER_DEFAULTS.lineWidth, 0.01, 80),
    pointSpacing: Math.round(clamp(input.pointSpacing, TWIZZLER_DEFAULTS.pointSpacing, 1, 400)),
    leftHeight: clamp(input.leftHeight, TWIZZLER_DEFAULTS.leftHeight, -10, 10),
    rightHeight: clamp(input.rightHeight, TWIZZLER_DEFAULTS.rightHeight, -10, 10),
    edgeFluctuation: clamp(input.edgeFluctuation, TWIZZLER_DEFAULTS.edgeFluctuation, 0, 10),
    edgeSpeed: clamp(input.edgeSpeed, TWIZZLER_DEFAULTS.edgeSpeed, 0, 40),
    edgeTaper: clamp(input.edgeTaper, TWIZZLER_DEFAULTS.edgeTaper, 0, 1),
    wrinkles: clamp(input.wrinkles, TWIZZLER_DEFAULTS.wrinkles, 0, 200),
    wrinkleStrength: clamp(input.wrinkleStrength, TWIZZLER_DEFAULTS.wrinkleStrength, 0, 10),
    bendPosition: clamp(input.bendPosition, TWIZZLER_DEFAULTS.bendPosition, 0, 1),
    bendAmount: clamp(input.bendAmount, TWIZZLER_DEFAULTS.bendAmount, -20, 20),
    bend2Position: clamp(input.bend2Position, TWIZZLER_DEFAULTS.bend2Position, 0, 1),
    bend2Amount: clamp(input.bend2Amount, TWIZZLER_DEFAULTS.bend2Amount, -20, 20),
    bend3Position: clamp(input.bend3Position, TWIZZLER_DEFAULTS.bend3Position, 0, 1),
    bend3Amount: clamp(input.bend3Amount, TWIZZLER_DEFAULTS.bend3Amount, -20, 20),
    depthPosition: clamp(input.depthPosition, TWIZZLER_DEFAULTS.depthPosition, 0, 1),
    depthAmount: clamp(input.depthAmount, TWIZZLER_DEFAULTS.depthAmount, 0, 40),
    depthWidth: clamp(input.depthWidth, TWIZZLER_DEFAULTS.depthWidth, 0.01, 10),
    depth2Position: clamp(input.depth2Position, TWIZZLER_DEFAULTS.depth2Position, 0, 1),
    depth2Amount: clamp(input.depth2Amount, TWIZZLER_DEFAULTS.depth2Amount, 0, 40),
    depth2Width: clamp(input.depth2Width, TWIZZLER_DEFAULTS.depth2Width, 0.01, 10),
    depthSpread: clamp(input.depthSpread, TWIZZLER_DEFAULTS.depthSpread, 0, 40),
    depthLift: clamp(input.depthLift, TWIZZLER_DEFAULTS.depthLift, 0, 20),
    depthTerrain: Math.round(clamp(input.depthTerrain, TWIZZLER_DEFAULTS.depthTerrain, 0, 5)),
    twist: clamp(input.twist, TWIZZLER_DEFAULTS.twist, 0, 80),
    rotateXDeg: clamp(input.rotateXDeg, TWIZZLER_DEFAULTS.rotateXDeg, -720, 720),
    rotateYDeg: clamp(input.rotateYDeg, TWIZZLER_DEFAULTS.rotateYDeg, -720, 720),
    rotateZDeg: clamp(input.rotateZDeg, TWIZZLER_DEFAULTS.rotateZDeg, -720, 720),
    fov: clamp(input.fov, TWIZZLER_DEFAULTS.fov, 0.05, 20),
    camDist: clamp(input.camDist, TWIZZLER_DEFAULTS.camDist, 0.25, 200),
    perspectiveWidth: clamp(input.perspectiveWidth, TWIZZLER_DEFAULTS.perspectiveWidth, 0, 40),
    minLineWidth: clamp(input.minLineWidth, TWIZZLER_DEFAULTS.minLineWidth, 0.01, 40),
    maxLineWidth: clamp(input.maxLineWidth, TWIZZLER_DEFAULTS.maxLineWidth, 0.01, 120),
    ribbonColorMode,
    gradientsEnabled: ribbonColorMode !== "solid",
    gradientXEnabled:
      typeof input.gradientXEnabled === "boolean" ? input.gradientXEnabled : TWIZZLER_DEFAULTS.gradientXEnabled,
    gradientXMix: clamp(input.gradientXMix, TWIZZLER_DEFAULTS.gradientXMix, 0, 1),
    gradientYEnabled:
      typeof input.gradientYEnabled === "boolean" ? input.gradientYEnabled : TWIZZLER_DEFAULTS.gradientYEnabled,
    gradientYMix: clamp(input.gradientYMix, TWIZZLER_DEFAULTS.gradientYMix, 0, 1),
    gradientZEnabled:
      typeof input.gradientZEnabled === "boolean" ? input.gradientZEnabled : TWIZZLER_DEFAULTS.gradientZEnabled,
    gradientZStrength: clamp(input.gradientZStrength, TWIZZLER_DEFAULTS.gradientZStrength, 0, 10),
    gradientZCenter: clamp(input.gradientZCenter, TWIZZLER_DEFAULTS.gradientZCenter, -10, 10),
    gradientZWidth: clamp(input.gradientZWidth, TWIZZLER_DEFAULTS.gradientZWidth, 0.01, 20),
    backgroundColor: normalizeTwizzlerColor(input.backgroundColor, TWIZZLER_DEFAULTS.backgroundColor),
    noiseScaleX: clamp(input.noiseScaleX, TWIZZLER_DEFAULTS.noiseScaleX, 0.00001, 1),
    noiseScaleY: clamp(input.noiseScaleY, TWIZZLER_DEFAULTS.noiseScaleY, 0.0001, 2),
    speed: clamp(input.speed, TWIZZLER_DEFAULTS.speed, 0, 40),
    drift: clamp(input.drift, TWIZZLER_DEFAULTS.drift, 0, 20),
    stippleSize: clamp(input.stippleSize, TWIZZLER_DEFAULTS.stippleSize, 0, 80),
    stippleGap: clamp(input.stippleGap, TWIZZLER_DEFAULTS.stippleGap, 0, 80),
    rotateX: clamp(input.rotateX, TWIZZLER_DEFAULTS.rotateX, -89, 89),
    rotateY: clamp(input.rotateY, TWIZZLER_DEFAULTS.rotateY, -180, 180),
    rotateZ: clamp(input.rotateZ, TWIZZLER_DEFAULTS.rotateZ, -720, 720),
    panX: clamp(input.panX, TWIZZLER_DEFAULTS.panX, -400, 400),
    panY: clamp(input.panY, TWIZZLER_DEFAULTS.panY, -400, 400),
    panZ: clamp(input.panZ, TWIZZLER_DEFAULTS.panZ, -20, 20),
    viewDistance: clamp(input.viewDistance, TWIZZLER_DEFAULTS.viewDistance, 0.1, 1000),
  };
}

/** Orange-wave reference constants (from orange-wave-vector.html). */
const ORANGE_WAVE_Z_MIN = -1.8;
const ORANGE_WAVE_Z_MAX = 2.8;
const ORANGE_WAVE_X_RANGE = 6.8;

type Vec3 = { x: number; y: number; z: number };
type WavePoint = Vec3 & { u: number; origX: number; origY: number; origZ: number };

function parseRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function lerpChannel(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  return {
    r: lerpChannel(a.r, b.r, t),
    g: lerpChannel(a.g, b.g, t),
    b: lerpChannel(a.b, b.b, t),
  };
}

function rgbToHex(c: { r: number; g: number; b: number }): string {
  const channel = (value: number) =>
    Math.round(Math.max(0, Math.min(255, value)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(c.r)}${channel(c.g)}${channel(c.b)}`;
}

/** Multi-sine ribbon height from the orange-wave reference. */
export function orangeWaveY(x: number, z: number, t: number, amplitude = 1, xRange = ORANGE_WAVE_X_RANGE): number {
  let y = 0;
  y += 0.42 * Math.sin(x * 0.42 + z * 0.3 + t * 0.09);
  y += 0.28 * Math.sin(x * 0.95 - z * 0.48 + t * 0.06 + 1.0);
  y += 0.16 * Math.sin(x * 1.65 + z * 0.95 - t * 0.14 + 0.5);
  y += 0.11 * Math.sin(x * 2.3 - z * 1.35 + t * 0.11 - 0.7);
  y += 0.07 * Math.sin(x * 3.1 + z * 1.8 - t * 0.2 + 1.8);
  y += 0.045 * Math.sin(x * 4.2 - z * 2.4 + t * 0.26 + 0.9);
  y += 0.025 * Math.sin(x * 5.6 + z * 3.1 - t * 0.33);
  y += 0.015 * Math.sin(x * 7.0 - z * 3.8 + t * 0.41);
  y += 0.05 * Math.sin(z * 1.9 + t * 0.19) * Math.sin(x * 0.3 + 0.4);
  y += 0.03 * Math.sin(z * 2.9 - t * 0.27) * Math.cos(x * 0.45);
  // Soft longitudinal envelope scales with visible X range (wide canvases expand X).
  const edgeOuter = xRange * (8.5 / ORANGE_WAVE_X_RANGE);
  const edgeInner = xRange * (3.8 / ORANGE_WAVE_X_RANGE);
  const env = Math.max(0, Math.min(1, (edgeOuter - Math.abs(x)) / Math.max(1e-6, edgeOuter - edgeInner)));
  y *= env * env * (3 - 2 * env);
  return y * amplitude;
}

/** World-space half-width so square framing stays stable; wide canvases see more left/right. */
export function orangeWaveXRangeForCanvas(width: number, height: number): number {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  return ORANGE_WAVE_X_RANGE * Math.max(1, w / h);
}

function orangeWaveRotX(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

function orangeWaveRotY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

function orangeWaveRotZ(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

export function twizzlerEdgeHeights(
  timeSec: number,
  rangePhase: number,
  settings: Pick<TwizzlerSettings, "leftHeight" | "rightHeight" | "edgeFluctuation" | "edgeSpeed">,
): { left: number; right: number } {
  const time = timeSec * settings.edgeSpeed;
  return {
    left: settings.leftHeight + Math.sin(time + rangePhase) * settings.edgeFluctuation,
    right: settings.rightHeight + Math.sin(time * 0.87 + rangePhase * 1.13 + 2.1) * settings.edgeFluctuation,
  };
}

export function twizzlerPointX(point: number, segmentCount: number, width: number): number {
  if (segmentCount <= 0) return 0;
  return (point / segmentCount) * width;
}

export function twizzlerAnimationTime(timeSec: number, speed: number): number {
  return timeSec * speed;
}

/** Advance a speed-adjusted clock without discontinuities when speed changes. */
export function advanceTwizzlerAnimationTime(currentTime: number, deltaSec: number, speed: number): number {
  const safeCurrent = Number.isFinite(currentTime) ? currentTime : 0;
  const safeDelta = Number.isFinite(deltaSec) ? Math.max(0, deltaSec) : 0;
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  return safeCurrent + safeDelta * safeSpeed;
}

export function twizzlerBendOffset(xT: number, position: number, amount: number, width = 0.16): number {
  const safeWidth = Math.max(0.01, width);
  const distance = (xT - position) / safeWidth;
  return amount * Math.exp(-0.5 * distance * distance);
}

export function twizzlerPathBend(
  xT: number,
  settings: Pick<
    TwizzlerSettings,
    "bendPosition" | "bendAmount" | "bend2Position" | "bend2Amount" | "bend3Position" | "bend3Amount"
  >,
): number {
  return (
    twizzlerBendOffset(xT, settings.bendPosition, settings.bendAmount) +
    twizzlerBendOffset(xT, settings.bend2Position, settings.bend2Amount) +
    twizzlerBendOffset(xT, settings.bend3Position, settings.bend3Amount)
  );
}

export function twizzlerDepthScale(
  xT: number,
  settings: Pick<
    TwizzlerSettings,
    "depthPosition" | "depthAmount" | "depthWidth" | "depth2Position" | "depth2Amount" | "depth2Width"
  >,
): number {
  let near = 0;
  if (settings.depthAmount > 0) {
    near += settings.depthAmount * twizzlerBendOffset(xT, settings.depthPosition, 1, settings.depthWidth);
  }
  if (settings.depth2Amount > 0) {
    near += settings.depth2Amount * twizzlerBendOffset(xT, settings.depth2Position, 1, settings.depth2Width);
  }
  return 1 + near;
}

/** Smooth piecewise lerp across sparse knots (C1 via smoothstep). */
function sampleKnots(x: number, knots: ReadonlyArray<readonly [number, number]>): number {
  const clamped = Math.max(0, Math.min(1, x));
  for (let i = 0; i < knots.length - 1; i += 1) {
    const [x0, y0] = knots[i];
    const [x1, y1] = knots[i + 1];
    if (clamped >= x0 && clamped <= x1) {
      const t = smoothstep(x0, x1, clamped);
      return y0 + (y1 - y0) * t;
    }
  }
  return knots[knots.length - 1][1];
}

/** Exact Shadertoy isoline Y in pixel space (for tests / Canvas2D fallbacks). */
export function twizzlerShaderPackPixelY(
  pixelX: number,
  pixelWidth: number,
  pixelHeight: number,
  fiberIndex: number,
  lineCount: number,
  time: number,
  settings: Pick<TwizzlerSettings, "wrinkles" | "centerY">,
  recipe: 0 | 1 | 2 = 0,
): number {
  const uvx = (pixelX - 0.5 * pixelWidth) / Math.max(1, pixelHeight);
  // Match shader: t = 0.2*iTime + 2π i/n
  const t = 0.2 * time + (Math.PI * 2 * fiberIndex) / Math.max(1, lineCount);
  const m = Math.max(1, Math.min(10, 1 + settings.wrinkles * 1.6));
  let wave = 0;
  switch (recipe) {
    case 0: {
      wave = Math.sin(t + 11 * uvx) - 4 * uvx * Math.cos(t * 0.5);
      break;
    }
    case 1: {
      wave = Math.sin(m * t + 11 * uvx) - 4 * uvx * Math.cos(t * 0.5);
      break;
    }
    case 2: {
      wave = Math.sin(m * t + 11 * uvx) - 4 * uvx * Math.cos(t);
      break;
    }
    default: {
      const _exhaustive: never = recipe;
      void _exhaustive;
      wave = 0;
      break;
    }
  }
  const uvy = 0.25 * wave;
  const mid = pixelHeight * settings.centerY;
  return mid - uvy * pixelHeight;
}

/** Normalized-Y wrapper for tests (assumes 5:1 banner). Prefer twizzlerShaderPackPixelY. */
export function twizzlerShaderPackY(
  xT: number,
  fiberT: number,
  time: number,
  settings: Pick<TwizzlerSettings, "wrinkles" | "centerY">,
  recipe: 0 | 1 | 2 = 0,
  lineCount = 40,
): number {
  const W = 1600;
  const H = 320;
  const fiberIndex = fiberT * Math.max(1, lineCount);
  return twizzlerShaderPackPixelY(xT * W, W, H, fiberIndex, lineCount, time, settings, recipe) / H;
}

/** depthTerrain 3/4/5 → exact sine-pack recipes 0/1/2 (Canvas2D orange-wave stays on 0–2). */
export function twizzlerShaderPackRecipe(depthTerrain: number): 0 | 1 | 2 | null {
  const t = Math.round(depthTerrain);
  if (t === 3) return 0;
  if (t === 4) return 1;
  if (t === 5) return 2;
  return null;
}

/**
 * Marketing banner centerline in normalized Y (0=top, 1=bottom).
 * Each depthTerrain uses a different spine + wave recipe so A/B/C read differently.
 */
export function twizzlerMarketingCenterY(xT: number, settings: TwizzlerSettings, time: number): number {
  const x = Math.max(0, Math.min(1, xT));
  const terrain = Math.round(Math.max(0, Math.min(2, settings.depthTerrain))) as 0 | 1 | 2;
  let yKnot = 0.55;
  const waveGain = 0.55 + settings.amplitude * 1.35;
  let waves = 0;
  switch (terrain) {
    case 0: {
      // Rolling multi-hill spine (A2 family).
      yKnot = sampleKnots(x, [
        [0.0, 0.58],
        [0.1, 0.74],
        [0.22, 0.88],
        [0.36, 0.7],
        [0.48, 0.9],
        [0.6, 0.52],
        [0.72, 0.3],
        [0.86, 0.2],
        [1.0, 0.38],
      ]);
      waves =
        waveGain *
        1.35 *
        (-0.11 * Math.sin(x * Math.PI * 2.2 + 0.3) +
          -0.09 * Math.sin(x * Math.PI * 3.8 + 1.0) +
          -0.07 * Math.sin(x * Math.PI * 5.6 + 2.1) +
          -0.045 * Math.sin(x * Math.PI * 8.0 + time * 0.25));
      break;
    }
    case 1: {
      // Jagged high-energy spine — deep valley then sharp multi-peaks.
      yKnot = sampleKnots(x, [
        [0.0, 0.42],
        [0.12, 0.68],
        [0.24, 0.95],
        [0.34, 0.55],
        [0.42, 0.98],
        [0.52, 0.35],
        [0.62, 0.12],
        [0.74, 0.45],
        [0.86, 0.08],
        [1.0, 0.4],
      ]);
      waves =
        waveGain *
        1.85 *
        (-0.14 * Math.sin(x * Math.PI * 3.6 + 0.15) +
          -0.12 * Math.sin(x * Math.PI * 6.4 + 1.3) +
          -0.1 * Math.sin(x * Math.PI * 9.8 + 2.4) +
          -0.07 * Math.sin(x * Math.PI * 13.5 + time * 0.2) +
          -0.05 * Math.sin(x * Math.PI * 17.2 + 0.8));
      break;
    }
    case 2: {
      // Long sparse sweep — one big trough, one big rise, soft settle.
      yKnot = sampleKnots(x, [
        [0.0, 0.5],
        [0.15, 0.62],
        [0.35, 0.92],
        [0.55, 0.78],
        [0.72, 0.22],
        [0.88, 0.35],
        [1.0, 0.48],
      ]);
      waves =
        waveGain *
        1.2 *
        (-0.16 * Math.sin(x * Math.PI * 1.2 + 0.2) +
          -0.09 * Math.sin(x * Math.PI * 2.0 + 1.4) +
          -0.04 * Math.sin(x * Math.PI * 3.1 + 0.7));
      break;
    }
    default: {
      const _exhaustive: never = terrain;
      void _exhaustive;
      waves = 0;
      break;
    }
  }
  const edges = twizzlerEdgeHeights(time, 0, settings);
  const edgeBias = (edges.left - 0.55) * (1 - x) + (edges.right - 0.4) * x;
  const bend = twizzlerPathBend(x, settings) * 1.15;
  const yAbs = yKnot + waves + edgeBias * 0.3 + bend;
  return settings.centerY + (yAbs - 0.55) * settings.scale;
}

/**
 * Intrinsic ribbon half-height (before twist projection).
 * Smooth pinch → wide fan. No high-freq width chatter.
 */
export function twizzlerMarketingWidth(xT: number, settings: TwizzlerSettings): number {
  const x = Math.max(0, Math.min(1, xT));
  const half = sampleKnots(x, [
    [0.0, 0.14],
    [0.15, 0.17],
    [0.3, 0.22],
    [0.42, 0.1],
    [0.55, 0.24],
    [0.72, 0.4],
    [0.88, 0.38],
    [1.0, 0.36],
  ]);
  const ampScale = 0.85 + settings.amplitude * 0.45;
  // depthSpread opens the pack vertically; capped so fibers stay mostly on-canvas.
  const spreadBoost = 1 + settings.depthSpread * 0.7 * Math.pow(smoothstep(0.12, 1, x), 0.7);
  const depthBoost = 1 + (twizzlerDepthScale(x, settings) - 1) * 0.1;
  const taper = 1 - settings.edgeTaper * 0.08 * (1 - Math.sin(Math.PI * x));
  return Math.min(0.3, Math.max(0.06, half * ampScale * spreadBoost * depthBoost * taper));
}

/**
 * Twist angle θ(x): soft pinch at valley, open face on the right fan.
 */
export function twizzlerMarketingTwist(xT: number, settings: TwizzlerSettings, time: number): number {
  const x = Math.max(0, Math.min(1, xT));
  const pinch = Math.exp(-Math.pow((x - 0.42) / 0.09, 2));
  const open = Math.pow(smoothstep(0.52, 0.96, x), 1.1);
  const theta = 0.3 + settings.twist * (0.7 * pinch - 0.28 * open);
  return Math.max(0.2, Math.min(1.25, theta)) + time * 0.02;
}

/** Face-on amount 0..1 from twist (1 = full fan, 0 = edge-on). */
export function twizzlerFaceAmount(theta: number): number {
  return Math.abs(Math.cos(theta));
}

/** Horizontal color mix 0..1 along the marketing ribbon (pale → coral). */
export function twizzlerColorT(xT: number): number {
  const x = Math.max(0, Math.min(1, xT));
  return Math.pow(smoothstep(0.06, 0.75, x), 0.8);
}

/**
 * Camera nearness 0..1 for a fiber at (across, xT).
 * Z = into the screen (away from camera = far / low nearness).
 * Stretches mid-pack toward near/far poles so the depth stack is not condensed.
 */
export function twizzlerFiberNearness(across: number, xT: number, settings: TwizzlerSettings, time: number): number {
  const x = Math.max(0, Math.min(1, xT));
  const theta = twizzlerMarketingTwist(x, settings, time);
  const stackNear = (across + 1) * 0.5; // -1 far → 0, +1 near → 1
  // Nonlinear stretch: empty the middle of the Z pack.
  const stretched =
    stackNear < 0.5 ? 0.5 * Math.pow(stackNear * 2, 1.45) : 1 - 0.5 * Math.pow((1 - stackNear) * 2, 1.45);
  const twistZ = across * Math.sin(theta) * 0.05;
  const alongPull = 0.06 * Math.pow(smoothstep(0.55, 1, x), 1.25);
  const volume = twizzlerNearness(twizzlerDepthScale(x, settings), settings);
  // When the ribbon volume opens (right fan), push far further away and near closer.
  const volumePull = (stretched - 0.5) * volume * 0.22;
  const near = 0.02 + 0.9 * stretched + twistZ + alongPull + volumePull;
  return Math.max(0, Math.min(1, near));
}

/** Fog blend 0..1 toward background (white). Far fibers dissolve hard into the stage. */
export function twizzlerFogAmount(nearness: number): number {
  return Math.pow(1 - nearness, 0.68);
}

/** Blend ribbon hex into white by fog amount (cheap distance fade). */
export function twizzlerFogColor(hex: string, fog: number, backgroundHex = "#ffffff"): string {
  return twizzlerLerpColor(hex, backgroundHex, Math.max(0, Math.min(1, fog)));
}

/** Stroke width scale from nearness — thick toward camera, hairline when far. */
export function twizzlerStrokeWidthScale(nearness: number): number {
  return 0.1 + 3.8 * Math.pow(nearness, 1.4);
}

/**
 * Pull fiber slots toward near/far poles so Z depth is not a tight mid cluster.
 * `expand` 0 = leave slots; higher = stronger pole stretch.
 */
export function twizzlerExpandAcross(across: number, expand: number): number {
  const amount = Math.max(0, Math.min(2, expand));
  if (amount <= 0.001) return Math.max(-1, Math.min(1, across));
  const s = across < 0 ? -1 : 1;
  const a = Math.abs(across);
  const power = Math.max(0.28, 1 - amount * 0.42);
  return s * Math.pow(a, power);
}

/**
 * Warp fiber across-position along X with noise so inter-ribbon gaps
 * open/close irregularly from left → right (not a fixed parallel pack).
 */
export function twizzlerGapWarpedAcross(
  across: number,
  xT: number,
  fiberIndex: number,
  gapNoise = 0.9,
  seed = 3.1,
): number {
  const x = Math.max(0, Math.min(1, xT));
  const amount = Math.max(0, Math.min(2.5, gapNoise));
  // Mid pack field: enough L→R gap life without flinging fibers out of the envelope.
  const packN =
    0.46 * twizzlerNoise(x * 1.65 + seed * 0.2, seed * 0.71, 0.33) +
    0.34 * twizzlerNoise(x * 3.6 + 1.3, seed * 1.4, 0.88) +
    0.2 * twizzlerNoise(x * 7.8 + 0.6, seed * 0.5, 1.6);
  const pack = 0.62 + packN * (0.55 + amount * 0.45);
  // Neighbor gap jitter — modest, then pulled back toward the nominal slot.
  const jitter =
    (twizzlerNoise(x * 2.7 + fiberIndex * 0.67, fiberIndex * 1.19 + seed, 1.35) - 0.5) * (0.2 + amount * 0.22) +
    (twizzlerNoise(x * 6.0 + fiberIndex * 0.31, seed + 2.4, 0.55) - 0.5) * (0.1 + amount * 0.14);
  const warped = Math.tanh(across * pack + jitter * amount) * 1.12;
  // Majority stay in the pack/viewport envelope; noise only nudges relative spacing.
  return across * 0.62 + warped * 0.38;
}

/**
 * Top-down amplitude heat map over (x along ribbon, across = Z / depth stack).
 * Multiple scattered hot spots through Z×X — not one pack-wide L→R swell.
 * `patchScale` >1 = fewer larger lobes; <1 = denser Z spots.
 */
export function twizzlerAmpHeat(xT: number, across: number, patchScale = 1, seed = 2.4): number {
  const x = Math.max(0, Math.min(1, xT));
  const a = Math.max(-1, Math.min(1, across));
  const s = Math.max(0.45, Math.min(3.2, patchScale));
  const xFreq = 2.6 / s;
  const zFreq = 4.6 / s;
  const n0 = twizzlerNoise(x * xFreq + seed, a * zFreq, 0.2);
  const n1 = twizzlerNoise(x * (xFreq * 1.6) + seed * 1.3, a * (zFreq * 1.4) + 0.55, 0.72);
  const raw = 0.55 * n0 + 0.45 * n1;
  return Math.pow(smoothstep(0.26, 0.7, raw), 1.05);
}

/**
 * Signed Y swell: narrow Z-bands with phase-shifted hills along X.
 * Far / mid / near bands peak at different X — multiple peaks through the stack.
 */
export function twizzlerAmpSwell(xT: number, across: number, patchScale = 1, seed = 3.1): number {
  const x = Math.max(0, Math.min(1, xT));
  const a = Math.max(-1, Math.min(1, across));
  const s = Math.max(0.45, Math.min(3.2, patchScale));
  // Narrow bands so neighboring Z regions keep distinct peak phases.
  const bandCount = 5;
  const bandWidth = 0.2 * s;
  let sum = 0;
  let wSum = 0;
  for (let k = 0; k < bandCount; k += 1) {
    const zCenter = -0.9 + (k / (bandCount - 1)) * 1.8;
    const w = Math.exp(-Math.pow((a - zCenter) / bandWidth, 2));
    const phase = seed * 0.85 + k * 2.85;
    // 2–4 hills along X per band, phase-shifted by Z index.
    const hills =
      0.55 * Math.sin(x * Math.PI * (2.8 + k * 0.85) + phase) +
      0.3 * Math.sin(x * Math.PI * (4.6 + k * 0.55) + phase * 1.55) +
      0.15 * Math.sin(x * Math.PI * (1.6 + k * 0.3) + phase * 0.7);
    const gate = 0.45 + 0.55 * twizzlerNoise(x * (1.1 / s) + seed + k * 0.7, zCenter * 2.4, 0.4);
    sum += w * hills * gate;
    wSum += w;
  }
  const lobe = wSum > 1e-6 ? sum / wSum : 0;
  return Math.tanh(lobe * 1.85);
}

/**
 * Y-amplitude from Z-scattered heat patches (pixel units).
 * Strong enough to read as extra peaks/valleys inside the pack, still capped on-canvas.
 */
export function twizzlerAmpNoiseY(
  xT: number,
  across: number,
  pixelHeight: number,
  amplitude: number,
  wrinkleStrength: number,
  patchScale = 1,
  seed = 2.4,
): number {
  const heat = twizzlerAmpHeat(xT, across, patchScale, seed);
  const swell = twizzlerAmpSwell(xT, across, patchScale, seed + 1.7);
  // Heat spots boost amplitude; keep below clip so phase-shifted Z peaks stay curved.
  const drive = swell * (0.4 + 0.6 * heat);
  const yThrow = 0.22 + amplitude * 0.2 + wrinkleStrength * 2.6;
  return drive * pixelHeight * yThrow;
}

/**
 * Uneven fiber slots across [-1,1] — irregular gaps instead of even spacing.
 * `gapNoise` 0 = uniform; ~0.35–0.7 = organic cluster/spread.
 */
export function twizzlerUnevenAcross(lineCount: number, gapNoise = 0.55, seed = 2.1): number[] {
  const count = Math.max(1, Math.round(lineCount));
  if (count === 1) return [0];
  const amount = Math.max(0, Math.min(1.5, gapNoise));
  const weights: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const n = twizzlerNoise(i * 0.41 + seed, seed * 1.7, 0.63);
    // Occasional wider gaps + tighter clusters (kept modest so most fibers stay in-pack).
    const burst = twizzlerNoise(i * 0.19, seed + 4.2, 1.1);
    weights.push(Math.max(0.2, 0.48 + amount * (n * 1.15 - 0.28) + amount * 0.4 * (burst > 0.78 ? burst * 0.85 : 0)));
  }
  const sum = weights.reduce((acc, value) => acc + value, 0);
  let cursor = 0;
  return weights.map((weight) => {
    const mid = cursor + weight * 0.5;
    cursor += weight;
    return (mid / sum) * 2 - 1;
  });
}

/**
 * Screen-space Y bias from Z nearness + along-X terrain.
 * Right edge rule: furthest-from-camera fibers go lowest (largest +Y).
 * `depthTerrain`: 0 rolling (A), 1 jagged (B), 2 long far-drop sweep (C).
 */
export function twizzlerDepthYBias(
  nearness: number,
  pixelHeight: number,
  depthLift: number,
  xT = 0.5,
  waveAmp = 1,
  depthTerrain = 0,
): number {
  const far = 1 - nearness;
  // Readable on-canvas Z→Y separation (~±0.22H) while still reading deep.
  const amp = pixelHeight * (0.08 + depthLift * 0.1) * Math.min(1.4, 0.7 + waveAmp * 0.15);
  const right = Math.pow(smoothstep(0.38, 1, xT), 1.15);
  const mid = Math.sin(Math.PI * xT);

  // Shared: far fibers plunge on the right edge (largest +Y).
  const farRightDrop = far * right * amp * 1.05;
  // Near fibers ride higher on the right (toward camera / upper stack).
  const nearRightHold = -nearness * right * amp * 0.55;

  const terrain = Math.round(Math.max(0, Math.min(2, depthTerrain))) as 0 | 1 | 2;
  let hills = 0;
  switch (terrain) {
    case 0: {
      // A — rolling multi-hills; mid near-dip, far inverse, then far right plunge.
      const h1 = -Math.cos((xT - 0.12) * Math.PI * 2.4);
      const h2 = -Math.cos((xT - 0.4) * Math.PI * 3.6);
      const h3 = -Math.cos((xT - 0.68) * Math.PI * 2.9);
      const profile = 0.5 * h1 + 0.35 * h2 + 0.3 * h3;
      hills = (nearness * profile * 0.45 + far * (-0.55 * profile) * (1 - right * 0.65)) * amp * 0.32;
      hills += nearness * mid * (1 - right) * amp * 0.1;
      break;
    }
    case 1: {
      // B — jagged high-freq Z terrain; strong separation L→R.
      const j1 = Math.sin(xT * Math.PI * 5.2 + far * 1.7);
      const j2 = Math.sin(xT * Math.PI * 8.4 + nearness * 2.4);
      const j3 = Math.sin(xT * Math.PI * 3.1 + 0.9);
      hills = (far * (0.55 * j1 + 0.4 * j2) + nearness * (-0.35 * j1 + 0.25 * j3)) * amp * 0.42;
      hills += far * Math.pow(smoothstep(0.2, 0.85, xT), 1.1) * amp * 0.18;
      break;
    }
    case 2: {
      // C — long sweeping Z curve: far starts mid-high, plunges hardest at right.
      const sweep = Math.pow(smoothstep(0.15, 1, xT), 1.6);
      hills = far * (-0.35 + sweep * 1.25) * amp * 0.7;
      hills += nearness * (0.22 - sweep * 0.55) * amp * 0.45;
      hills += far * Math.sin(xT * Math.PI * 1.6) * amp * 0.08;
      break;
    }
    default: {
      const _exhaustive: never = terrain;
      void _exhaustive;
      hills = 0;
      break;
    }
  }

  return farRightDrop + nearRightHold + hills;
}

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
export function twizzlerSoftenFiberCorners(
  points: Array<{ x: number; y: number; depth: number; along: number; nearness: number }>,
  radius = 6,
): void {
  if (points.length < 3 || radius <= 0) return;
  const ys = points.map((pt) => pt.y);
  const sigma = Math.max(0.75, radius * 0.45);
  const out = new Array<number>(ys.length);
  for (let i = 0; i < ys.length; i += 1) {
    let sum = 0;
    let wSum = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const j = Math.min(ys.length - 1, Math.max(0, i + k));
      const w = Math.exp((-k * k) / (2 * sigma * sigma));
      sum += ys[j]! * w;
      wSum += w;
    }
    out[i] = sum / Math.max(1e-6, wSum);
  }
  for (let i = 0; i < points.length; i += 1) {
    points[i]!.y = out[i]!;
  }
}

export function buildTwizzlerLines(
  width: number,
  height: number,
  timeSec: number,
  input: Partial<TwizzlerSettings> = TWIZZLER_DEFAULTS,
): { settings: TwizzlerSettings; lines: TwizzlerLine[] } {
  const pixelWidth = Math.max(1, Math.round(width));
  const pixelHeight = Math.max(1, Math.round(height));
  const settings = normalizeTwizzlerSettings(input);
  const time = twizzlerAnimationTime(timeSec, settings.speed);
  const layerCount = Math.max(1, settings.lineCount);
  // Match orange-wave-vector.html POINTS=160 at reference sizes; scale with width so
  // wide banners stay smooth (never use the short axis — that made 5:1 banners ~32 pts).
  const pointCount = Math.max(160, Math.min(720, Math.round(pixelWidth / Math.max(2, settings.pointSpacing))));
  const rotX = (settings.rotateXDeg * Math.PI) / 180;
  const rotY = (settings.rotateYDeg * Math.PI) / 180;
  const rotZ = (settings.rotateZDeg * Math.PI) / 180;
  // Match orange-wave-vector.html: fixed world X range (not aspect-expanded).
  // Wide canvases fill via HTML screen map (sx uses W, sy uses H).
  const xRange = ORANGE_WAVE_X_RANGE;
  const camDist = settings.camDist;
  const fov = settings.fov;
  const zoom = settings.scale;

  const rotated: WavePoint[][] = [];
  for (let i = 0; i < layerCount; i += 1) {
    const z =
      layerCount <= 1
        ? (ORANGE_WAVE_Z_MIN + ORANGE_WAVE_Z_MAX) * 0.5
        : ORANGE_WAVE_Z_MIN + ((ORANGE_WAVE_Z_MAX - ORANGE_WAVE_Z_MIN) * i) / (layerCount - 1);
    const layer: WavePoint[] = [];
    for (let j = 0; j < pointCount; j += 1) {
      const u = pointCount <= 1 ? 0 : (j / (pointCount - 1)) * 2 - 1;
      const x = u * xRange;
      const y = orangeWaveY(x, z, time, settings.amplitude, xRange);
      // HTML orange-wave-vector: rotX → rotY → rotZ, then perspective on rotated coords.
      let q: Vec3 = { x, y, z };
      q = orangeWaveRotX(q, rotX);
      q = orangeWaveRotY(q, rotY);
      q = orangeWaveRotZ(q, rotZ);
      layer.push({ ...q, u, origX: x, origY: y, origZ: z });
    }
    rotated.push(layer);
  }

  let minPX = Infinity;
  let maxPX = -Infinity;
  for (const layer of rotated) {
    for (const p of layer) {
      const depth = camDist + p.z;
      if (depth < 0.4) continue;
      const px = (p.x / depth) * fov;
      if (px < minPX) minPX = px;
      if (px > maxPX) maxPX = px;
    }
  }
  const span = Math.max(0.001, maxPX - minPX);
  // Unbounded zoom: do not cap fitScale (HTML used Math.min(2.2, …) which locked L/R).
  const fitScale = (1.88 * zoom) / Math.max(0.001, span);
  const mid = (minPX + maxPX) * 0.5;

  const colXA = parseRgb(settings.colorFar);
  const colXB = parseRgb(settings.colorNear);
  const colYA = parseRgb(settings.colorEdge);
  const colYB = parseRgb(settings.colorNear);
  const baseOrange = parseRgb(settings.color);
  const backgroundRgb = parseRgb(settings.backgroundColor);

  const lines: TwizzlerLine[] = [];
  for (let i = 0; i < rotated.length; i += 1) {
    const layer = rotated[i]!;
    const across = layerCount <= 1 ? 0 : (i / (layerCount - 1)) * 2 - 1;
    const points: TwizzlerLine["points"] = [];
    let sumA = 0;
    let sumD = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let cnt = 0;

    for (let j = 0; j < layer.length; j += 1) {
      const p = layer[j]!;
      const depth = camDist + p.z;
      if (depth < 0.4) continue;

      let a = orangeWaveSmoothstep(3.2, 0.3, Math.abs(p.origZ + 0.15));
      a *= orangeWaveSmoothstep(1.12, 0.58, Math.abs(p.u));
      a *= orangeWaveSmoothstep(0.2, 1.0, depth / 14);

      // Z factor: 1 near camera / low Z, 0 far / high Z (after center+width shaping).
      const gradientsOn = twizzlerUsesLineGradients(settings);
      let zNearFactor = 1;
      if (gradientsOn && settings.gradientZEnabled) {
        let g = ((p.origZ - ORANGE_WAVE_Z_MIN) / (ORANGE_WAVE_Z_MAX - ORANGE_WAVE_Z_MIN)) * 2 - 1;
        g = (g - settings.gradientZCenter) / Math.max(0.05, settings.gradientZWidth);
        zNearFactor = Math.max(0, Math.min(1, orangeWaveSmoothstep(1.2, -0.2, g)));
      }

      let col = { ...baseOrange };
      if (gradientsOn && settings.gradientXEnabled) {
        const tx = (p.origX / xRange) * 0.5 + 0.5;
        const cx = lerpRgb(colXA, colXB, Math.max(0, Math.min(1, tx)));
        col = lerpRgb(col, cx, settings.gradientXMix);
      }
      if (gradientsOn && settings.gradientYEnabled && settings.gradientYMix > 0) {
        const yNorm = p.origY / (0.55 * settings.amplitude + 0.01);
        const extreme = Math.min(1, Math.abs(yNorm));
        const influence = orangeWaveSmoothstep(0.15, 0.7, extreme) * settings.gradientYMix;
        if (influence > 0.001) {
          const target = yNorm >= 0 ? colYA : colYB;
          col = lerpRgb(col, target, influence);
        }
      }
      // Default Z look: foreground → background as depth increases (near keeps ink).
      if (gradientsOn && settings.gradientZEnabled && settings.gradientZStrength > 0) {
        const farMix = (1 - zNearFactor) * Math.min(1, settings.gradientZStrength);
        col = lerpRgb(col, backgroundRgb, farMix);
      }

      if (a < 0.008) continue;

      // HTML: sx = (ndcX*0.5+0.5)*W, sy = (0.5-ndcY*0.5)*H — use rotated p.x/p.y/p.z.
      const ndcX = ((p.x / depth) * fov - mid) * fitScale;
      const ndcY = (p.y / depth) * fov * 1.25 * zoom;
      const x = (ndcX * 0.5 + 0.5) * pixelWidth;
      const y = (0.5 - ndcY * 0.5) * pixelHeight;
      const nearness = Math.max(0, Math.min(1, 1 - (depth - 8) / 6));
      const hex = rgbToHex(col);
      points.push({
        x,
        y,
        depth,
        along: (p.u + 1) * 0.5,
        nearness,
        alpha: a,
        color: hex,
      });
      sumA += a;
      sumD += depth;
      sumR += col.r;
      sumG += col.g;
      sumB += col.b;
      cnt += 1;
    }

    if (points.length < 2) continue;
    const avgA = sumA / Math.max(1, cnt);
    if (avgA < 0.01) continue;
    const avgDepth = sumD / Math.max(1, cnt);
    const depthRatio = camDist / Math.max(0.4, avgDepth);
    const rawW = settings.lineWidth * (1 + (depthRatio - 1) * settings.perspectiveWidth);
    const strokeWidth = Math.max(settings.minLineWidth, Math.min(settings.maxLineWidth, rawW));
    const nearness = Math.max(0, Math.min(1, 1 - (avgDepth - 8) / 6));
    const avgColor = rgbToHex({ r: sumR / cnt, g: sumG / cnt, b: sumB / cnt });

    lines.push({
      across,
      opacity: Math.min(1, avgA * 1.45) * settings.opacity,
      color: avgColor,
      nearness,
      strokeWidth,
      points,
    });
  }

  // Shift the pack so visible ink average sits on centerY, then Move X/Y/Z.
  // Move Z is a post-fit dolly (auto-fit would cancel a pure world-Z shift).
  const targetY = pixelHeight * settings.centerY;
  for (let iter = 0; iter < 4; iter += 1) {
    let ySum = 0;
    let yCount = 0;
    for (const line of lines) {
      for (const point of line.points) {
        if (point.y >= 0 && point.y <= pixelHeight) {
          ySum += point.y;
          yCount += 1;
        }
      }
    }
    if (yCount <= 0) break;
    const shift = targetY - ySum / yCount;
    if (Math.abs(shift) < 0.25) break;
    for (const line of lines) {
      for (const point of line.points) {
        point.y += shift;
      }
    }
  }

  const dolly = Math.max(0.05, Math.min(20, Math.exp(-settings.panZ * 0.35)));
  const originX = pixelWidth * 0.5;
  const originY = pixelHeight * settings.centerY;
  if (dolly !== 1 || settings.panX !== 0 || settings.panY !== 0) {
    for (const line of lines) {
      for (const point of line.points) {
        point.x = originX + (point.x - originX) * dolly + settings.panX;
        point.y = originY + (point.y - originY) * dolly + settings.panY;
      }
    }
  }

  return { settings, lines };
}

/** Outline a centerline into left/right polygons for filled ribbons. */
export function outlinePolylinePolygon(
  points: readonly { x: number; y: number }[],
  strokeWidth: number,
): { x: number; y: number }[] | null {
  if (points.length < 2 || strokeWidth <= 0) return null;
  const half = strokeWidth * 0.5;
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-8) {
      dx = 1;
      dy = 0;
    } else {
      dx /= len;
      dy /= len;
    }
    left.push({ x: p.x + -dy * half, y: p.y + dx * half });
    right.push({ x: p.x - -dy * half, y: p.y - dx * half });
  }
  return [...left, ...right.reverse()];
}

export type TwizzlerCanvas = HTMLCanvasElement | OffscreenCanvas;
type TwizzlerContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function context2d(canvas: TwizzlerCanvas): TwizzlerContext | null {
  return canvas.getContext("2d") as TwizzlerContext | null;
}

function createInternalCanvas(width: number, height: number): TwizzlerCanvas {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return new OffscreenCanvas(width, height);
}

function fillOutlinedRibbon(
  context: TwizzlerContext,
  points: readonly { x: number; y: number }[],
  strokeWidth: number,
): void {
  const poly = outlinePolylinePolygon(points, strokeWidth);
  if (!poly || poly.length < 3) return;
  context.beginPath();
  context.moveTo(poly[0]!.x, poly[0]!.y);
  for (let i = 1; i < poly.length; i += 1) {
    context.lineTo(poly[i]!.x, poly[i]!.y);
  }
  context.closePath();
  context.fill();
}

/**
 * Horizontal span for a fiber-local X gradient (colorFar at left → colorNear at right).
 * Includes half stroke width so the ramp covers the outlined ribbon silhouette.
 */
export function ribbonGradientXSpan(
  points: readonly { x: number; y: number }[],
  strokeWidth: number,
): { x1: number; x2: number } | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
  }
  const pad = Math.max(0, strokeWidth) * 0.5;
  const x1 = minX - pad;
  const x2 = Math.max(maxX + pad, x1 + 1e-3);
  return { x1, x2 };
}

/** Axis-aligned box for a fiber-local 2D color field, padded by half stroke. */
export function ribbonGradientXYSpan(
  points: readonly { x: number; y: number }[],
  strokeWidth: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = Math.max(0, strokeWidth) * 0.5;
  const x1 = minX - pad;
  const y1 = minY - pad;
  const x2 = Math.max(maxX + pad, x1 + 1e-3);
  const y2 = Math.max(maxY + pad, y1 + 1e-3);
  return { x1, y1, x2, y2 };
}

type GradientFieldCache = { key: string; canvas: TwizzlerCanvas };
type ScaledGradientFieldCache = { key: string; width: number; height: number; canvas: TwizzlerCanvas };

let gradientFieldCache: GradientFieldCache | null = null;
let scaledGradientFieldCache: ScaledGradientFieldCache | null = null;

function getTwizzlerGradientFieldCanvas(stops: readonly TwizzlerGradientStop[]): TwizzlerCanvas | null {
  const key = serializeTwizzlerGradientStops(stops);
  if (gradientFieldCache && gradientFieldCache.key === key) return gradientFieldCache.canvas;
  const canvas =
    gradientFieldCache?.canvas ??
    createInternalCanvas(TWIZZLER_GRADIENT_FIELD_RASTER_WIDTH, TWIZZLER_GRADIENT_FIELD_RASTER_HEIGHT);
  canvas.width = TWIZZLER_GRADIENT_FIELD_RASTER_WIDTH;
  canvas.height = TWIZZLER_GRADIENT_FIELD_RASTER_HEIGHT;
  const context = context2d(canvas);
  if (!context) return null;
  const pixels = rasterizeTwizzlerGradientField(stops, canvas.width, canvas.height);
  const image = context.createImageData(canvas.width, canvas.height);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  gradientFieldCache = { key, canvas };
  scaledGradientFieldCache = null;
  return canvas;
}

/** One scaled field bitmap per size — avoids N× bilinear upscales in sharedGradient. */
function getTwizzlerGradientFieldCanvasScaled(
  stops: readonly TwizzlerGradientStop[],
  width: number,
  height: number,
): TwizzlerCanvas | null {
  const source = getTwizzlerGradientFieldCanvas(stops);
  if (!source) return null;
  const key = serializeTwizzlerGradientStops(stops);
  if (
    scaledGradientFieldCache &&
    scaledGradientFieldCache.key === key &&
    scaledGradientFieldCache.width === width &&
    scaledGradientFieldCache.height === height
  ) {
    return scaledGradientFieldCache.canvas;
  }
  const canvas = scaledGradientFieldCache?.canvas ?? createInternalCanvas(width, height);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = context2d(canvas);
  if (!context) return null;
  context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  scaledGradientFieldCache = { key, width, height, canvas };
  return canvas;
}

function clipOutlinedRibbon(
  context: TwizzlerContext,
  points: readonly { x: number; y: number }[],
  strokeWidth: number,
): boolean {
  const poly = outlinePolylinePolygon(points, strokeWidth);
  if (!poly || poly.length < 3) return false;
  context.beginPath();
  context.moveTo(poly[0]!.x, poly[0]!.y);
  for (let i = 1; i < poly.length; i += 1) {
    context.lineTo(poly[i]!.x, poly[i]!.y);
  }
  context.closePath();
  context.clip();
  return true;
}

export function renderTwizzler(
  canvas: TwizzlerCanvas,
  width: number,
  height: number,
  timeSec: number,
  input: Partial<TwizzlerSettings> = TWIZZLER_DEFAULTS,
): void {
  const pixelWidth = Math.max(1, Math.round(width));
  const pixelHeight = Math.max(1, Math.round(height));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const context = context2d(canvas);
  if (!context) return;

  const { settings, lines } = buildTwizzlerLines(pixelWidth, pixelHeight, timeSec, input);
  context.clearRect(0, 0, pixelWidth, pixelHeight);
  context.save();
  // Butt caps avoid round-cap dots at every segment joint (orange-wave v3).
  context.lineJoin = "round";
  context.lineCap = "butt";
  context.setLineDash([]);

  const ordered = [...lines].sort((a, b) => a.nearness - b.nearness);
  const colorMode = resolveTwizzlerRibbonColorMode(settings);
  const fieldStops = settings.gradientStops;
  const fieldCanvas = twizzlerUsesFieldGradient(colorMode) ? getTwizzlerGradientFieldCanvas(fieldStops) : null;
  const packLinear =
    colorMode === "sharedLinear"
      ? (() => {
          const gradient = context.createLinearGradient(0, 0, pixelWidth, 0);
          applyTwizzlerGradientStops(gradient, fieldStops);
          return gradient;
        })()
      : null;

  // Shared field: mask all ribbons once, then a single field drawImage (Both-mode win).
  if (colorMode === "sharedGradient" && fieldCanvas) {
    const scaledField = getTwizzlerGradientFieldCanvasScaled(fieldStops, pixelWidth, pixelHeight) ?? fieldCanvas;
    for (const line of ordered) {
      if (line.points.length < 2) continue;
      const strokeWidth = Math.max(settings.minLineWidth, line.strokeWidth);
      context.globalAlpha = Math.max(0.01, Math.min(1, line.opacity));
      context.fillStyle = "#ffffff";
      fillOutlinedRibbon(context, line.points, strokeWidth);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-in";
    context.drawImage(scaledField, 0, 0, pixelWidth, pixelHeight);
    context.globalCompositeOperation = "source-over";
    context.restore();
    return;
  }

  for (const line of ordered) {
    if (line.points.length < 2) continue;
    const strokeWidth = Math.max(settings.minLineWidth, line.strokeWidth);
    context.lineWidth = strokeWidth;

    switch (colorMode) {
      case "solid": {
        context.strokeStyle = line.color;
        context.globalAlpha = Math.max(0.01, Math.min(1, line.opacity));
        context.beginPath();
        context.moveTo(line.points[0]!.x, line.points[0]!.y);
        for (let i = 1; i < line.points.length; i += 1) {
          context.lineTo(line.points[i]!.x, line.points[i]!.y);
        }
        context.stroke();
        break;
      }
      case "sharedLinear": {
        context.fillStyle = packLinear ?? settings.colorNear;
        context.globalAlpha = Math.max(0.01, Math.min(1, line.opacity));
        fillOutlinedRibbon(context, line.points, strokeWidth);
        break;
      }
      case "sharedGradient": {
        context.save();
        context.globalAlpha = Math.max(0.01, Math.min(1, line.opacity));
        if (fieldCanvas && clipOutlinedRibbon(context, line.points, strokeWidth)) {
          context.drawImage(fieldCanvas, 0, 0, pixelWidth, pixelHeight);
        } else {
          context.fillStyle = settings.colorNear;
          fillOutlinedRibbon(context, line.points, strokeWidth);
        }
        context.restore();
        break;
      }
      case "fiberGradient": {
        const span = ribbonGradientXYSpan(line.points, strokeWidth);
        context.save();
        context.globalAlpha = Math.max(0.01, Math.min(1, line.opacity));
        if (fieldCanvas && span && clipOutlinedRibbon(context, line.points, strokeWidth)) {
          context.drawImage(fieldCanvas, span.x1, span.y1, span.x2 - span.x1, span.y2 - span.y1);
        } else {
          context.fillStyle = settings.colorNear;
          fillOutlinedRibbon(context, line.points, strokeWidth);
        }
        context.restore();
        break;
      }
      case "baked": {
        for (let i = 1; i < line.points.length; i += 1) {
          const a0 = line.points[i - 1]!;
          const a1 = line.points[i]!;
          const alpha0 = a0.alpha ?? line.opacity;
          const alpha1 = a1.alpha ?? line.opacity;
          if (alpha0 < 0.008 || alpha1 < 0.008) continue;
          const opacity = Math.min(1, (alpha0 + alpha1) * 0.5 * 1.45 * settings.opacity);
          if (opacity < 0.01) continue;

          const c0 = parseRgb(a0.color ?? line.color);
          const c1 = parseRgb(a1.color ?? line.color);
          const mid = lerpRgb(c0, c1, 0.5);
          context.strokeStyle = rgbToHex(mid);
          context.globalAlpha = opacity;
          context.beginPath();
          context.moveTo(a0.x, a0.y);
          context.lineTo(a1.x, a1.y);
          context.stroke();
        }
        break;
      }
      default: {
        const _exhaustive: never = colorMode;
        void _exhaustive;
        break;
      }
    }
  }

  context.restore();
}

export function clearTwizzler(canvas: TwizzlerCanvas): void {
  context2d(canvas)?.clearRect(0, 0, canvas.width, canvas.height);
}

/** Catmull-Rom → cubic Bézier controls for segment p1 → p2 (passes through samples). */
export function twizzlerCubicControls(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
): { cp1x: number; cp1y: number; cp2x: number; cp2y: number } {
  return {
    cp1x: p1.x + (p2.x - p0.x) / 4,
    cp1y: p1.y + (p2.y - p0.y) / 4,
    cp2x: p2.x - (p3.x - p1.x) / 4,
    cp2y: p2.y - (p3.y - p1.y) / 4,
  };
}

/**
 * Stroke a fiber as cubic Béziers (Catmull-Rom). Same samples, no polyline kinks.
 */
export function twizzlerTraceCubic(context: TwizzlerContext, points: ReadonlyArray<{ x: number; y: number }>): void {
  if (points.length < 2) return;
  const first = points[0]!;
  context.moveTo(first.x, first.y);
  if (points.length === 2) {
    const last = points[1]!;
    context.lineTo(last.x, last.y);
    return;
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c = twizzlerCubicControls(p0, p1, p2, p3);
    context.bezierCurveTo(c.cp1x, c.cp1y, c.cp2x, c.cp2y, p2.x, p2.y);
  }
}

/** SVG path `d` using cubic Béziers through the same samples (matches canvas). */
export function twizzlerSvgPathCubic(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  const fmt = (value: number) => Number(value.toFixed(2)).toString();
  const first = points[0]!;
  if (points.length === 1) return `M${fmt(first.x)} ${fmt(first.y)}`;
  if (points.length === 2) {
    const last = points[1]!;
    return `M${fmt(first.x)} ${fmt(first.y)} L${fmt(last.x)} ${fmt(last.y)}`;
  }
  let d = `M${fmt(first.x)} ${fmt(first.y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c = twizzlerCubicControls(p0, p1, p2, p3);
    d += ` C${fmt(c.cp1x)} ${fmt(c.cp1y)} ${fmt(c.cp2x)} ${fmt(c.cp2y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d;
}
