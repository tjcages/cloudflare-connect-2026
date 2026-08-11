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
    depthSpread: clamp(input.depthSpread, TWIZZLER_DEFAULTS.depthSpread, 0, 1.5),
    depthLift: clamp(input.depthLift, TWIZZLER_DEFAULTS.depthLift, 0, 1),
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
 * Multi-hill silhouette — not a flat single sweep. Amplitude + terrain diverge A/B/C.
 */
export function twizzlerMarketingCenterY(xT: number, settings: TwizzlerSettings, time: number): number {
  const x = Math.max(0, Math.min(1, xT));
  const terrain = Math.round(Math.max(0, Math.min(2, settings.depthTerrain))) as 0 | 1 | 2;
  // Base spine still trends mid → valley → rise, but with many hills.
  const yKnot = sampleKnots(x, [
    [0.0, 0.58],
    [0.08, 0.72],
    [0.18, 0.86],
    [0.3, 0.78],
    [0.4, 0.92],
    [0.5, 0.7],
    [0.62, 0.48],
    [0.74, 0.28],
    [0.86, 0.18],
    [1.0, 0.34],
  ]);
  const waveGain = 0.55 + settings.amplitude * 1.35;
  let waves = 0;
  switch (terrain) {
    case 0: {
      // A — rolling multi-hills (A2 direction).
      waves =
        waveGain *
        1.25 *
        (-0.1 * Math.sin(x * Math.PI * 2.4 + 0.4) +
          -0.085 * Math.sin(x * Math.PI * 3.6 + 1.1) +
          -0.07 * Math.sin(x * Math.PI * 5.2 + 2.2) +
          -0.05 * Math.sin(x * Math.PI * 7.1 + time * 0.3) +
          -0.035 * Math.sin(x * Math.PI * 9.4 + 0.7) * Math.min(1, settings.wrinkles / 2));
      break;
    }
    case 1: {
      // B — sharper, higher-frequency silhouette.
      waves =
        waveGain *
        1.35 *
        (-0.1 * Math.sin(x * Math.PI * 3.2 + 0.2) +
          -0.09 * Math.sin(x * Math.PI * 5.8 + 1.4) +
          -0.075 * Math.sin(x * Math.PI * 8.6 + 2.6) +
          -0.055 * Math.sin(x * Math.PI * 11.2 + time * 0.2) +
          -0.04 * Math.sin(x * Math.PI * 14.5 + 0.9));
      break;
    }
    case 2: {
      // C — long slow sweep, fewer hills, deeper right rise then settle.
      waves =
        waveGain *
        1.1 *
        (-0.12 * Math.sin(x * Math.PI * 1.35 + 0.3) +
          -0.08 * Math.sin(x * Math.PI * 2.1 + 1.6) +
          -0.045 * Math.sin(x * Math.PI * 3.4 + 0.8));
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
  const edgeBias = (edges.left - 0.58) * (1 - x) + (edges.right - 0.34) * x;
  const bend = twizzlerPathBend(x, settings) * 0.85;
  const yAbs = yKnot + waves + edgeBias * 0.25 + bend;
  return settings.centerY + (yAbs - 0.55) * settings.scale;
}

/**
 * Intrinsic ribbon half-height (before twist projection).
 * Smooth pinch → wide fan. No high-freq width chatter.
 */
export function twizzlerMarketingWidth(xT: number, settings: TwizzlerSettings): number {
  const x = Math.max(0, Math.min(1, xT));
  const half = sampleKnots(x, [
    [0.0, 0.09],
    [0.15, 0.11],
    [0.3, 0.14],
    [0.42, 0.055],
    [0.55, 0.14],
    [0.72, 0.34],
    [0.88, 0.3],
    [1.0, 0.28],
  ]);
  const ampScale = 0.8 + settings.amplitude * 0.4;
  const spreadBoost = 1 + settings.depthSpread * 0.14 * Math.pow(smoothstep(0.48, 1, x), 1.05);
  const depthBoost = 1 + (twizzlerDepthScale(x, settings) - 1) * 0.06;
  const taper = 1 - settings.edgeTaper * 0.12 * (1 - Math.sin(Math.PI * x));
  return Math.max(0.035, half * ampScale * spreadBoost * depthBoost * taper);
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
 * Across is the primary Z stack (preserve contrast L→R — do not wash out with along-X).
 * Mild right-edge pull keeps the fan forward without collapsing far/near.
 */
export function twizzlerFiberNearness(across: number, xT: number, settings: TwizzlerSettings, time: number): number {
  const x = Math.max(0, Math.min(1, xT));
  const theta = twizzlerMarketingTwist(x, settings, time);
  const stackNear = (across + 1) * 0.5; // -1 far → 0, +1 near → 1
  const twistZ = across * Math.sin(theta) * 0.08;
  const alongPull = 0.12 * Math.pow(smoothstep(0.4, 1, x), 1.15);
  const depthBoost = twizzlerNearness(twizzlerDepthScale(x, settings), settings) * 0.1;
  const near = 0.04 + 0.78 * stackNear + twistZ + alongPull + depthBoost;
  return Math.max(0, Math.min(1, near));
}

/** Fog blend 0..1 toward background (white). Far fibers dissolve into the stage. */
export function twizzlerFogAmount(nearness: number): number {
  return Math.pow(1 - nearness, 1.05);
}

/** Blend ribbon hex into white by fog amount (cheap distance fade). */
export function twizzlerFogColor(hex: string, fog: number, backgroundHex = "#ffffff"): string {
  return twizzlerLerpColor(hex, backgroundHex, Math.max(0, Math.min(1, fog)));
}

/** Stroke width scale from nearness — thick toward camera. */
export function twizzlerStrokeWidthScale(nearness: number): number {
  return 0.3 + 2.4 * nearness;
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
    // Occasional wider gaps + tighter clusters.
    const burst = twizzlerNoise(i * 0.19, seed + 4.2, 1.1);
    weights.push(Math.max(0.12, 0.35 + amount * (n * 1.8 - 0.4) + amount * 0.9 * (burst > 0.68 ? burst * 1.4 : 0)));
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
  // Budget ~±0.2 canvas height of Z→Y separation so fibers stay readable on-frame.
  const amp = pixelHeight * (0.1 + depthLift * 0.12) * Math.min(1.6, 0.7 + waveAmp * 0.18);
  const right = Math.pow(smoothstep(0.42, 1, xT), 1.25);
  const mid = Math.sin(Math.PI * xT);

  // Shared: far fibers plunge on the right edge (largest +Y).
  const farRightDrop = far * right * amp * 0.95;
  // Near fibers ride higher on the right (toward camera / upper stack).
  const nearRightHold = -nearness * right * amp * 0.5;

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

  // Gap irregularity + Z-wave amplitude ride on existing wrinkle/depthLift knobs.
  const gapNoise = 0.55 + settings.wrinkleStrength * 22;
  const terrainBoost = settings.depthTerrain === 1 ? 1.35 : settings.depthTerrain === 2 ? 1.55 : 1;
  const waveAmp = (1.0 + settings.depthLift * 1.4) * terrainBoost;
  const acrossSlots = twizzlerUnevenAcross(
    settings.lineCount,
    gapNoise,
    2.1 + settings.wrinkles * 0.15 + settings.depthTerrain * 1.7,
  );

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

      // Mild smooth shear at pinch + low-freq organic drift (not vertical chatter).
      const pinch = Math.exp(-Math.pow((c.xT - 0.42) / 0.1, 2));
      const organic =
        (twizzlerNoise(c.xT * 3.2 + across * 1.7, range * 0.2, 0.4) - 0.5) * settings.wrinkleStrength * 2.4;
      const braid = across + organic + 0.12 * pinch * Math.sin(fiberTheta + across * 0.9) * (1 - across * across);
      const projected = braid * halfW * (0.16 + 0.84 * face);

      const depth = twizzlerDepthScale(c.xT, settings);
      const depthY = twizzlerDepthYBias(
        nearness,
        pixelHeight,
        settings.depthLift,
        c.xT,
        waveAmp,
        settings.depthTerrain,
      );
      // Soft multi-wave along-path wobble — more hills, still not chatter.
      const pathWobble =
        (Math.sin(c.xT * Math.PI * (2.2 + settings.wrinkles * 0.35) + across * 2.1 + time * 0.25) +
          0.55 * Math.sin(c.xT * Math.PI * (4.1 + settings.wrinkles * 0.2) + across * 1.3) +
          0.35 * Math.sin(c.xT * Math.PI * 6.2 + across * 3.1 + time * 0.15)) *
        settings.wrinkleStrength *
        halfW *
        2.8;
      // Face-fan alone puts near (+across) downward; overpower it on the right so far drops lowest.
      const rightEdge = Math.pow(smoothstep(0.4, 1, c.xT), 1.15);
      const farDownStack = -across * halfW * rightEdge * (0.55 + settings.depthLift * 0.25);
      const faceY = ny * projected * (1 - 0.4 * rightEdge);
      const x = c.x + nx * braid * halfW * 0.025 * Math.sin(fiberTheta);
      const y = c.y + faceY + depthY + pathWobble + farDownStack;

      points.push({ x, y, depth, along: c.xT, nearness });
    }

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

    const visibility = 0.22 + 0.78 * midNear;
    lines.push({
      across,
      opacity: Math.min(0.9, settings.opacity * visibility),
      color,
      nearness: midNear,
      strokeWidth: Math.max(0.5, settings.lineWidth * twizzlerStrokeWidthScale(midNear)),
      points,
    });
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
    context.lineWidth = Math.max(0.55, settings.lineWidth * widthScale);
    context.beginPath();
    context.moveTo(line.points[0].x, line.points[0].y);
    for (let index = 1; index < line.points.length; index += 1) {
      context.lineTo(line.points[index].x, line.points[index].y);
    }
    context.stroke();
  }

  context.restore();
}

export function clearTwizzler(canvas: HTMLCanvasElement): void {
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}
