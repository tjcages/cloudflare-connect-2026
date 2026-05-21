import type { Graphics } from "pixi.js";

export const CONNECTOR_DASH_ON_PX = 3;
export const CONNECTOR_DASH_OFF_PX = 4;

type Point = { x: number; y: number };

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

const lerpPoint = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

const pointAtDistance = (points: readonly Point[], distanceAlong: number): Point | null => {
  if (points.length === 0) {
    return null;
  }
  if (distanceAlong <= 0) {
    return points[0]!;
  }

  let traveled = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]!;
    const b = points[index + 1]!;
    const segLen = distance(a, b);
    if (traveled + segLen >= distanceAlong) {
      const t = segLen === 0 ? 0 : (distanceAlong - traveled) / segLen;
      return lerpPoint(a, b, t);
    }
    traveled += segLen;
  }

  return points[points.length - 1]!;
};

const polylineLength = (points: readonly Point[]): number => {
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    total += distance(points[index]!, points[index + 1]!);
  }
  return total;
};

const appendDashedSegment = (
  graphics: Graphics,
  points: readonly Point[],
  startDist: number,
  endDist: number,
): void => {
  const start = pointAtDistance(points, startDist);
  const end = pointAtDistance(points, endDist);
  if (!start || !end) {
    return;
  }

  graphics.moveTo(start.x, start.y);

  let traveled = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]!;
    const b = points[index + 1]!;
    const segStart = traveled;
    const segEnd = traveled + distance(a, b);

    if (segEnd <= startDist) {
      traveled = segEnd;
      continue;
    }
    if (segStart >= endDist) {
      break;
    }

    const segStartDist = Math.max(startDist, segStart);
    const segEndDist = Math.min(endDist, segEnd);
    const segLen = segEnd - segStart;
    const t0 = segLen === 0 ? 0 : (segStartDist - segStart) / segLen;
    const t1 = segLen === 0 ? 0 : (segEndDist - segStart) / segLen;
    const from = segStartDist === segStart ? a : lerpPoint(a, b, t0);
    const to = segEndDist === segEnd ? b : lerpPoint(a, b, t1);

    if (segStartDist === startDist) {
      graphics.moveTo(from.x, from.y);
    }
    graphics.lineTo(to.x, to.y);

    traveled = segEnd;
  }
};

/** Append dashed subpaths along a polyline with continuous phase across bends. */
export const appendDashedPolyline = (
  graphics: Graphics,
  points: readonly Point[],
  dashOn: number,
  dashOff: number,
  phaseOffset = 0,
): void => {
  if (points.length < 2 || dashOn <= 0) {
    return;
  }

  const total = polylineLength(points);
  if (total <= 0) {
    return;
  }

  const cycle = dashOn + dashOff;
  const normalizedPhase = ((phaseOffset % cycle) + cycle) % cycle;
  let cursor = -normalizedPhase;
  while (cursor < total) {
    const dashStart = Math.max(0, cursor);
    const dashEnd = Math.min(cursor + dashOn, total);
    if (dashEnd > dashStart) {
      appendDashedSegment(graphics, points, dashStart, dashEnd);
    }
    cursor += cycle;
  }
};

/** Append a dashed rectangle outline (clockwise from top-left). */
export const appendDashedRectOutline = (
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  dashOn: number,
  dashOff: number,
): void => {
  appendDashedPolyline(
    graphics,
    [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
      { x, y },
    ],
    dashOn,
    dashOff,
  );
};

/** Append a dashed rounded-rect outline by walking four straight edges (corners stay square for tiny caps). */
export const appendDashedRoundRectOutline = (
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  dashOn: number,
  dashOff: number,
): void => {
  appendDashedRectOutline(graphics, x, y, width, height, dashOn, dashOff);
};
