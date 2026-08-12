/**
 * Connect Twizzler — parametric hairline ribbon (Canvas2D + SVG-exportable paths).
 *
 * Geometry: centerline C(x) + half-width W(x) + twist θ(x).
 * Fiber v ∈ [-1,1] projects as offset = v · W · cos(θ) along the path normal.
 * Z (into page / toward camera) drives: fog→white, stroke thickness, and Y bias.
 * Right edge: far fibers go lowest on screen (largest Y). Paths stay smooth.
 */

export type TwizzlerSettings = {
  color: string;
  /** Pale gold / far / left. */
  colorFar: string;
  /** Deep coral / near / core. */
  colorNear: string;
  /** Bright yellow/gold on ribbon edges. */
  colorEdge: string;
  opacity: number;
  scale: number;
  centerY: number;
  /** Base ribbon half-height in normalized canvas units. */
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
   * Z-scattered amplitude heat recipe:
   * 0–2 = pass one; 3–5 = pass two; 6–8 = pass three; 9–11 = pass four.
   */
  heatVariant: TwizzlerHeatVariant;
  /**
   * Z→Y terrain recipe (experiment switch):
   * 0 = rolling hills (A), 1 = jagged high-freq (B), 2 = long far-drop sweep (C).
   */
  depthTerrain: number;
  twist: number;
  noiseScaleX: number;
  noiseScaleY: number;
  speed: number;
  drift: number;
  /** Stipple dash length in px. 0 = solid. */
  stippleSize: number;
  /** Stipple gap scale. */
  stippleGap: number;
};

export type TwizzlerHeatVariant = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const TWIZZLER_DEFAULTS: TwizzlerSettings = {
  color: "#e8481c",
  colorFar: "#ffd89a",
  colorNear: "#e8481c",
  colorEdge: "#ffc857",
  opacity: 0.72,
  scale: 1,
  centerY: 0.55,
  amplitude: 0.58,
  lineCount: 48,
  lineWidth: 2.1,
  pointSpacing: 3,
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
  heatVariant: 1,
  depthTerrain: 0,
  twist: 1.15,
  noiseScaleX: 0.0004,
  noiseScaleY: 0.01,
  speed: 0.12,
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
    amplitude: clamp(input.amplitude, TWIZZLER_DEFAULTS.amplitude, 0, 1),
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
    heatVariant: Math.round(clamp(input.heatVariant, TWIZZLER_DEFAULTS.heatVariant, 0, 11)) as TwizzlerHeatVariant,
    depthTerrain: Math.round(clamp(input.depthTerrain, TWIZZLER_DEFAULTS.depthTerrain, 0, 2)),
    twist: clamp(input.twist, TWIZZLER_DEFAULTS.twist, 0, 6),
    noiseScaleX: clamp(input.noiseScaleX, TWIZZLER_DEFAULTS.noiseScaleX, 0.0001, 0.02),
    noiseScaleY: clamp(input.noiseScaleY, TWIZZLER_DEFAULTS.noiseScaleY, 0.001, 0.1),
    speed: clamp(input.speed, TWIZZLER_DEFAULTS.speed, 0, 3),
    drift: clamp(input.drift, TWIZZLER_DEFAULTS.drift, 0, 1),
    stippleSize: clamp(input.stippleSize, TWIZZLER_DEFAULTS.stippleSize, 0, 8),
    stippleGap: clamp(input.stippleGap, TWIZZLER_DEFAULTS.stippleGap, 0, 12),
  };
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

export type TwizzlerHeatBand = {
  center: number;
  width: number;
  gain: number;
  /** 0–1 phase placement across the shared fluid X cadence. */
  phase: number;
  /** -1 cool through +1 hot. */
  temperature: number;
};

export type TwizzlerHeatRecipe = {
  bandCount: number;
  bandWidth: number;
  zFrequency: number;
  heatBias: number;
  driveGain: number;
  bands: readonly TwizzlerHeatBand[];
  /** Optional broad Z envelope used to organize local bands into one field. */
  envelope?: {
    center: number;
    width: number;
    floor: number;
  };
  /** Smooth target-shaped X gate and drive clamp; only affects heat displacement. */
  xGate?: {
    knots: ReadonlyArray<{ x: number; gain: number }>;
    frequencyScale: number;
    maxDrive: number;
  };
};

