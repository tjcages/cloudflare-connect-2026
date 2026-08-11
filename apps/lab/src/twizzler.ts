/**
 * Connect Twizzler — parametric hairline ribbon (Canvas2D + SVG-exportable paths).
 *
 * Geometry: centerline C(x) + half-width W(x) + twist θ(x).
 * Fiber v ∈ [-1,1] projects as offset = v · W · cos(θ) along the path normal.
 * Pinch = edge-on (θ→π/2); fan = face-on (θ→0). Mild braid shear crosses fibers.
 * Color is stroked per fiber (no source-atop wash) so SVG export matches canvas.
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
  color: "#f04a1e",
  colorFar: "#ffc8a8",
  colorNear: "#e8481c",
  colorEdge: "#ffb347",
  opacity: 0.78,
  scale: 1,
  centerY: 0.55,
  amplitude: 0.62,
  lineCount: 260,
  lineWidth: 0.42,
  pointSpacing: 2,
  leftHeight: 0.58,
  rightHeight: 0.28,
  edgeFluctuation: 0.008,
  edgeSpeed: 0.03,
  edgeTaper: 0.1,
  wrinkles: 3.8,
  wrinkleStrength: 0.022,
  bendPosition: 0.16,
  bendAmount: -0.02,
  bend2Position: 0.4,
  bend2Amount: 0.05,
  bend3Position: 0.74,
  bend3Amount: -0.04,
  depthPosition: 0.8,
  depthAmount: 0.55,
  depthWidth: 0.28,
  depth2Position: 0.42,
  depth2Amount: 0.3,
  depth2Width: 0.1,
  depthSpread: 1.2,
  depthLift: 0.01,
  twist: 1.2,
  noiseScaleX: 0.0008,
  noiseScaleY: 0.024,
  speed: 0.15,
  drift: 0.1,
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

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHexColor(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
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

/**
 * Marketing banner centerline in normalized Y (0=top, 1=bottom).
 * Knots from TARGET-twizzler weighted p50 envelope.
 */
export function twizzlerMarketingCenterY(xT: number, settings: TwizzlerSettings, time: number): number {
  const x = Math.max(0, Math.min(1, xT));
  const knots: Array<[number, number]> = [
    [0.0, 0.57],
    [0.08, 0.75],
    [0.17, 0.88],
    [0.25, 0.95],
    [0.33, 0.87],
    [0.42, 0.9],
    [0.5, 0.88],
    [0.58, 0.74],
    [0.67, 0.5],
    [0.75, 0.5],
    [0.83, 0.29],
    [0.88, 0.16],
    [0.96, 0.34],
    [1.0, 0.4],
  ];
  let yKnot = knots[knots.length - 1][1];
  for (let i = 0; i < knots.length - 1; i += 1) {
    const [x0, y0] = knots[i];
    const [x1, y1] = knots[i + 1];
    if (x >= x0 && x <= x1) {
      const t = smoothstep(x0, x1, x);
      yKnot = y0 + (y1 - y0) * t;
      break;
    }
  }

  const edges = twizzlerEdgeHeights(time, 0, settings);
  const edgeBias = (edges.left - 0.57) * (1 - x) + (edges.right - 0.4) * x;
  const micro = 0.01 * Math.sin(x * Math.PI * 3.2 + time * 0.35) + 0.005 * Math.sin(x * Math.PI * 7.4 + 1.2);
  const bend = twizzlerPathBend(x, settings) * 0.35;
  const yAbs = yKnot + edgeBias * 0.3 + micro + bend;
  return settings.centerY + (yAbs - 0.55) * settings.scale;
}

/**
 * Intrinsic ribbon half-height (before twist projection).
 * Fitted to TARGET (p90-p10)/2 — tight pinch ~0.06, fan ~0.35.
 */
