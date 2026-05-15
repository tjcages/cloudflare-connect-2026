import { getInstanceAnchorPoint } from "../../../lib/componentRegistry";
import { ICON_BOX_SNAP_ANCHOR_Y } from "../../../lib/icon-box/layout";
import {
  LARGE_CELL_SIZE,
  type ComponentInstance,
  type ConnectorConnectionPreference,
  type ConnectorEndpoint,
} from "../../../grid/types";

export type ConnectorPoint = { x: number; y: number };
export type ConnectorSegmentCell = { x: number; y: number; width: number; height: number };
export type ConnectorRouteBounds = { width: number; height: number };

const snapToConnectorLattice = (value: number): number =>
  LARGE_CELL_SIZE / 2 + Math.round((value - LARGE_CELL_SIZE / 2) / LARGE_CELL_SIZE) * LARGE_CELL_SIZE;

export const resolveConnectorEndpoint = (
  endpoint: ConnectorEndpoint,
  instances: ComponentInstance[],
): ConnectorPoint | null => {
  if (endpoint.kind === "cell") {
    return { x: endpoint.x, y: endpoint.y };
  }

  const target = instances.find((instance) => instance.id === endpoint.instanceId);
  if (!target || target.type === "connector-line") {
    return null;
  }

  const anchor = getInstanceAnchorPoint(target);
  return {
    x: snapToConnectorLattice(anchor.x),
    y: snapToConnectorLattice(anchor.y),
  };
};

const refineIconBox2x1LayerEndpoint = (
  endpoint: ConnectorEndpoint,
  instances: ComponentInstance[],
  peer: ConnectorPoint,
): ConnectorPoint | null => {
  if (endpoint.kind !== "layer") {
    return null;
  }
  const inst = instances.find((i) => i.id === endpoint.instanceId);
  if (!inst || inst.type !== "icon-box-2x1") {
    return null;
  }
  /** Snapped junctions: left-cell center → mid seam → right-cell center (stay inside the 160px footprint). */
  const latticeXWest = snapToConnectorLattice(inst.x + LARGE_CELL_SIZE / 2);
  const latticeXMid = snapToConnectorLattice(inst.x + LARGE_CELL_SIZE);
  const latticeXEast = snapToConnectorLattice(inst.x + LARGE_CELL_SIZE + LARGE_CELL_SIZE / 2);
  const yLattice = snapToConnectorLattice(inst.y + ICON_BOX_SNAP_ANCHOR_Y);

  const nearestLatticeInPair = (ax: number, bx: number): ConnectorPoint => {
    const pa = { x: ax, y: yLattice };
    const pb = { x: bx, y: yLattice };
    const da = (pa.x - peer.x) ** 2 + (pa.y - peer.y) ** 2;
    const db = (pb.x - peer.x) ** 2 + (pb.y - peer.y) ** 2;
    if (da < db) {
      return pa;
    }
    if (db < da) {
      return pb;
    }
    /** Tie: prefer farther-west junction for deterministic routing. */
    return ax <= bx ? pa : pb;
  };

  const leftHalfBest = nearestLatticeInPair(latticeXWest, latticeXMid);
  const rightHalfBest = nearestLatticeInPair(latticeXMid, latticeXEast);

  const dLeft = (leftHalfBest.x - peer.x) ** 2 + (leftHalfBest.y - peer.y) ** 2;
  const dRight = (rightHalfBest.x - peer.x) ** 2 + (rightHalfBest.y - peer.y) ** 2;
  return dLeft <= dRight ? leftHalfBest : rightHalfBest;
};

