export type TwizzlerSettings = {
  color: string;
  opacity: number;
  scale: number;
  centerY: number;
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
  twist: number;
  noiseScaleX: number;
  noiseScaleY: number;
  speed: number;
  drift: number;
};

export const TWIZZLER_DEFAULTS: TwizzlerSettings = {
  color: "#ef2b2d",
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
  twist: 1.35,
  noiseScaleX: 0.0015,
  noiseScaleY: 0.012,
  speed: 0.85,
  drift: 0.31,
};

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function fade(value: number): number {
  return value * value * (3 - 2 * value);
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

export function normalizeTwizzlerSettings(value: unknown): TwizzlerSettings {
  const input = value && typeof value === "object" ? (value as Partial<TwizzlerSettings>) : {};
  return {
    color: normalizeTwizzlerColor(input.color),
    opacity: clamp(input.opacity, TWIZZLER_DEFAULTS.opacity, 0, 1),
    scale: clamp(input.scale, TWIZZLER_DEFAULTS.scale, 0.1, 3),
    centerY: clamp(input.centerY, TWIZZLER_DEFAULTS.centerY, 0, 1),
    amplitude: clamp(input.amplitude, TWIZZLER_DEFAULTS.amplitude, 0, 1),
    lineCount: Math.round(clamp(input.lineCount, TWIZZLER_DEFAULTS.lineCount, 1, 300)),
    lineWidth: clamp(input.lineWidth, TWIZZLER_DEFAULTS.lineWidth, 0.25, 8),
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
    twist: clamp(input.twist, TWIZZLER_DEFAULTS.twist, 0, 4),
    noiseScaleX: clamp(input.noiseScaleX, TWIZZLER_DEFAULTS.noiseScaleX, 0.0001, 0.02),
    noiseScaleY: clamp(input.noiseScaleY, TWIZZLER_DEFAULTS.noiseScaleY, 0.001, 0.1),
    speed: clamp(input.speed, TWIZZLER_DEFAULTS.speed, 0, 3),
    drift: clamp(input.drift, TWIZZLER_DEFAULTS.drift, 0, 1),
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

export function twizzlerBendOffset(xT: number, position: number, amount: number): number {
  const distance = (xT - position) / 0.16;
  return amount * Math.exp(-0.5 * distance * distance);
}

export type TwizzlerLine = {
  opacity: number;
  points: Array<{ x: number; y: number }>;
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
  const segmentCount = Math.max(1, Math.ceil(pixelWidth / settings.pointSpacing));
  const lines: TwizzlerLine[] = [];

  for (let range = 0; range < settings.lineCount; range += 1) {
    const rangeT = settings.lineCount <= 1 ? 0.5 : range / (settings.lineCount - 1);
    const phase = (rangeT - 0.5) * Math.PI * 2 * settings.twist;
    const edges = twizzlerEdgeHeights(time, phase, settings);
    const points: TwizzlerLine["points"] = [];

    for (let point = 0; point <= segmentCount; point += 1) {
      const xT = point / segmentCount;
      const x = twizzlerPointX(point, segmentCount, pixelWidth);
      const edgeBaseline = edges.left + (edges.right - edges.left) * xT;
      const taper = 1 - settings.edgeTaper + settings.edgeTaper * Math.sin(Math.PI * xT);
      const flow = twizzlerNoise(
        x * settings.noiseScaleX + time * 0.1,
        range * settings.noiseScaleY + time * settings.drift * 0.1,
        0.37,
      );
      const wrinkle = Math.sin(xT * Math.PI * 2 * settings.wrinkles + phase + time * 0.85);
      const bend = twizzlerBendOffset(xT, settings.bendPosition, settings.bendAmount);
      const rawY =
        edgeBaseline + (flow - 0.5) * settings.amplitude * taper + wrinkle * settings.wrinkleStrength * taper + bend;
      const y = pixelHeight * (settings.centerY + (rawY - settings.centerY) * settings.scale);
      points.push({ x, y });
    }
    lines.push({ opacity: settings.opacity * (0.1 + rangeT * 0.9), points });
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
  context.lineWidth = settings.lineWidth;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = settings.color;

  for (const line of lines) {
    context.globalAlpha = line.opacity;
    context.beginPath();
    for (let point = 0; point < line.points.length; point += 1) {
      const { x, y } = line.points[point];
      if (point === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.restore();
}

export function clearTwizzler(canvas: HTMLCanvasElement): void {
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}