export function twizzlerMarketingWidth(xT: number, settings: TwizzlerSettings): number {
  const x = Math.max(0, Math.min(1, xT));
  const knots: Array<[number, number]> = [
    [0.0, 0.08],
    [0.08, 0.08],
    [0.17, 0.13],
    [0.25, 0.18],
    [0.33, 0.14],
    [0.42, 0.065],
    [0.5, 0.12],
    [0.58, 0.14],
    [0.67, 0.35],
    [0.75, 0.29],
    [0.83, 0.18],
    [0.92, 0.32],
    [1.0, 0.3],
  ];
  let half = knots[knots.length - 1][1];
  for (let i = 0; i < knots.length - 1; i += 1) {
    const [x0, y0] = knots[i];
    const [x1, y1] = knots[i + 1];
    if (x >= x0 && x <= x1) {
      const t = smoothstep(x0, x1, x);
      half = y0 + (y1 - y0) * t;
      break;
    }
  }
  const ampScale = 0.75 + settings.amplitude * 0.45;
  const spreadBoost = 1 + settings.depthSpread * 0.12 * Math.pow(smoothstep(0.5, 1, x), 1.1);
  const depthBoost = 1 + (twizzlerDepthScale(x, settings) - 1) * 0.08;
  const taper = 1 - settings.edgeTaper * 0.15 * (1 - Math.sin(Math.PI * x));
  return Math.max(0.03, half * ampScale * spreadBoost * depthBoost * taper);
}

/**
 * Twist angle θ(x): hard pinch at valley (~0.42), open face on the right fan.
 */
export function twizzlerMarketingTwist(xT: number, settings: TwizzlerSettings, time: number): number {
  const x = Math.max(0, Math.min(1, xT));
  const pinch = Math.exp(-Math.pow((x - 0.42) / 0.07, 2));
  const open = Math.pow(smoothstep(0.55, 0.95, x), 1.15);
  // Stronger pinch so TARGET's tight node reads; floor keeps left translucent.
  const theta = 0.35 + settings.twist * (0.78 * pinch - 0.32 * open);
  return Math.max(0.22, Math.min(1.35, theta)) + time * 0.035;
}

/** Face-on amount 0..1 from twist (1 = full fan, 0 = edge-on). */
export function twizzlerFaceAmount(theta: number): number {
  return Math.abs(Math.cos(theta));
}

/** Horizontal color mix 0..1 along the marketing ribbon (pale → coral). */
export function twizzlerColorT(xT: number): number {
  const x = Math.max(0, Math.min(1, xT));
  // Reach coral earlier so the fan stays readable (not washed pink dust).
  return Math.pow(smoothstep(0.05, 0.78, x), 0.75);
}

