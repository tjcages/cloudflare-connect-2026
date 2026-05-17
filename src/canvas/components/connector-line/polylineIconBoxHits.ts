import type { ComponentInstance } from "../../../grid/types";
import { getInstanceCanvasBounds } from "../../../lib/componentRegistry";
import type { PathPoint } from "./pathMotion";
import { pointAlongPolyline, type PolylineMetrics } from "./pathMotion";

export type AxisAlignedRect = { x: number; y: number; width: number; height: number };

/** Sparks originate this far inside shadow bounds along the inward normal from the perimeter hit (~inner card gutter). */
export const ICON_BOX_HIT_PARTICLE_INNER_INSET_PX = 8;

export type IconBoxHitAlongConnector = {
  boxId: string;
  /** Source→target: pulse crosses into shadow-card bounds (outside→inside along polyline). */
  forwardArc: number;
  /** Target→source: pulse crosses decreasing-arc boundary at shadow exit (backward leg). */
  backwardArc: number;
  /** Border contact geometry (pulse ↔ shadow perimeter). */
  emitterForward: PathPoint;
  emitterBackward: PathPoint;
  /** Hit sparks start inside shadow by {@link ICON_BOX_HIT_PARTICLE_INNER_INSET_PX} toward interior. */
  particleEmitForward: PathPoint;
  particleEmitBackward: PathPoint;
  /**
   * Connector “touch” impulse on inner body (~1 px Motion): unit vector pointing **into** the shadow rect
   * along the pulse leg (pulse momentum into interior).
   */
  pushForwardX: number;
  pushForwardY: number;
  pushBackwardX: number;
  pushBackwardY: number;
};

type SegmentClip =
  | {
      kind: "horizontal";
      arcEnter: number;
      arcExit: number;
      lineY: number;
      metricIndex: number;
    }
  | {
      kind: "vertical";
      arcEnter: number;
      arcExit: number;
      lineX: number;
      metricIndex: number;
    };

/** Unit tangent pointing toward **increasing** arc-length along segment `metricIndex`. */
export const segmentUnitTangentTowardIncreasingArc = (
  points: PathPoint[],
  metricIndex: number,
): { x: number; y: number } => {
  const sx = points[metricIndex]!.x;
  const sy = points[metricIndex]!.y;
  const ex = points[metricIndex + 1]!.x;
  const ey = points[metricIndex + 1]!.y;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    return { x: 1, y: 0 };
  }
  return { x: dx / len, y: dy / len };
};

/** Into shadow interior from perimeter (+y downward). Corners tie-break left → right → top → bottom (stable). */
const inwardNormalAtHit = (px: number, py: number, rect: AxisAlignedRect): { nx: number; ny: number } => {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  const dL = Math.abs(px - left);
  const dR = Math.abs(px - right);
  const dT = Math.abs(py - top);
  const dB = Math.abs(py - bottom);

  const minD = Math.min(dL, dR, dT, dB);
  const tol = 1e-5;
  const candidates = [
    { d: dL, nx: 1 as number, ny: 0 as number },
    { d: dR, nx: -1, ny: 0 },
    { d: dT, nx: 0, ny: 1 },
    { d: dB, nx: 0, ny: -1 },
  ];
  const first = candidates.find((c) => c.d <= minD + tol)!;
  return { nx: first.nx, ny: first.ny };
};

/** Prefer + or − tangent based on whichever points more into shadow interior (`n`). */
const unitIntoInteriorAlongSegment = (
  tangentX: number,
  tangentY: number,
  inwardNx: number,
  inwardNy: number,
): { x: number; y: number } => {
  const dotP = tangentX * inwardNx + tangentY * inwardNy;
  const dotN = -tangentX * inwardNx - tangentY * inwardNy;
  const pick = dotP >= dotN ? { x: tangentX, y: tangentY } : { x: -tangentX, y: -tangentY };
  const len = Math.hypot(pick.x, pick.y);
  return len < 1e-9 ? { x: inwardNx, y: inwardNy } : { x: pick.x / len, y: pick.y / len };
};

/**
 * Forward crest moves toward increasing arc ⇒ approach uses +`T`; backward leg ⇒ −`T`; pick whichever
 * direction matches inward momentum into shadow.
 */
const leanDirectionFromPulse = (
  tangentX: number,
  tangentY: number,
  inwardNx: number,
  inwardNy: number,
  leg: "forward" | "backward",
): { x: number; y: number } => {
  const vx = leg === "forward" ? tangentX : -tangentX;
  const vy = leg === "forward" ? tangentY : -tangentY;
  return unitIntoInteriorAlongSegment(vx, vy, inwardNx, inwardNy);
};

const snapHitToNearestEdge = (p: PathPoint, rect: AxisAlignedRect): PathPoint => {
  const dl = Math.abs(p.x - rect.x);
  const dr = Math.abs(p.x - (rect.x + rect.width));
  const dt = Math.abs(p.y - rect.y);
  const db = Math.abs(p.y - (rect.y + rect.height));
  const m = Math.min(dl, dr, dt, db);
  const clampX = (): number => Math.min(rect.x + rect.width, Math.max(rect.x, p.x));
  const clampY = (): number => Math.min(rect.y + rect.height, Math.max(rect.y, p.y));
  if (m === dl) {
    return { x: rect.x, y: clampY() };
  }
  if (m === dr) {
    return { x: rect.x + rect.width, y: clampY() };
  }
  if (m === dt) {
    return { x: clampX(), y: rect.y };
  }
  return { x: clampX(), y: rect.y + rect.height };
};

