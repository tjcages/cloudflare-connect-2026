/**
 * Connect Twizzler — orange-wave 3D projected ribbon (Canvas2D + SVG-exportable paths).
 *
 * Geometry (orange-wave-vector): layered Z ribbons with multi-sine waveY(x,z,t),
 * rotated in 3D, perspective-projected, stroked as solid orange hairlines.
 * Legacy marketing helpers below are kept for tests / experiment tooling.
 */

export type TwizzlerSettings = {
  color: string;
  /** Pale gold / far / left (legacy gradient; orange-wave uses `color`). */
  colorFar: string;
  /** Deep coral / near / core (legacy gradient; orange-wave uses `color`). */
  colorNear: string;
  /** Bright yellow/gold on ribbon edges (legacy). */
  colorEdge: string;
  opacity: number;
  scale: number;
  centerY: number;
  /** Wave height multiplier (1 = orange-wave reference). */
  amplitude: number;
  lineCount: number;
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
   * 0 = rolling hills (A), 1 = jagged high-freq (B), 2 = long far-drop sweep (C).
   */
  depthTerrain: number;
  /** Legacy twist (unused by orange-wave projection). */
  twist: number;
  /** Orange-wave 3D rotation in degrees (defaults match the reference HTML). */
  rotateXDeg: number;
  rotateYDeg: number;
  rotateZDeg: number;
  noiseScaleX: number;
  noiseScaleY: number;
  speed: number;
  drift: number;
  /** Stipple dash length in px. 0 = solid. */
  stippleSize: number;
  /** Stipple gap scale. */
  stippleGap: number;
};