function uniformHeatBands(bandCount: number, bandWidth: number): TwizzlerHeatBand[] {
  return Array.from({ length: bandCount }, (_, index) => {
    const phase = index / (bandCount - 1);
    return {
      center: -0.9 + phase * 1.8,
      width: bandWidth,
      gain: 1,
      phase,
      temperature: 0,
    };
  });
}

function poissonHeatBands(centers: readonly number[], minSeparation: number, seed: number): TwizzlerHeatBand[] {
  const sorted = [...centers].sort((left, right) => left - right);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]! - sorted[index - 1]! < minSeparation) {
      throw new Error("Poisson Z heat centers violate minimum separation");
    }
  }
  return sorted.map((center, index) => {
    const shape = twizzlerNoise(index * 1.73 + seed, seed * 0.61, 0.47);
    return {
      center,
      width: 0.075 + shape * 0.055,
      gain: 0.82 + twizzlerNoise(index * 2.11, seed, 0.83) * 0.62,
      phase: twizzlerNoise(index * 1.37 + seed, seed * 1.23, 1.14),
      temperature: 0.55 + twizzlerNoise(index * 0.91, seed * 0.73, 1.71) * 0.45,
    };
  });
}

/** Structurally distinct Z recipes; X frequencies remain shared and fluid. */
export function twizzlerHeatRecipe(input: number): TwizzlerHeatRecipe {
  const variant = Math.round(Math.max(0, Math.min(11, input))) as TwizzlerHeatVariant;
  switch (variant) {
    case 0: {
      const bandWidth = 0.72;
      return {
        bandCount: 3,
        bandWidth,
        zFrequency: 0.95,
        heatBias: 0,
        driveGain: 1,
        bands: uniformHeatBands(3, bandWidth),
      };
    }
    case 1: {
      const bandWidth = 0.48;
      return {
        bandCount: 5,
        bandWidth,
        zFrequency: 4.6 / 2.4,
        heatBias: 0,
        driveGain: 1,
        bands: uniformHeatBands(5, bandWidth),
      };
    }
    case 2: {
      const bandWidth = 0.2;
      return {
        bandCount: 9,
        bandWidth,
        zFrequency: 5.2,
        heatBias: 0,
        driveGain: 1,
        bands: uniformHeatBands(9, bandWidth),
      };
    }
    case 3:
      // A2 — sparse broad sheets, deliberately weighted toward the near side.
      return {
        bandCount: 3,
        bandWidth: 0.6,
        zFrequency: 1.1,
        heatBias: 0.12,
        driveGain: 1.12,
        bands: [
          { center: -0.84, width: 0.78, gain: 0.62, phase: 0.04, temperature: 0.15 },
          { center: -0.18, width: 0.42, gain: 1.28, phase: 0.46, temperature: 0.72 },
          { center: 0.68, width: 0.62, gain: 1.72, phase: 0.88, temperature: 1 },
        ],
      };
    case 4:
      // B2 — irregular clusters: close pairs, gaps, and intentionally unequal widths.
      return {
        bandCount: 6,
        bandWidth: 0.23,
        zFrequency: 2.35,
        heatBias: 0.14,
        driveGain: 1.14,
        bands: [
          { center: -0.92, width: 0.15, gain: 1.3, phase: 0.02, temperature: 0.9 },
          { center: -0.64, width: 0.32, gain: 0.72, phase: 0.11, temperature: 0.25 },
          { center: -0.2, width: 0.19, gain: 1.48, phase: 0.39, temperature: 0.82 },
          { center: 0.02, width: 0.12, gain: 0.84, phase: 0.48, temperature: 0.1 },
          { center: 0.57, width: 0.3, gain: 1.22, phase: 0.77, temperature: 0.68 },
          { center: 0.9, width: 0.17, gain: 0.68, phase: 0.96, temperature: -0.08 },
        ],
      };
    case 5:
      // C2 — nonuniform spot groups alternate hot → cool → hot → cool → hot.
      return {
        bandCount: 11,
        bandWidth: 0.13,
        zFrequency: 4.7,
        heatBias: 0.18,
        driveGain: 1.1,
        bands: [
          { center: -0.96, width: 0.1, gain: 1.28, phase: 0, temperature: 1 },
          { center: -0.78, width: 0.15, gain: 1.08, phase: 0.08, temperature: 0.78 },
          { center: -0.54, width: 0.11, gain: 0.46, phase: 0.21, temperature: -0.9 },
          { center: -0.39, width: 0.09, gain: 0.34, phase: 0.29, temperature: -1 },
          { center: -0.16, width: 0.14, gain: 1.36, phase: 0.41, temperature: 0.92 },
          { center: 0.03, width: 0.1, gain: 1.52, phase: 0.5, temperature: 1 },
          { center: 0.2, width: 0.16, gain: 1.12, phase: 0.59, temperature: 0.68 },
          { center: 0.43, width: 0.09, gain: 0.38, phase: 0.7, temperature: -1 },
          { center: 0.58, width: 0.12, gain: 0.5, phase: 0.77, temperature: -0.75 },
          { center: 0.8, width: 0.15, gain: 1.18, phase: 0.89, temperature: 0.82 },
          { center: 0.97, width: 0.08, gain: 1.42, phase: 1, temperature: 1 },
        ],
      };
    case 6:
      // A3 — one dominant hot mass plus two unrelated offset sheets.
      return {
        bandCount: 3,
        bandWidth: 0.43,
        zFrequency: 1.05,
        heatBias: 0.14,
        driveGain: 1.12,
        bands: [
          { center: -0.72, width: 0.27, gain: 0.62, phase: 0.08, temperature: 0.38 },
          { center: 0.24, width: 0.82, gain: 1.38, phase: 0.57, temperature: 1 },
          { center: 0.89, width: 0.18, gain: 0.54, phase: 0.94, temperature: 0.52 },
        ],
      };
    case 7:
      // B3 — broad parent regions carry narrower, hotter child islands.
      return {
        bandCount: 7,
        bandWidth: 0.28,
        zFrequency: 2.15,
        heatBias: 0.15,
        driveGain: 1.14,
        bands: [
          { center: -0.54, width: 0.56, gain: 0.58, phase: 0.16, temperature: 0.3 },
          { center: -0.76, width: 0.1, gain: 1.46, phase: 0.04, temperature: 1 },
          { center: -0.31, width: 0.13, gain: 1.22, phase: 0.37, temperature: 0.82 },
          { center: 0.49, width: 0.47, gain: 0.64, phase: 0.73, temperature: 0.38 },
          { center: 0.2, width: 0.09, gain: 1.54, phase: 0.51, temperature: 1 },
          { center: 0.61, width: 0.12, gain: 1.36, phase: 0.81, temperature: 0.9 },
          { center: 0.84, width: 0.075, gain: 1.18, phase: 0.97, temperature: 0.74 },
        ],
      };
    case 8: {
      // C3 — deterministic 1D Poisson sampling under a broad low-frequency envelope.
      const bands = poissonHeatBands([-0.94, -0.77, -0.49, -0.31, -0.06, 0.13, 0.43, 0.61, 0.91], 0.16, 7.3);
      return {
        bandCount: bands.length,
        bandWidth: 0.1,
        zFrequency: 3.6,
        heatBias: 0.16,
        driveGain: 1.1,
        bands,
        envelope: {
          center: 0.08,
          width: 0.78,
          floor: 0.36,
        },
      };
    }
    case 9:
      // A4 — compact sheets plus one broad near-depth lobe, active mainly in the hero rise.
      return {
        bandCount: 4,
        bandWidth: 0.28,
        zFrequency: 1.45,
        heatBias: 0.15,
        driveGain: 1.12,
        bands: [
          { center: -0.76, width: 0.14, gain: 0.72, phase: 0.07, temperature: 0.62 },
          { center: -0.28, width: 0.18, gain: 0.88, phase: 0.32, temperature: 0.76 },
          { center: 0.14, width: 0.2, gain: 0.82, phase: 0.51, temperature: 0.7 },
          { center: 0.7, width: 0.54, gain: 1.18, phase: 0.79, temperature: 1 },
        ],
        xGate: {
          knots: [
            { x: 0, gain: 0.08 },
            { x: 0.24, gain: 0.16 },
            { x: 0.43, gain: 0.34 },
            { x: 0.58, gain: 0.82 },
            { x: 0.72, gain: 1 },
            { x: 0.86, gain: 0.56 },
            { x: 1, gain: 0.16 },
          ],
          frequencyScale: 0.38,
          maxDrive: 0.42,
        },
      };
    case 10:
      // B4 — two broad warm parents with irregular hot children under one target gate.
      return {
        bandCount: 8,
        bandWidth: 0.24,
        zFrequency: 2.2,
        heatBias: 0.16,
        driveGain: 1.14,
        bands: [
          { center: -0.5, width: 0.48, gain: 0.48, phase: 0.14, temperature: 0.34 },
          { center: 0.42, width: 0.58, gain: 0.56, phase: 0.68, temperature: 0.42 },
          { center: -0.72, width: 0.09, gain: 1.22, phase: 0.04, temperature: 0.96 },
          { center: -0.39, width: 0.12, gain: 1.38, phase: 0.27, temperature: 1 },
          { center: -0.08, width: 0.075, gain: 1.14, phase: 0.46, temperature: 0.86 },
          { center: 0.2, width: 0.11, gain: 1.46, phase: 0.59, temperature: 1 },
          { center: 0.55, width: 0.09, gain: 1.3, phase: 0.77, temperature: 0.94 },
          { center: 0.82, width: 0.13, gain: 1.08, phase: 0.91, temperature: 0.78 },
        ],
        envelope: {
          center: 0.06,
          width: 0.94,
          floor: 0.42,
        },
        xGate: {
          knots: [
            { x: 0, gain: 0.1 },
            { x: 0.28, gain: 0.2 },
            { x: 0.47, gain: 0.48 },
            { x: 0.63, gain: 1 },
            { x: 0.79, gain: 0.82 },
            { x: 1, gain: 0.18 },
          ],
          frequencyScale: 0.44,
          maxDrive: 0.4,
        },
      };
    case 11:
      // C4 — sparse far depth, layered center/near fan, restrained terminal depth spots.
      return {
        bandCount: 7,
        bandWidth: 0.18,
        zFrequency: 2.8,
        heatBias: 0.15,
        driveGain: 1.12,
        bands: [
          { center: -0.88, width: 0.1, gain: 0.56, phase: 0.03, temperature: 0.52 },
          { center: -0.46, width: 0.13, gain: 0.68, phase: 0.24, temperature: 0.64 },
          { center: -0.08, width: 0.18, gain: 1.16, phase: 0.48, temperature: 0.9 },
          { center: 0.18, width: 0.22, gain: 1.3, phase: 0.6, temperature: 1 },
          { center: 0.4, width: 0.17, gain: 1.24, phase: 0.71, temperature: 0.96 },
          { center: 0.66, width: 0.14, gain: 1.08, phase: 0.84, temperature: 0.82 },
          { center: 0.92, width: 0.08, gain: 0.58, phase: 0.97, temperature: 0.56 },
        ],
        envelope: {
          center: 0.24,
          width: 0.86,
          floor: 0.34,
        },
        xGate: {
          knots: [
            { x: 0, gain: 0.08 },
            { x: 0.3, gain: 0.14 },
            { x: 0.48, gain: 0.54 },
            { x: 0.66, gain: 1 },
            { x: 0.84, gain: 0.7 },
            { x: 1, gain: 0.12 },
          ],
          frequencyScale: 0.5,
          maxDrive: 0.44,
        },
      };
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

function twizzlerHeatEnvelope(across: number, recipe: TwizzlerHeatRecipe): number {
  if (!recipe.envelope) return 1;
  const distance = (across - recipe.envelope.center) / Math.max(0.05, recipe.envelope.width);
  const shape = Math.exp(-(distance * distance));
  return recipe.envelope.floor + (1 - recipe.envelope.floor) * shape;
}

export function twizzlerHeatXGate(xT: number, recipe: TwizzlerHeatRecipe): number {
  const knots = recipe.xGate?.knots;
  if (!knots?.length) return 1;
  const x = Math.max(0, Math.min(1, xT));
  if (x <= knots[0]!.x) return knots[0]!.gain;
  for (let index = 1; index < knots.length; index += 1) {
    const left = knots[index - 1]!;
    const right = knots[index]!;
    if (x <= right.x) {
      const amount = smoothstep(left.x, right.x, x);
      return left.gain + (right.gain - left.gain) * amount;
    }
  }
  return knots[knots.length - 1]!.gain;
}

/**
 * Top-down amplitude heat map over (x along ribbon, across = Z / depth stack).
 * Multiple scattered hot spots through Z×X — not one pack-wide L→R swell.
 */
export function twizzlerAmpHeat(xT: number, across: number, heatVariant: TwizzlerHeatVariant = 1, seed = 2.4): number {
  const x = Math.max(0, Math.min(1, xT));
  const a = Math.max(-1, Math.min(1, across));
  const recipe = twizzlerHeatRecipe(heatVariant);
  // Match the locked B's broad X cadence for every recipe; only Z density changes.
  const xFreq = 2.6 / 2.4;
  const zFreq = recipe.zFrequency;
  const n0 = twizzlerNoise(x * xFreq + seed, a * zFreq, 0.2);
  const n1 = twizzlerNoise(x * (xFreq * 1.6) + seed * 1.3, a * (zFreq * 1.4) + 0.55, 0.72);
  const raw = 0.55 * n0 + 0.45 * n1;
  let temperatureSum = 0;
  let temperatureWeight = 0;
  for (const band of recipe.bands) {
    const weight = Math.exp(-Math.pow((a - band.center) / band.width, 2));
    temperatureSum += weight * band.temperature;
    temperatureWeight += weight;
  }
  const temperature = temperatureWeight > 1e-6 ? temperatureSum / temperatureWeight : 0;
  return Math.pow(smoothstep(0.26, 0.7, raw + temperature * recipe.heatBias), 1.05);
}

/**
 * Signed Y swell: narrow Z-bands with phase-shifted hills along X.
 * Far / mid / near bands peak at different X — multiple peaks through the stack.
 */
export function twizzlerAmpSwell(xT: number, across: number, heatVariant: TwizzlerHeatVariant = 1, seed = 3.1): number {
  const x = Math.max(0, Math.min(1, xT));
  const a = Math.max(-1, Math.min(1, across));
  const recipe = twizzlerHeatRecipe(heatVariant);
  const { bands } = recipe;
  const frequencyScale = recipe.xGate?.frequencyScale ?? 1;
  let sum = 0;
  let wSum = 0;
  for (const band of bands) {
    const w = Math.exp(-Math.pow((a - band.center) / band.width, 2));
    const bandT = band.phase;
    const phase = seed * 0.85 + bandT * 11.4;
    // Every recipe spans the same fluid X-frequency range; only its Z sampling changes.
    const hills =
      0.55 * Math.sin(x * Math.PI * (2.8 + bandT * 3.4) * frequencyScale + phase) +
      0.3 * Math.sin(x * Math.PI * (4.6 + bandT * 2.2) * frequencyScale + phase * 1.55) +
      0.15 * Math.sin(x * Math.PI * (1.6 + bandT * 1.2) * frequencyScale + phase * 0.7);
    const gate = 0.45 + 0.55 * twizzlerNoise(x * (1.1 / 2.4) + seed + bandT * 2.8, band.center * 2.4, 0.4);
    const thermalGain = Math.max(0.2, 1 + band.temperature * 0.28);
    sum += w * hills * gate * band.gain * thermalGain;
    wSum += w;
  }
  const lobe = wSum > 1e-6 ? sum / wSum : 0;
  const envelope = twizzlerHeatEnvelope(a, recipe);
  return Math.tanh(lobe * 1.85) * envelope;
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
  heatVariant: TwizzlerHeatVariant = 1,
  seed = 2.4,
): number {
  const heat = twizzlerAmpHeat(xT, across, heatVariant, seed);
  const swell = twizzlerAmpSwell(xT, across, heatVariant, seed + 1.7);
  const recipe = twizzlerHeatRecipe(heatVariant);
  // Heat spots boost amplitude; keep below clip so phase-shifted Z peaks stay curved.
  const rawDrive = swell * (0.4 + 0.6 * heat) * recipe.driveGain * twizzlerHeatXGate(xT, recipe);
  const drive = recipe.xGate
    ? recipe.xGate.maxDrive * Math.tanh(rawDrive / Math.max(0.01, recipe.xGate.maxDrive))
    : rawDrive;
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
  const segmentCount = Math.max(1, Math.ceil(pixelWidth / Math.max(2, settings.pointSpacing)));
  const lines: TwizzlerLine[] = [];

  // Mid: prior-ish amp/distance, quieter slot gaps so majority stay in-viewport.
  const gapNoise = 0.42 + settings.wrinkleStrength * 12;
  const alongGapNoise = 0.55 + settings.wrinkleStrength * 14 + settings.depthSpread * 0.12;
  const terrainBoost = settings.depthTerrain === 1 ? 1.35 : settings.depthTerrain === 2 ? 1.55 : 1;
  const waveAmp = (1.0 + settings.depthLift * 1.4) * terrainBoost;
  const rawSlots = twizzlerUnevenAcross(
    settings.lineCount,
    gapNoise,
    2.1 + settings.wrinkles * 0.15 + settings.depthTerrain * 1.7,
  );
  // Stretch slots toward near/far poles — depthSpread fights mid-pack condensation.
  const acrossSlots = rawSlots.map((slot) => twizzlerExpandAcross(slot, 0.42 + settings.depthSpread * 0.42));

  const center: Array<{ x: number; y: number; xT: number }> = [];
  for (let point = 0; point <= segmentCount; point += 1) {
    const xT = point / segmentCount;
    const x = twizzlerPointX(point, segmentCount, pixelWidth);
    const yN = twizzlerMarketingCenterY(xT, settings, time);
    center.push({ x, y: yN * pixelHeight, xT });
  }

  for (let range = 0; range < settings.lineCount; range += 1) {
    const across = acrossSlots[range] ?? (settings.lineCount <= 1 ? 0 : (range / (settings.lineCount - 1)) * 2 - 1);
    const points: TwizzlerLine["points"] = [];

    for (let point = 0; point <= segmentCount; point += 1) {
      const c = center[point];
      const prev = center[Math.max(0, point - 1)];
      const next = center[Math.min(segmentCount, point + 1)];
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;

      const theta = twizzlerMarketingTwist(c.xT, settings, time);
      const fiberTheta = theta + across * 0.12;
      const face = twizzlerFaceAmount(fiberTheta);
      const halfW = twizzlerMarketingWidth(c.xT, settings) * pixelHeight;
      const nearness = twizzlerFiberNearness(across, c.xT, settings, time);
      const far = 1 - nearness;

      // Keep braid quiet — amplitude variety comes from shared heat patches, not per-ribbon thrash.
      const pinch = Math.exp(-Math.pow((c.xT - 0.42) / 0.1, 2));
      const organic = (twizzlerNoise(c.xT * 1.4, time * 0.12, 0.35) - 0.5) * settings.wrinkleStrength * 0.9;
      const braid = across + organic + 0.1 * pinch * Math.sin(fiberTheta + across * 0.9) * (1 - across * across);
      // Keep some face projection, but do NOT collapse far fibers into the spine.
      const zPerspective = 0.7 + 0.3 * nearness;
      const projected = braid * halfW * (0.2 + 0.8 * face) * zPerspective;

      const depth = twizzlerDepthScale(c.xT, settings);
      const depthY = twizzlerDepthYBias(
        nearness,
        pixelHeight,
        settings.depthLift,
        c.xT,
        waveAmp,
        settings.depthTerrain,
      );
      // Y amp: explicit A/B/C heat recipes change only lobe count/width through Z.
      const ampNoiseY = twizzlerAmpNoiseY(
        c.xT,
        across,
        pixelHeight,
        settings.amplitude,
        settings.wrinkleStrength,
        settings.heatVariant,
        2.4,
      );
      const rightEdge = Math.pow(smoothstep(0.35, 1, c.xT), 1.1);
      // Pack open enough for denseness, thin enough that Z-scattered peaks read (not parallel sheet).
      const verticalOpen = (0.95 + settings.depthSpread * 0.55) * 1.15;
      const acrossX = twizzlerGapWarpedAcross(across, c.xT, range, alongGapNoise, 2.7 + settings.wrinkles * 0.12);
      const stackY = acrossX * halfW * verticalOpen;
      const farDownStack = -acrossX * halfW * rightEdge * (0.25 + settings.depthLift * 0.2) * (0.3 + far * 0.5);
      const faceY = ny * projected * 0.35;
      const zLane = far * halfW * (0.05 + 0.12 * rightEdge) * (0.4 + settings.depthSpread * 0.25);
      const x = c.x + nx * braid * halfW * 0.02 * Math.sin(fiberTheta);
      // Soften shared spine lockstep — Z-scattered amp peaks must land at different X.
      const spineBase = pixelHeight * settings.centerY;
      const spineShare = 0.18;
      const y = spineBase + (c.y - spineBase) * spineShare + faceY + stackY + depthY + ampNoiseY + farDownStack + zLane;

      points.push({ x, y, depth, along: c.xT, nearness });
    }

    // Soften high-curvature tips along the fiber (kinks/V tips) without reshaping macro lobes.
    twizzlerSoftenFiberCorners(points, 16);

    const mid = points[Math.floor(points.length * 0.62)] ?? points[0];
    const midNear = mid?.nearness ?? 0.5;
    const colorT = twizzlerColorT(mid?.along ?? 0.5);
    const baseColor = twizzlerLerpColor(settings.colorFar, settings.colorNear, colorT);
    const withEdge =
      Math.abs(across) > 0.85
        ? twizzlerLerpColor(baseColor, settings.colorEdge, ((Math.abs(across) - 0.85) / 0.15) * 0.35)
        : baseColor;
    const fog = twizzlerFogAmount(midNear);
    const color = twizzlerFogColor(withEdge, fog);

    const visibility = 0.12 + 0.88 * Math.pow(midNear, 0.85);
    lines.push({
      across,
      opacity: Math.min(0.92, settings.opacity * visibility),
      color,
      nearness: midNear,
      strokeWidth: Math.max(0.2, settings.lineWidth * twizzlerStrokeWidthScale(midNear)),
      points,
    });
  }

  // Shift the whole pack until the VISIBLE ink average sits at centerY (lower = higher on screen).
  // Iterate because a tall pack clips; one-shot all-points mean leaves on-screen mass too low.
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

  const { settings, lines } = buildTwizzlerLines(pixelWidth, pixelHeight, timeSec, input);
  context.clearRect(0, 0, pixelWidth, pixelHeight);
  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";
  context.setLineDash([]);

  // Far → near so thicker near fibers sit on top.
  const ordered = [...lines].sort((a, b) => a.nearness - b.nearness);

  for (const line of ordered) {
    if (line.points.length < 2) continue;

    // Continuous smooth path. Fog + color evolve along X via gradient.
    const gradient = context.createLinearGradient(0, 0, pixelWidth, 0);
    const stops = [0, 0.18, 0.4, 0.62, 0.82, 1];
    for (const stop of stops) {
      const sample = line.points[Math.min(line.points.length - 1, Math.round(stop * (line.points.length - 1)))];
      const nearness = sample?.nearness ?? line.nearness;
      const fog = twizzlerFogAmount(nearness);
      const colorT = twizzlerColorT(sample?.along ?? stop);
      const base = twizzlerLerpColor(settings.colorFar, settings.colorNear, colorT);
      gradient.addColorStop(stop, twizzlerFogColor(base, fog));
    }

    // Width also grows along the path toward the camera (right).
    const leftNear = line.points[0]?.nearness ?? line.nearness;
    const rightNear = line.points[line.points.length - 1]?.nearness ?? line.nearness;
    const widthScale = twizzlerStrokeWidthScale(0.35 * leftNear + 0.65 * rightNear);

    context.strokeStyle = gradient;
    context.globalAlpha = Math.min(0.9, line.opacity);
    context.lineWidth = Math.max(0.25, settings.lineWidth * widthScale);
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