/** Horizontal orth segment [sx,sy]→[ex,ey]; arc distances include arcBase. */
const clipHorizontalSegment = (
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  arcBase: number,
  metricIndex: number,
  rect: AxisAlignedRect,
): SegmentClip | null => {
  if (sy !== ey) {
    return null;
  }

  const ymin = rect.y;
  const ymax = rect.y + rect.height;
  if (sy < ymin || sy > ymax) {
    return null;
  }

  const xmin = rect.x;
  const xmax = rect.x + rect.width;

  const segLo = Math.min(sx, ex);
  const segHi = Math.max(sx, ex);
  const overlapLo = Math.max(segLo, xmin);
  const overlapHi = Math.min(segHi, xmax);
  if (overlapLo > overlapHi) {
    return null;
  }

  const dx = ex - sx;
  let enterDist: number;
  let exitDist: number;

  if (dx >= 0) {
    enterDist = sx < overlapLo ? overlapLo - sx : 0;
    exitDist = ex > overlapHi ? overlapHi - sx : ex - sx;
  } else {
    enterDist = sx > overlapHi ? sx - overlapHi : 0;
    exitDist = ex < overlapLo ? sx - overlapLo : sx - ex;
  }

  if (exitDist + 1e-6 < enterDist) {
    return null;
  }

  return {
    kind: "horizontal",
    arcEnter: arcBase + enterDist,
    arcExit: arcBase + exitDist,
    lineY: sy,
    metricIndex,
  };
};

const clipVerticalSegment = (
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  arcBase: number,
  metricIndex: number,
  rect: AxisAlignedRect,
): SegmentClip | null => {
  if (sx !== ex) {
    return null;
  }

  const xmin = rect.x;
  const xmax = rect.x + rect.width;
  if (sx < xmin || sx > xmax) {
    return null;
  }

  const ymin = rect.y;
  const ymax = rect.y + rect.height;

  const segLo = Math.min(sy, ey);
  const segHi = Math.max(sy, ey);
  const overlapLo = Math.max(segLo, ymin);
  const overlapHi = Math.min(segHi, ymax);
  if (overlapLo > overlapHi) {
    return null;
  }

  const dy = ey - sy;
  let enterDist: number;
  let exitDist: number;

  if (dy >= 0) {
    enterDist = sy < overlapLo ? overlapLo - sy : 0;
    exitDist = ey > overlapHi ? overlapHi - sy : ey - sy;
  } else {
    enterDist = sy > overlapHi ? sy - overlapHi : 0;
    exitDist = ey < overlapLo ? sy - overlapLo : sy - ey;
  }

  if (exitDist + 1e-6 < enterDist) {
    return null;
  }

  return {
    kind: "vertical",
    arcEnter: arcBase + enterDist,
    arcExit: arcBase + exitDist,
    lineX: sx,
    metricIndex,
  };
};

const collectSegmentClipsForRect = (
  points: PathPoint[],
  metrics: PolylineMetrics,
  rect: AxisAlignedRect,
): SegmentClip[] => {
  const clips: SegmentClip[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const sx = points[i].x;
    const sy = points[i].y;
    const ex = points[i + 1].x;
    const ey = points[i + 1].y;
    const arcBase = metrics.distToVertex[i];

    const h = clipHorizontalSegment(sx, sy, ex, ey, arcBase, i, rect);
    if (h) {
      clips.push(h);
      continue;
    }
    const v = clipVerticalSegment(sx, sy, ex, ey, arcBase, i, rect);
    if (v) {
      clips.push(v);
    }
  }
  return clips;
};

/** Smallest/largest arc along the polyline where the route enters/exits `rect` (when it crosses). */
export const getIconBoxConnectorCrossingArcsForRect = (
  points: PathPoint[],
  metrics: PolylineMetrics,
  rect: AxisAlignedRect,
): { forwardArc: number; backwardArc: number } | null => {
  const clips = collectSegmentClipsForRect(points, metrics, rect);
  if (clips.length === 0) {
    return null;
  }
  let forwardArc = Infinity;
  let backwardArc = -Infinity;
  for (const clip of clips) {
    forwardArc = Math.min(forwardArc, clip.arcEnter);
    backwardArc = Math.max(backwardArc, clip.arcExit);
  }
  if (!Number.isFinite(forwardArc) || !Number.isFinite(backwardArc)) {
    return null;
  }
  return { forwardArc, backwardArc };
};