const dedupeConnectorPoints = (points: ConnectorPoint[]): ConnectorPoint[] => {
  const seen = new Set<string>();
  const out: ConnectorPoint[] = [];
  for (const p of points) {
    const key = `${p.x},${p.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
};

/**
 * Lattice cell centers used to stroke endpoint highlight rectangles.
 * Static cells and normal icon layers use `resolved`; `icon-box-2x1` layers highlight both occupied cells.
 */
export const getConnectorEndpointHighlightFrameCenters = (
  endpoint: ConnectorEndpoint,
  instances: ComponentInstance[],
  resolved: ConnectorPoint,
): ConnectorPoint[] => {
  if (endpoint.kind !== "layer") {
    return [resolved];
  }
  const layer = instances.find((i) => i.id === endpoint.instanceId);
  if (!layer || layer.type !== "icon-box-2x1") {
    return [resolved];
  }
  const yLattice = snapToConnectorLattice(layer.y + ICON_BOX_SNAP_ANCHOR_Y);
  const xLeft = snapToConnectorLattice(layer.x + LARGE_CELL_SIZE / 2);
  const xRight = snapToConnectorLattice(layer.x + LARGE_CELL_SIZE + LARGE_CELL_SIZE / 2);
  if (xLeft === xRight) {
    return [{ x: xLeft, y: yLattice }];
  }
  return [
    { x: xLeft, y: yLattice },
    { x: xRight, y: yLattice },
  ];
};

export const getConnectorLineEndpointHighlightCenters = (
  instance: Extract<ComponentInstance, { type: "connector-line" }>,
  instances: ComponentInstance[],
  resolved: { source: ConnectorPoint; target: ConnectorPoint },
): ConnectorPoint[] =>
  dedupeConnectorPoints([
    ...getConnectorEndpointHighlightFrameCenters(instance.props.source, instances, resolved.source),
    ...getConnectorEndpointHighlightFrameCenters(instance.props.target, instances, resolved.target),
  ]);

/** Resolves both endpoints; `icon-box-2x1` layers use the half (left/right center) nearest the peer endpoint. */
export const resolveConnectorLineEndpoints = (
  instance: Extract<ComponentInstance, { type: "connector-line" }>,
  instances: ComponentInstance[],
): { source: ConnectorPoint; target: ConnectorPoint } | null => {
  const looseSource = resolveConnectorEndpoint(instance.props.source, instances);
  const looseTarget = resolveConnectorEndpoint(instance.props.target, instances);
  if (!looseSource || !looseTarget) {
    return null;
  }
  const source = refineIconBox2x1LayerEndpoint(instance.props.source, instances, looseTarget) ?? looseSource;
  const target = refineIconBox2x1LayerEndpoint(instance.props.target, instances, source) ?? looseTarget;
  return { source, target };
};

const sign = (value: number): -1 | 0 | 1 => {
  if (value < 0) {
    return -1;
  }
  if (value > 0) {
    return 1;
  }
  return 0;
};

const pushPoint = (points: ConnectorPoint[], point: ConnectorPoint) => {
  const previous = points[points.length - 1];
  if (!previous || previous.x !== point.x || previous.y !== point.y) {
    points.push(point);
  }
};

const stepToward = (from: number, to: number): number => {
  const delta = to - from;
  if (Math.abs(delta) <= LARGE_CELL_SIZE) {
    return to;
  }
  return from + sign(delta) * LARGE_CELL_SIZE;
};

const moveAlongAxis = (points: ConnectorPoint[], from: ConnectorPoint, axis: "x" | "y", targetValue: number) => {
  let current = from;
  while (current[axis] !== targetValue) {
    current = { ...current, [axis]: stepToward(current[axis], targetValue) };
    pushPoint(points, current);
  }
  return current;
};

/** East/west offset for leaving the target column with room to finish on a horizontal leg. */
const pickHorizontalJogSign = (at: ConnectorPoint, bounds?: ConnectorRouteBounds): -1 | 1 | null => {
  const canJogRight = !bounds || at.x + LARGE_CELL_SIZE <= bounds.width;
  const canJogLeft = !bounds || at.x - LARGE_CELL_SIZE >= 0;
  if (canJogRight && canJogLeft) {
    return 1;
  }
  if (canJogRight) {
    return 1;
  }
  if (canJogLeft) {
    return -1;
  }
  return null;
};

/**
 * Horizontal connection path must not start the Δy sweep from the target column (same-x / one-step-from-target-x),
 * or the first major leg reads as vertical from the anchor.
 */
const applyHorizontalLeadBeforeVerticalSweep = (
  points: ConnectorPoint[],
  current: ConnectorPoint,
  target: ConnectorPoint,
  bounds?: ConnectorRouteBounds,
): ConnectorPoint => {
  if (current.y === target.y) {
    return current;
  }
  const dx = target.x - current.x;
  if (dx === 0) {
    const j = pickHorizontalJogSign(current, bounds);
    if (j === null) {
      return current;
    }
    const next = { x: current.x + j * LARGE_CELL_SIZE, y: current.y };
    pushPoint(points, next);
    return next;
  }
  const towardStep = sign(dx) * LARGE_CELL_SIZE;
  if (towardStep !== dx) {
    return current;
  }
  const awaySign = -sign(dx) as -1 | 1;
  const canAwayEast = !bounds || current.x + LARGE_CELL_SIZE <= bounds.width;
  const canAwayWest = !bounds || current.x - LARGE_CELL_SIZE >= 0;
  let jog: -1 | 1 | null = awaySign === 1 && canAwayEast ? 1 : awaySign === -1 && canAwayWest ? -1 : null;
  if (jog === null) {
    jog = awaySign === 1 && canAwayWest ? -1 : awaySign === -1 && canAwayEast ? 1 : null;
  }
  if (jog === null) {
    jog = pickHorizontalJogSign(current, bounds);
  }
  if (jog === null) {
    return current;
  }
  const next = { x: current.x + jog * LARGE_CELL_SIZE, y: current.y };
  pushPoint(points, next);
  return next;
};

const routeBothAxes = (
  source: ConnectorPoint,
  target: ConnectorPoint,
  preferredConnection: ConnectorConnectionPreference,
  bounds?: ConnectorRouteBounds,
  /**
   * When true, `source` is already one horizontal cell off the shared column (collinear jog).
   * Skip the extra “away” jog when |Δx| to the target is exactly one cell so the path does not overshoot.
   */
  afterCollinearHorizontalJog = false,
): ConnectorPoint[] => {
  const points = [source];
  let current = source;
  const primaryAxis = preferredConnection === "horizontal" ? "x" : "y";
  const secondaryAxis = primaryAxis === "x" ? "y" : "x";

  const primaryDelta = Math.abs(target[primaryAxis] - source[primaryAxis]);
  let primaryLeadFromLongAxis = false;
  if (primaryDelta > LARGE_CELL_SIZE) {
    primaryLeadFromLongAxis = true;
    current = {
      ...current,
      [primaryAxis]: current[primaryAxis] + sign(target[primaryAxis] - current[primaryAxis]) * LARGE_CELL_SIZE,
    };
    pushPoint(points, current);
  }

  if (preferredConnection === "horizontal" && !primaryLeadFromLongAxis) {
    const absDx = Math.abs(target.x - current.x);
    const skipSecondAwayJog = afterCollinearHorizontalJog && absDx === LARGE_CELL_SIZE && current.x !== target.x;
    if (!skipSecondAwayJog) {
      current = applyHorizontalLeadBeforeVerticalSweep(points, current, target, bounds);
    }
  }

  current = moveAlongAxis(points, current, secondaryAxis, target[secondaryAxis]);
  current = moveAlongAxis(points, current, primaryAxis, target[primaryAxis]);

  return points;
};

const routeDirect = (source: ConnectorPoint, target: ConnectorPoint): ConnectorPoint[] => {
  const points = [source];
  let current = source;
  while (current.x !== target.x || current.y !== target.y) {
    current = {
      x: current.x === target.x ? target.x : stepToward(current.x, target.x),
      y: current.y === target.y ? target.y : stepToward(current.y, target.y),
    };
    pushPoint(points, current);
  }
  return points;
};

const routeStraightWithDogleg = (
  source: ConnectorPoint,
  target: ConnectorPoint,
  preferredConnection: ConnectorConnectionPreference,
  bounds?: ConnectorRouteBounds,
): ConnectorPoint[] => {
  const horizontal = source.y === target.y;
  const distance = Math.abs(horizontal ? target.x - source.x : target.y - source.y);
  if (distance < LARGE_CELL_SIZE * 3) {
    return routeDirect(source, target);
  }

  if (horizontal) {
    const canDoglegDown = !bounds || source.y + LARGE_CELL_SIZE <= bounds.height;
    const canDoglegUp = !bounds || source.y - LARGE_CELL_SIZE >= 0;
    if (!canDoglegDown && !canDoglegUp) {
      return routeDirect(source, target);
    }
    const x1 = source.x + sign(target.x - source.x) * LARGE_CELL_SIZE;
    const x2 = target.x - sign(target.x - source.x) * LARGE_CELL_SIZE;
    const doglegSign = canDoglegDown ? 1 : -1;
    const y = source.y + doglegSign * LARGE_CELL_SIZE;
    return [source, { x: x1, y: source.y }, { x: x1, y }, { x: x2, y }, { x: x2, y: target.y }, target];
  }

  const canDoglegRight = !bounds || source.x + LARGE_CELL_SIZE <= bounds.width;
  const canDoglegLeft = !bounds || source.x - LARGE_CELL_SIZE >= 0;
  if (!canDoglegRight && !canDoglegLeft) {
    return routeDirect(source, target);
  }
  const y1 = source.y + sign(target.y - source.y) * LARGE_CELL_SIZE;
  const y2 = target.y - sign(target.y - source.y) * LARGE_CELL_SIZE;
  const doglegSign = canDoglegRight ? 1 : -1;
  const x = source.x + (preferredConnection === "vertical" ? doglegSign : doglegSign) * LARGE_CELL_SIZE;
  return [source, { x: source.x, y: y1 }, { x, y: y1 }, { x, y: y2 }, { x: target.x, y: y2 }, target];
};

/** Same-x endpoints: vertical span. Horizontal path leaves on an east/west jog first, then finishes horizontal-first. */
const routeCollinearVerticalWithHorizontalLead = (
  source: ConnectorPoint,
  target: ConnectorPoint,
  bounds?: ConnectorRouteBounds,
): ConnectorPoint[] => {
  const jogSign = pickHorizontalJogSign(source, bounds);
  if (jogSign === null) {
    return routeStraightWithDogleg(source, target, "horizontal", bounds);
  }
  const jog = { x: source.x + jogSign * LARGE_CELL_SIZE, y: source.y };
  return [source, ...routeBothAxes(jog, target, "horizontal", bounds, true)];
};

const ensureHorizontalFinalLegIntoTarget = (
  points: ConnectorPoint[],
  target: ConnectorPoint,
  bounds?: ConnectorRouteBounds,
): ConnectorPoint[] => {
  if (points.length < 2) {
    return points;
  }
  const penultimate = points[points.length - 2]!;
  const end = points[points.length - 1]!;
  if (end.x !== target.x || end.y !== target.y) {
    return points;
  }
  if (penultimate.x !== end.x || penultimate.y === end.y) {
    return points;
  }
  const jogSign = pickHorizontalJogSign(penultimate, bounds);
  if (jogSign === null) {
    return points;
  }
  const p1 = { x: penultimate.x + jogSign * LARGE_CELL_SIZE, y: penultimate.y };
  const p2 = { x: p1.x, y: target.y };
  return [...points.slice(0, -1), p1, p2, target];
};

export const routeConnectorPath = (
  source: ConnectorPoint,
  target: ConnectorPoint,
  preferredConnection: ConnectorConnectionPreference,
  bounds?: ConnectorRouteBounds,
): ConnectorPoint[] => {
  let points: ConnectorPoint[];
  if (preferredConnection === "horizontal" && source.x === target.x && source.y !== target.y) {
    points = routeCollinearVerticalWithHorizontalLead(source, target, bounds);
  } else if (source.x === target.x || source.y === target.y) {
    points = routeStraightWithDogleg(source, target, preferredConnection, bounds);
  } else {
    points = routeBothAxes(source, target, preferredConnection, bounds);
  }
  if (preferredConnection === "horizontal") {
    points = ensureHorizontalFinalLegIntoTarget(points, target, bounds);
  }
  return points;
};

export const getConnectorCornerPoints = (points: ConnectorPoint[]): ConnectorPoint[] => {
  const corners: ConnectorPoint[] = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1];
    const point = points[index];
    const next = points[index + 1];
    const incomingHorizontal = prev.y === point.y;
    const outgoingHorizontal = point.y === next.y;
    if (incomingHorizontal !== outgoingHorizontal) {
      corners.push(point);
    }
  }
  return corners;
};

export const getConnectorSegmentCells = (points: ConnectorPoint[]): ConnectorSegmentCell[] => {
  const cells: ConnectorSegmentCell[] = [];
  const seen = new Set<string>();
  for (const point of points) {
    const key = `${point.x}:${point.y}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    cells.push({
      x: point.x - LARGE_CELL_SIZE / 2,
      y: point.y - LARGE_CELL_SIZE / 2,
      width: LARGE_CELL_SIZE,
      height: LARGE_CELL_SIZE,
    });
  }
  return cells;
};
