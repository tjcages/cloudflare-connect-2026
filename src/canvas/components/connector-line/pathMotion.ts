export type PathPoint = { x: number; y: number };

export type PolylineMetrics = {
  segmentLengths: number[];
  totalLength: number;
  /** Arc length from `points[0]` to `points[i]` along the polyline. */
  distToVertex: number[];
};

export const getPolylineMetrics = (points: PathPoint[]): PolylineMetrics => {
  const segmentLengths: number[] = [];
  const distToVertex: number[] = [0];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.hypot(dx, dy);
    segmentLengths.push(len);
    total += len;
    distToVertex.push(total);
  }
  return { segmentLengths, totalLength: total, distToVertex };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const slicePolylineByDistance = (
  points: PathPoint[],
  metrics: PolylineMetrics,
  dLo: number,
  dHi: number,
): PathPoint[] => {
  if (points.length < 2 || metrics.totalLength === 0) {
    return [];
  }

  let a = clamp(dLo, 0, metrics.totalLength);
  let b = clamp(dHi, 0, metrics.totalLength);
  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }

  if (b - a < 1e-3) {
    return [];
  }

  const pointAt = (d: number): PathPoint => {
    const dist = clamp(d, 0, metrics.totalLength);
    let acc = 0;
    for (let i = 0; i < metrics.segmentLengths.length; i += 1) {
      const segLen = metrics.segmentLengths[i];
      if (dist <= acc + segLen) {
        const t = segLen === 0 ? 0 : (dist - acc) / segLen;
        const p0 = points[i];
        const p1 = points[i + 1];
        return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
      }
      acc += segLen;
    }
    return points[points.length - 1];
  };

  const ptLo = pointAt(a);
  const ptHi = pointAt(b);
  const out: PathPoint[] = [ptLo];

  for (let k = 1; k < points.length - 1; k += 1) {
    const dv = metrics.distToVertex[k];
    if (dv > a && dv < b) {
      out.push(points[k]);
    }
  }

  const last = out[out.length - 1];
  if (last.x !== ptHi.x || last.y !== ptHi.y) {
    out.push(ptHi);
  }

  return out;
};

/** Source → target → source oscillation; returns distance along path in `[0, totalLength]`. */
export const bounceDistanceAlong = (timeSeconds: number, speedPxPerSec: number, totalLength: number): number => {
  if (totalLength <= 0) {
    return 0;
  }
  const span = 2 * totalLength;
  const phase = (((timeSeconds * speedPxPerSec) % span) + span) % span;
  return phase < totalLength ? phase : span - phase;
};