const pickClipForArc = (clips: SegmentClip[], arc: number): SegmentClip | null => {
  const epsilon = 1e-4;
  for (const clip of clips) {
    if (arc >= clip.arcEnter - epsilon && arc <= clip.arcExit + epsilon) {
      return clip;
    }
  }
  let best: SegmentClip | null = null;
  let bestDist = Infinity;
  for (const clip of clips) {
    const mid = (clip.arcEnter + clip.arcExit) / 2;
    const dist = Math.abs(arc - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = clip;
    }
  }
  return best;
};

export const collectIconBoxHitsAlongConnector = (
  points: PathPoint[],
  metrics: PolylineMetrics,
  instances: ComponentInstance[],
): IconBoxHitAlongConnector[] => {
  if (points.length < 2 || metrics.totalLength <= 0) {
    return [];
  }

  const iconBoxes = instances.filter(
    (i): i is Extract<ComponentInstance, { type: "icon-box" | "icon-box-2x1" }> =>
      i.type === "icon-box" || i.type === "icon-box-2x1",
  );

  const hits: IconBoxHitAlongConnector[] = [];

  for (const box of iconBoxes) {
    const bounds = getInstanceCanvasBounds(box);
    const rect: AxisAlignedRect = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    const clips = collectSegmentClipsForRect(points, metrics, rect);
    if (clips.length === 0) {
      continue;
    }

    let forwardArc = Infinity;
    let backwardArc = -Infinity;
    for (const clip of clips) {
      forwardArc = Math.min(forwardArc, clip.arcEnter);
      backwardArc = Math.max(backwardArc, clip.arcExit);
    }

    if (!Number.isFinite(forwardArc) || !Number.isFinite(backwardArc)) {
      continue;
    }

    const fwdClip = pickClipForArc(clips, forwardArc);
    const backClip = pickClipForArc(clips, backwardArc);

    const tanFwd = fwdClip ? segmentUnitTangentTowardIncreasingArc(points, fwdClip.metricIndex) : { x: 1, y: 0 };
    const tanBack = backClip ? segmentUnitTangentTowardIncreasingArc(points, backClip.metricIndex) : tanFwd;

    const rawFwd = pointAlongPolyline(points, metrics, forwardArc);
    const rawBack = pointAlongPolyline(points, metrics, backwardArc);

    const nInFwd = inwardNormalAtHit(rawFwd.x, rawFwd.y, rect);
    const nInBack = inwardNormalAtHit(rawBack.x, rawBack.y, rect);

    const leanFwd = leanDirectionFromPulse(tanFwd.x, tanFwd.y, nInFwd.nx, nInFwd.ny, "forward");
    const leanBack = leanDirectionFromPulse(tanBack.x, tanBack.y, nInBack.nx, nInBack.ny, "backward");

    const emitterFwd = snapHitToNearestEdge(rawFwd, rect);
    const emitterBack = snapHitToNearestEdge(rawBack, rect);

    const inset = ICON_BOX_HIT_PARTICLE_INNER_INSET_PX;

    hits.push({
      boxId: box.id,
      forwardArc,
      backwardArc,
      emitterForward: emitterFwd,
      emitterBackward: emitterBack,
      particleEmitForward: {
        x: emitterFwd.x + nInFwd.nx * inset,
        y: emitterFwd.y + nInFwd.ny * inset,
      },
      particleEmitBackward: {
        x: emitterBack.x + nInBack.nx * inset,
        y: emitterBack.y + nInBack.ny * inset,
      },
      pushForwardX: leanFwd.x,
      pushForwardY: leanFwd.y,
      pushBackwardX: leanBack.x,
      pushBackwardY: leanBack.y,
    });
  }

  return hits;
};

/**
 * Recompute the inner-inset spark origin for a shadow card after the box moves. Uses the same arc on the
 * connector and current `rect` (canvas bounds), so particles stay glued to the live card geometry.
 */
export const resolveIconBoxParticleEmitAtArc = (
  points: PathPoint[],
  metrics: PolylineMetrics,
  rect: AxisAlignedRect,
  arc: number,
  insetPx = ICON_BOX_HIT_PARTICLE_INNER_INSET_PX,
): PathPoint => {
  const raw = pointAlongPolyline(points, metrics, arc);
  const nIn = inwardNormalAtHit(raw.x, raw.y, rect);
  const emitter = snapHitToNearestEdge(raw, rect);
  return {
    x: emitter.x + nIn.nx * insetPx,
    y: emitter.y + nIn.ny * insetPx,
  };
};

/**
 * Inner-inset spark origin for the current `rect`, using **fresh** enter/exit arcs along the connector.
 * Use this while an icon box moves so arc-length under the pulse stays tied to the live crossing.
 */
export const resolveIconBoxLiveParticleEmit = (
  points: PathPoint[],
  metrics: PolylineMetrics,
  rect: AxisAlignedRect,
  leg: "forward" | "backward",
  insetPx = ICON_BOX_HIT_PARTICLE_INNER_INSET_PX,
): PathPoint | null => {
  const crossing = getIconBoxConnectorCrossingArcsForRect(points, metrics, rect);
  if (!crossing) {
    return null;
  }
  const arc = leg === "forward" ? crossing.forwardArc : crossing.backwardArc;
  return resolveIconBoxParticleEmitAtArc(points, metrics, rect, arc, insetPx);
};
