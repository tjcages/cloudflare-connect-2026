/**
 * Connect Twizzler — twisted hairline ribbon.
 *
 * Geometry: a centerline + half-width + twist angle θ(x).
 * Fibers live at across ∈ [-1,1] on the ribbon face. Screen offset is
 *   across * halfW * cos(θ)
 * so edge-on (θ≈π/2) pinches to a dense core and face-on (θ≈0) fans open.
 * Mild braid shear + micro-waves create the crossed hairline mesh.
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
  color: "#ef2b2d",
  colorFar: "#ffd89a",
  colorNear: "#e8481c",
  colorEdge: "#ffe08a",
  opacity: 0.8,
  scale: 0.72,
  centerY: 0.5,
  amplitude: 0.42,
  lineCount: 100,
  lineWidth: 2,
  pointSpacing: 20,
  leftHeight: 0.5,
  rightHeight: 0.5,
  edgeFluctuation: 0.12,
  edgeSpeed: 0.65,
  edgeTaper: 0.15,
  wrinkles: 3,
  wrinkleStrength: 0.09,
  bendPosition: 0.5,
  bendAmount: 0,
  bend2Position: 0.3,
  bend2Amount: 0,
  bend3Position: 0.75,
  bend3Amount: 0,
  depthPosition: 0.65,
  depthAmount: 0,
  depthWidth: 0.25,
  depth2Position: 0.35,
  depth2Amount: 0,
  depth2Width: 0.25,
  depthSpread: 0,
  depthLift: 0,
  twist: 1.35,
  noiseScaleX: 0.0015,
  noiseScaleY: 0.012,
  speed: 0.85,
  drift: 0.31,
  stippleSize: 1.4,
  stippleGap: 2.2,
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
 * Shape: mid-left entry → small hills → valley pinch → steep fan to top-right.
 * Kept low enough on the right that a wide fan stays on-canvas.
 */
export function twizzlerMarketingCenterY(xT: number, settings: TwizzlerSettings, time: number): number {
  const x = Math.max(0, Math.min(1, xT));
  const edges = twizzlerEdgeHeights(time, 0, settings);
  const baseline = edges.left + (edges.right - edges.left) * x;
  // Two soft hills on the left, then a deeper valley, then a rise that stays on-canvas.
  const hills = -0.05 * Math.sin(x * Math.PI * 2.15 + 0.35) - 0.028 * Math.sin(x * Math.PI * 4.3 + 1.2);
  const valley = 0.12 * Math.exp(-Math.pow((x - 0.42) / 0.095, 2));
  const rise = -0.38 * Math.pow(smoothstep(0.46, 0.98, x), 1.12);
  const bend = twizzlerPathBend(x, settings) * 0.5;
  const y = baseline * 0.26 + 0.6 + hills + valley + rise + bend;
  return settings.centerY + (y - 0.55) * settings.scale;
}

/**
 * Intrinsic ribbon half-height (before twist projection).
 * Grows left→right; pinch comes from twist, not from collapsing this value.
 */
export function twizzlerMarketingWidth(xT: number, settings: TwizzlerSettings): number {
  const x = Math.max(0, Math.min(1, xT));
  const taper = 1 - settings.edgeTaper * 0.35 + settings.edgeTaper * 0.35 * Math.sin(Math.PI * x);
  const base = 0.038 + settings.amplitude * 0.07;
  const fan = (0.08 + settings.depthSpread * 0.2) * Math.pow(smoothstep(0.42, 1, x), 1.25);
  const depthBoost = (twizzlerDepthScale(x, settings) - 1) * 0.035;
  return Math.max(0.02, (base + fan + depthBoost) * taper);
}

/**
 * Twist angle θ(x): soft pinch at the valley, open face on the right fan.
 * Keep |cos(θ)| from collapsing too hard — density alone was turning the left
 * into a solid orange slab and washing out the right.
 */
export function twizzlerMarketingTwist(xT: number, settings: TwizzlerSettings, time: number): number {
  const x = Math.max(0, Math.min(1, xT));
  const pinch = Math.exp(-Math.pow((x - 0.42) / 0.085, 2));
  const open = Math.pow(smoothstep(0.52, 0.98, x), 1.05);
  // Soft pinch only — left stays translucent gold; right opens for the fan.
  const theta = 0.22 + settings.twist * (0.32 * pinch - 0.1 * open);
  return Math.max(0.14, theta) + time * 0.05;
}

/** Face-on amount 0..1 from twist (1 = full fan, 0 = edge-on). */
export function twizzlerFaceAmount(theta: number): number {
  return Math.abs(Math.cos(theta));
}