export const TWIZZLER_DEFAULTS: TwizzlerSettings = {
  // Orange / 900 [Accent] from COLOR_LIBRARY (not freeform HTML #ff6709).
  color: "#f46021",
  colorFar: "#f46021",
  colorNear: "#f46021",
  colorEdge: "#f46021",
  opacity: 1,
  scale: 1,
  centerY: 0.5,
  amplitude: 1,
  lineCount: 56,
  lineWidth: 1.15,
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
  noiseScaleX: 0.0004,
  noiseScaleY: 0.01,
  speed: 1,
  drift: 0.02,
  stippleSize: 0,
  stippleGap: 0.8,
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

export function normalizeTwizzlerColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : TWIZZLER_DEFAULTS.color;
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

export function normalizeTwizzlerSettings(value: unknown): TwizzlerSettings {
  const input = value && typeof value === "object" ? (value as Partial<TwizzlerSettings>) : {};
  const color = normalizeTwizzlerColor(input.color);
  return {
    color,
    colorFar: normalizeTwizzlerColor(input.colorFar ?? TWIZZLER_DEFAULTS.colorFar),
    colorNear: normalizeTwizzlerColor(input.colorNear ?? color),
    colorEdge: normalizeTwizzlerColor(input.colorEdge ?? TWIZZLER_DEFAULTS.colorEdge),
    opacity: clamp(input.opacity, TWIZZLER_DEFAULTS.opacity, 0, 1),
    scale: clamp(input.scale, TWIZZLER_DEFAULTS.scale, 0.1, 3),
    centerY: clamp(input.centerY, TWIZZLER_DEFAULTS.centerY, 0, 1),
    amplitude: clamp(input.amplitude, TWIZZLER_DEFAULTS.amplitude, 0, 2),
    lineCount: Math.round(clamp(input.lineCount, TWIZZLER_DEFAULTS.lineCount, 1, 400)),
    lineWidth: clamp(input.lineWidth, TWIZZLER_DEFAULTS.lineWidth, 0.15, 8),
    pointSpacing: Math.round(clamp(input.pointSpacing, TWIZZLER_DEFAULTS.pointSpacing, 2, 80)),
    leftHeight: clamp(input.leftHeight, TWIZZLER_DEFAULTS.leftHeight, -1, 2),
    rightHeight: clamp(input.rightHeight, TWIZZLER_DEFAULTS.rightHeight, -1, 2),
    edgeFluctuation: clamp(input.edgeFluctuation, TWIZZLER_DEFAULTS.edgeFluctuation, 0, 0.5),
    edgeSpeed: clamp(input.edgeSpeed, TWIZZLER_DEFAULTS.edgeSpeed, 0, 4),
    edgeTaper: clamp(input.edgeTaper, TWIZZLER_DEFAULTS.edgeTaper, 0, 1),
    wrinkles: clamp(input.wrinkles, TWIZZLER_DEFAULTS.wrinkles, 0, 24),
    wrinkleStrength: clamp(input.wrinkleStrength, TWIZZLER_DEFAULTS.wrinkleStrength, 0, 0.5),
    bendPosition: clamp(input.bendPosition, TWIZZLER_DEFAULTS.bendPosition, 0, 1),
    bendAmount: clamp(input.bendAmount, TWIZZLER_DEFAULTS.bendAmount, -1, 1),
    bend2Position: clamp(input.bend2Position, TWIZZLER_DEFAULTS.bend2Position, 0, 1),
    bend2Amount: clamp(input.bend2Amount, TWIZZLER_DEFAULTS.bend2Amount, -1, 1),
    bend3Position: clamp(input.bend3Position, TWIZZLER_DEFAULTS.bend3Position, 0, 1),
    bend3Amount: clamp(input.bend3Amount, TWIZZLER_DEFAULTS.bend3Amount, -1, 1),
    depthPosition: clamp(input.depthPosition, TWIZZLER_DEFAULTS.depthPosition, 0, 1),
    depthAmount: clamp(input.depthAmount, TWIZZLER_DEFAULTS.depthAmount, 0, 2),
    depthWidth: clamp(input.depthWidth, TWIZZLER_DEFAULTS.depthWidth, 0.05, 0.75),
    depth2Position: clamp(input.depth2Position, TWIZZLER_DEFAULTS.depth2Position, 0, 1),
    depth2Amount: clamp(input.depth2Amount, TWIZZLER_DEFAULTS.depth2Amount, 0, 2),
    depth2Width: clamp(input.depth2Width, TWIZZLER_DEFAULTS.depth2Width, 0.05, 0.75),
    depthSpread: clamp(input.depthSpread, TWIZZLER_DEFAULTS.depthSpread, 0, 4),
    depthLift: clamp(input.depthLift, TWIZZLER_DEFAULTS.depthLift, 0, 1),
    depthTerrain: Math.round(clamp(input.depthTerrain, TWIZZLER_DEFAULTS.depthTerrain, 0, 2)),
    twist: clamp(input.twist, TWIZZLER_DEFAULTS.twist, 0, 6),
    rotateXDeg: clamp(input.rotateXDeg, TWIZZLER_DEFAULTS.rotateXDeg, -180, 180),
    rotateYDeg: clamp(input.rotateYDeg, TWIZZLER_DEFAULTS.rotateYDeg, -180, 180),
    rotateZDeg: clamp(input.rotateZDeg, TWIZZLER_DEFAULTS.rotateZDeg, -180, 180),
    noiseScaleX: clamp(input.noiseScaleX, TWIZZLER_DEFAULTS.noiseScaleX, 0.0001, 0.02),
    noiseScaleY: clamp(input.noiseScaleY, TWIZZLER_DEFAULTS.noiseScaleY, 0.001, 0.1),
    speed: clamp(input.speed, TWIZZLER_DEFAULTS.speed, 0, 3),
    drift: clamp(input.drift, TWIZZLER_DEFAULTS.drift, 0, 1),
    stippleSize: clamp(input.stippleSize, TWIZZLER_DEFAULTS.stippleSize, 0, 8),
    stippleGap: clamp(input.stippleGap, TWIZZLER_DEFAULTS.stippleGap, 0, 12),
  };
}

/** Orange-wave reference constants (from orange-wave-vector.html). */
const ORANGE_WAVE_Z_MIN = -1.8;
const ORANGE_WAVE_Z_MAX = 2.8;
const ORANGE_WAVE_X_RANGE = 6.8;
const ORANGE_WAVE_CAM_DIST = 10.5;
const ORANGE_WAVE_FOV = 1.05;
const ORANGE_WAVE_REF_DEPTH = 10.5;

type Vec3 = { x: number; y: number; z: number };

/** Multi-sine ribbon height from the orange-wave reference. */
export function orangeWaveY(x: number, z: number, t: number, amplitude = 1): number {
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
  const env = Math.max(0, Math.min(1, (8.5 - Math.abs(x)) / (8.5 - 3.8)));
  y *= env * env * (3 - 2 * env);
  return y * amplitude;
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
  /** Primary stroke color for this fiber (SVG + canvas), fog already applied. */
  color: string;
  /** Typical nearness 0..1 (toward camera). */
  nearness: number;
  /** Stroke width in px for this fiber. */
  strokeWidth: number;
  points: Array<{ x: number; y: number; depth: number; along: number; nearness: number }>;
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
  const pointCount = Math.max(32, Math.min(512, Math.round(pixelWidth / Math.max(2, settings.pointSpacing))));
  const rotX = (settings.rotateXDeg * Math.PI) / 180;
  const rotY = (settings.rotateYDeg * Math.PI) / 180;
  const rotZ = (settings.rotateZDeg * Math.PI) / 180;

  const rotated: Vec3[][] = [];
  for (let i = 0; i < layerCount; i += 1) {
    const z =
      layerCount <= 1
        ? (ORANGE_WAVE_Z_MIN + ORANGE_WAVE_Z_MAX) * 0.5
        : ORANGE_WAVE_Z_MIN + ((ORANGE_WAVE_Z_MAX - ORANGE_WAVE_Z_MIN) * i) / (layerCount - 1);
    const layer: Vec3[] = [];
    for (let j = 0; j < pointCount; j += 1) {
      const u = pointCount <= 1 ? 0 : (j / (pointCount - 1)) * 2 - 1;
      const x = u * ORANGE_WAVE_X_RANGE;
      const y = orangeWaveY(x, z, time, settings.amplitude);
      let q: Vec3 = { x, y, z };
      q = orangeWaveRotX(q, rotX);
      q = orangeWaveRotY(q, rotY);
      q = orangeWaveRotZ(q, rotZ);
      layer.push(q);
    }
    rotated.push(layer);
  }

  let minPX = Infinity;
  let maxPX = -Infinity;
  for (const layer of rotated) {
    for (const p of layer) {
      const depth = ORANGE_WAVE_CAM_DIST + p.z;
      if (depth < 0.4) continue;
      const px = (p.x / depth) * ORANGE_WAVE_FOV;
      if (px < minPX) minPX = px;
      if (px > maxPX) maxPX = px;
    }
  }
  const span = Math.max(0.001, maxPX - minPX);
  const fitScale = Math.min(1.35, 1.88 / span);
  const mid = (minPX + maxPX) * 0.5;
  const cx = pixelWidth * 0.5;
  const cy = pixelHeight * 0.5;

  const lines: TwizzlerLine[] = [];
  for (let i = 0; i < rotated.length; i += 1) {
    const layer = rotated[i]!;
    const z0 =
      layerCount <= 1
        ? (ORANGE_WAVE_Z_MIN + ORANGE_WAVE_Z_MAX) * 0.5
        : ORANGE_WAVE_Z_MIN + ((ORANGE_WAVE_Z_MAX - ORANGE_WAVE_Z_MIN) * i) / (layerCount - 1);
    const across = layerCount <= 1 ? 0 : (i / (layerCount - 1)) * 2 - 1;
    const points: TwizzlerLine["points"] = [];
    let sumA = 0;
    let sumD = 0;
    let cnt = 0;

    for (let j = 0; j < layer.length; j += 1) {
      const p = layer[j]!;
      const depth = ORANGE_WAVE_CAM_DIST + p.z;
      if (depth < 0.4) continue;
      const u = pointCount <= 1 ? 0 : (j / (pointCount - 1)) * 2 - 1;
      let a = orangeWaveSmoothstep(3.2, 0.3, Math.abs(z0 + 0.15));
      a *= orangeWaveSmoothstep(1.12, 0.58, Math.abs(u));
      a *= orangeWaveSmoothstep(0.2, 1.0, depth / 14);
      if (a < 0.01) continue;

      const ndcX = ((p.x / depth) * ORANGE_WAVE_FOV - mid) * fitScale;
      const ndcY = (p.y / depth) * ORANGE_WAVE_FOV * 1.25;
      const sx = (ndcX * 0.5 + 0.5) * pixelWidth;
      const sy = (0.5 - ndcY * 0.5) * pixelHeight;
      const x = cx + (sx - cx) * settings.scale;
      const y = cy + (sy - cy) * settings.scale;
      const nearness = Math.max(0, Math.min(1, 1 - (depth - 8) / 6));
      points.push({ x, y, depth, along: (u + 1) * 0.5, nearness });
      sumA += a;
      sumD += depth;
      cnt += 1;
    }

    if (points.length < 2) continue;
    const avgA = sumA / Math.max(1, cnt);
    if (avgA < 0.012) continue;
    const avgDepth = sumD / Math.max(1, cnt);
    const depthRatio = ORANGE_WAVE_REF_DEPTH / Math.max(0.5, avgDepth);
    const strokeWidth = Math.max(0.45, Math.min(2.8, settings.lineWidth * depthRatio));
    const nearness = Math.max(0, Math.min(1, 1 - (avgDepth - 8) / 6));

    lines.push({
      across,
      opacity: Math.min(1, avgA * 1.4) * settings.opacity,
      color: settings.color,
      nearness,
      strokeWidth,
      points,
    });
  }

  // Shift the pack so visible ink average sits on centerY.
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

  return { settings, lines };
}

export function renderTwizzler(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  timeSec: number,
  input: Partial<TwizzlerSettings> = TWIZZLER_DEFAULTS,
): void {
  const pixelWidth = Math.max(1, Math.round(width));
  const pixelHeight = Math.max(1, Math.round(height));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const context = canvas.getContext("2d");
  if (!context) return;

  const { lines } = buildTwizzlerLines(pixelWidth, pixelHeight, timeSec, input);
  context.clearRect(0, 0, pixelWidth, pixelHeight);
  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";
  context.setLineDash([]);

  // Far → near so thicker near fibers sit on top (matches orange-wave draw order).
  const ordered = [...lines].sort((a, b) => a.nearness - b.nearness);

  for (const line of ordered) {
    if (line.points.length < 2 || line.opacity < 0.01) continue;
    context.strokeStyle = line.color;
    context.globalAlpha = Math.min(1, line.opacity);
    context.lineWidth = Math.max(0.45, line.strokeWidth);
    context.beginPath();
    twizzlerTraceCubic(context, line.points);
    context.stroke();
  }

  context.restore();
}

export function clearTwizzler(canvas: HTMLCanvasElement): void {
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
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
export function twizzlerTraceCubic(
  context: CanvasRenderingContext2D,
  points: ReadonlyArray<{ x: number; y: number }>,
): void {
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
