export interface CometArc {
  startX: number;
  startY: number;
  controlX: number;
  controlY: number;
  endX: number;
  endY: number;
}

const EASE_X1 = 0.6;
const EASE_Y1 = 0.6;
const EASE_X2 = 0;
const EASE_Y2 = 1;

function bezierAxis(a1: number, a2: number, u: number): number {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;
  return ((a * u + b) * u + c) * u;
}

function bezierSlope(a1: number, a2: number, u: number): number {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;
  return (3 * a * u + 2 * b) * u + c;
}

export function standardEase(t: number): number {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t;
  if (clamped === 0 || clamped === 1) return clamped;
  let u = clamped;
  for (let iteration = 0; iteration < 6; iteration++) {
    const error = bezierAxis(EASE_X1, EASE_X2, u) - clamped;
    const slope = bezierSlope(EASE_X1, EASE_X2, u);
    if (Math.abs(error) < 1e-5 || Math.abs(slope) < 1e-6) break;
    u -= error / slope;
    u = u <= 0 ? 0 : u >= 1 ? 1 : u;
  }
  return bezierAxis(EASE_Y1, EASE_Y2, u);
}

export function arcPointX(arc: CometArc, t: number): number {
  const inverse = 1 - t;
  return inverse * inverse * arc.startX + 2 * inverse * t * arc.controlX + t * t * arc.endX;
}

export function arcPointY(arc: CometArc, t: number): number {
  const inverse = 1 - t;
  return inverse * inverse * arc.startY + 2 * inverse * t * arc.controlY + t * t * arc.endY;
}

export function arcTangentX(arc: CometArc, t: number): number {
  return 2 * (1 - t) * (arc.controlX - arc.startX) + 2 * t * (arc.endX - arc.controlX);
}

export function arcTangentY(arc: CometArc, t: number): number {
  return 2 * (1 - t) * (arc.controlY - arc.startY) + 2 * t * (arc.endY - arc.controlY);
}

export function samplePathPixels(
  arc: CometArc,
  progress: number,
  tailSpan: number,
  pointCount: number,
  width: number,
  height: number,
  out: Float32Array,
  offset: number,
): void {
  const last = Math.max(1, pointCount - 1);
  for (let index = 0; index < pointCount; index++) {
    const t = progress - tailSpan * (index / last);
    const slot = offset + index * 2;
    out[slot] = arcPointX(arc, t) * width;
    out[slot + 1] = arcPointY(arc, t) * height;
  }
}