export type TwizzlerLine = {
  /** -1..1 across ribbon width. */
  across: number;
  opacity: number;
  /** Primary stroke color for this fiber (SVG + canvas). */
  color: string;
  points: Array<{ x: number; y: number; depth: number; along: number }>;
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

  const center: Array<{ x: number; y: number; xT: number }> = [];
  for (let point = 0; point <= segmentCount; point += 1) {
    const xT = point / segmentCount;
    const x = twizzlerPointX(point, segmentCount, pixelWidth);
    const yN = twizzlerMarketingCenterY(xT, settings, time);
    center.push({ x, y: yN * pixelHeight, xT });
  }

  for (let range = 0; range < settings.lineCount; range += 1) {
    const rangeT = settings.lineCount <= 1 ? 0.5 : range / (settings.lineCount - 1);
    const across = rangeT * 2 - 1; // -1..1
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
      // Per-fiber phase so parallel hairlines cross at the pinch (moiré twist).
      const fiberTheta = theta + across * 0.38 + 0.12 * Math.sin(across * Math.PI * 1.7 + c.xT * 4.2);
      const face = twizzlerFaceAmount(fiberTheta);
      const halfW = twizzlerMarketingWidth(c.xT, settings) * pixelHeight;

      // Soft tube bias — keep core tinted (no white hollow).
      const hollowAcross =
        Math.sign(across) * (Math.abs(across) * (1 - 0.1 * face) + Math.pow(Math.abs(across), 0.72) * 0.1 * face);

      // Soft braid shear so fibers cross at the pinch (moiré).
      const braid =
        hollowAcross +
        0.42 * Math.sin(fiberTheta * 1.7 + across * 2.8 + c.xT * Math.PI * 1.8) * (1 - across * across * 0.7);

      // Project ribbon face onto screen. Floor keeps a readable band when pinched.
      const projected = braid * halfW * (0.12 + 0.88 * face);

      const micro =
        (twizzlerNoise(c.x * settings.noiseScaleX * 12 + time * settings.drift, range * 0.37, 0.21) - 0.5) *
        settings.wrinkleStrength *
        halfW *
        (0.5 + face);
      const wrinkle =
        Math.sin(c.xT * Math.PI * 2 * settings.wrinkles + across * 2.6 + time * 0.55) *
        settings.wrinkleStrength *
        halfW *
        (0.18 + 0.95 * face);

      const depth = twizzlerDepthScale(c.xT, settings);
      const x =
        c.x +
        nx * braid * halfW * 0.055 * Math.sin(fiberTheta) +
        (twizzlerNoise(range * 0.17, c.xT * 40, time * 0.12) - 0.5) * 0.35;
      const y = c.y + ny * projected + micro + wrinkle - settings.depthLift * (depth - 1) * pixelHeight * 0.02;

      points.push({ x, y, depth, along: c.xT });
    }

    const midAlong = points[Math.floor(points.length * 0.55)]?.along ?? 0.5;
    const colorT = twizzlerColorT(midAlong);
    const edgeMix = Math.pow(Math.max(0, Math.abs(across) - 0.82) / 0.18, 1.15);
    const baseColor = twizzlerLerpColor(settings.colorFar, settings.colorNear, colorT);
    const color = edgeMix > 0.15 ? twizzlerLerpColor(baseColor, settings.colorEdge, edgeMix * 0.35) : baseColor;

    // Edge fibers slightly stronger so the fan reads as individual hairlines.
    // Right side keeps higher alpha so sparse fan stays coral, not invisible mist.
    const edgeWeight = 0.5 + 0.5 * Math.abs(across);
    const alongBoost = 0.9 + 0.5 * colorT;
    // Mid/pinch denser: fibers near core get a boost where twist collapses them.
    const coreBoost = 1 + 0.25 * (1 - Math.abs(across));
    lines.push({
      across,
      opacity: Math.min(0.95, settings.opacity * (0.42 + edgeWeight * 0.55) * alongBoost * coreBoost),
      color,
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

  // Draw core→edge so outer hairlines sit on top and stay readable when fanned.
  const ordered = [...lines].sort((a, b) => Math.abs(a.across) - Math.abs(b.across));

  for (const line of ordered) {
    if (line.points.length < 2) continue;
    if (settings.stippleSize > 0.01) {
      context.setLineDash([settings.stippleSize, settings.stippleGap + Math.abs(line.across) * 0.35]);
      context.lineDashOffset = line.across * 3.5;
    } else {
      context.setLineDash([]);
    }

    const mid = line.points[Math.floor(line.points.length * 0.55)] ?? line.points[0];
    // Stroke with a horizontal gradient: peach → gold → coral (matches TARGET).
    const gradient = context.createLinearGradient(0, 0, pixelWidth, 0);
    gradient.addColorStop(0, rgba(settings.colorFar, 1));
    gradient.addColorStop(0.12, rgba(twizzlerLerpColor(settings.colorFar, settings.colorEdge, 0.75), 1));
    gradient.addColorStop(0.28, rgba(settings.colorEdge, 1));
    gradient.addColorStop(0.48, rgba(twizzlerLerpColor(settings.colorEdge, settings.colorNear, 0.45), 1));
    gradient.addColorStop(0.72, rgba(settings.colorNear, 1));
    gradient.addColorStop(1, rgba(settings.colorNear, 1));
    context.strokeStyle = gradient;
    context.globalAlpha = Math.min(0.95, line.opacity);
    context.lineWidth = Math.max(0.28, settings.lineWidth * (0.58 + mid.depth * 0.06));
    context.beginPath();
    context.moveTo(line.points[0].x, line.points[0].y);
    for (let index = 1; index < line.points.length; index += 1) {
      const point = line.points[index];
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  }

  // Soft density pass: gentle mid-tone build without a dark spine.
  context.setLineDash([]);
  for (const line of ordered) {
    if (Math.abs(line.across) > 0.55) continue;
    if (line.points.length < 2) continue;
    const along = line.points[Math.floor(line.points.length * 0.55)]!.along;
    const densColor =
      along < 0.4
        ? twizzlerLerpColor(settings.colorFar, settings.colorEdge, 0.55)
        : twizzlerLerpColor(settings.colorEdge, settings.colorNear, 0.55);
    context.strokeStyle = rgba(densColor, 1);
    context.globalAlpha = Math.min(0.14, line.opacity * 0.18 * (0.5 + along * 0.5));
    context.lineWidth = Math.max(0.2, settings.lineWidth * 0.4);
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