export type TwizzlerLine = {
  /** -1..1 across ribbon width. */
  across: number;
  opacity: number;
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
      const face = twizzlerFaceAmount(theta);
      const halfW = twizzlerMarketingWidth(c.xT, settings) * pixelHeight;

      // Mild hollow when face-on — keep the core tinted, not white.
      const hollowAcross =
        Math.sign(across) * (Math.abs(across) * (1 - 0.14 * face) + Math.pow(Math.abs(across), 0.7) * 0.14 * face);

      // Soft braid shear so fibers cross instead of staying perfectly parallel.
      const braid =
        hollowAcross +
        0.2 * Math.sin(theta * 1.35 + across * 2.1 + c.xT * Math.PI * 1.4) * (1 - across * across * 0.85);

      // Project ribbon face onto screen. Floor keeps a readable band when pinched.
      const projected = braid * halfW * (0.2 + 0.8 * face);

      const micro =
        (twizzlerNoise(c.x * settings.noiseScaleX * 12 + time * settings.drift, range * 0.37, 0.21) - 0.5) *
        settings.wrinkleStrength *
        halfW *
        (0.55 + face);
      // Fan micro-waves grow with face-on amount (right-side vibration in the refs).
      const wrinkle =
        Math.sin(c.xT * Math.PI * 2 * settings.wrinkles + across * 2.8 + time * 0.7) *
        settings.wrinkleStrength *
        halfW *
        (0.2 + 0.9 * face);

      const depth = twizzlerDepthScale(c.xT, settings);
      // Slight along-normal X shear from twist → crossing mesh without collapsing Y.
      const x =
        c.x +
        nx * braid * halfW * 0.045 * Math.sin(theta) +
        (twizzlerNoise(range * 0.17, c.xT * 40, time * 0.15) - 0.5) * 0.25;
      const y = c.y + ny * projected + micro + wrinkle - settings.depthLift * (depth - 1) * pixelHeight * 0.02;

      points.push({ x, y, depth, along: c.xT });
    }

    const edgeWeight = 0.35 + 0.65 * Math.abs(across);
    lines.push({
      across,
      opacity: settings.opacity * (0.22 + edgeWeight * 0.78),
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

  const ordered = [...lines].sort((a, b) => Math.abs(a.across) - Math.abs(b.across));

  // Draw every fiber in saturated near/coral first — density alone would make the
  // left too dark and the right too washed. A pale wash pass then restores the
  // marketing gold→coral read.
  for (const line of ordered) {
    if (line.points.length < 2) continue;
    if (settings.stippleSize > 0.01) {
      context.setLineDash([settings.stippleSize, settings.stippleGap + Math.abs(line.across) * 0.5]);
      context.lineDashOffset = line.across * 4;
    } else {
      context.setLineDash([]);
    }

    const mid = line.points[Math.floor(line.points.length * 0.55)] ?? line.points[0];
    const edgeMix = Math.pow(Math.max(0, Math.abs(line.across) - 0.78) / 0.22, 1.2);
    context.strokeStyle =
      edgeMix > 0.2 ? twizzlerLerpColor(settings.colorNear, settings.colorEdge, edgeMix * 0.45) : settings.colorNear;
    context.globalAlpha = Math.min(0.95, line.opacity * (0.34 + Math.abs(line.across) * 0.22 + mid.along * 0.28));
    context.lineWidth = Math.max(0.18, settings.lineWidth * (0.4 + mid.depth * 0.05));
    context.beginPath();
    context.moveTo(line.points[0].x, line.points[0].y);
    for (let index = 1; index < line.points.length; index += 1) {
      const point = line.points[index];
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  }

  // Pale-gold tint on the left only (source-atop = ribbon pixels, not background).
  context.setLineDash([]);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-atop";
  const far = parseHexColor(settings.colorFar);
  const wash = context.createLinearGradient(0, 0, pixelWidth, 0);
  wash.addColorStop(0, `rgba(${far.r},${far.g},${far.b},0.88)`);
  wash.addColorStop(0.3, `rgba(${far.r},${far.g},${far.b},0.48)`);
  wash.addColorStop(0.55, `rgba(${far.r},${far.g},${far.b},0.08)`);
  wash.addColorStop(1, `rgba(${far.r},${far.g},${far.b},0)`);
  context.fillStyle = wash;
  context.fillRect(0, 0, pixelWidth, pixelHeight);
  context.globalCompositeOperation = "source-over";

  context.restore();
}

export function clearTwizzler(canvas: HTMLCanvasElement): void {
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}
