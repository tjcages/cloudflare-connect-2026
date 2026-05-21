import { getInstanceAnchorPoint } from "../../../lib/componentRegistry";
import {
  BASE_UNIT,
  LARGE_CELL_SIZE,
  type ComponentInstance,
  type ConnectorConnectionPreference,
  type ConnectorEndpoint,
  type GapMask,
} from "../../../grid/types";

export type ConnectorPoint = { x: number; y: number };

export type ConnectorSegmentCell = { x: number; y: number; width: number; height: number };
export type ConnectorRouteBounds = { width: number; height: number; gapMask?: GapMask };

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

type ConnectorDirection = "left" | "right" | "up" | "down";
type ConnectorSearchDirection = ConnectorDirection | "start";

const CONNECTOR_DIRECTIONS: ConnectorDirection[] = ["right", "left", "down", "up"];

const samePoint = (a: ConnectorPoint, b: ConnectorPoint): boolean => a.x === b.x && a.y === b.y;

const directionAxis = (direction: ConnectorDirection): "x" | "y" =>
  direction === "left" || direction === "right" ? "x" : "y";

const preferredAxis = (preferredConnection: ConnectorConnectionPreference): "x" | "y" =>
  preferredConnection === "horizontal" ? "x" : "y";

const getEffectiveRouteBounds = (
  source: ConnectorPoint,
  target: ConnectorPoint,
  bounds?: ConnectorRouteBounds,
): ConnectorRouteBounds => ({
  width: bounds?.width ?? Math.max(source.x, target.x) + LARGE_CELL_SIZE * 2 + LARGE_CELL_SIZE / 2,
  height: bounds?.height ?? Math.max(source.y, target.y) + LARGE_CELL_SIZE * 2 + LARGE_CELL_SIZE / 2,
  gapMask: bounds?.gapMask,
});

const connectorCellTouchesGap = (point: ConnectorPoint, gapMask: GapMask): boolean => {
  const cellX = point.x - LARGE_CELL_SIZE / 2;
  const cellY = point.y - LARGE_CELL_SIZE / 2;
  const startColumn = Math.floor(cellX / BASE_UNIT);
  const endColumn = Math.ceil((cellX + LARGE_CELL_SIZE) / BASE_UNIT);
  const startRow = Math.floor(cellY / BASE_UNIT);
  const endRow = Math.ceil((cellY + LARGE_CELL_SIZE) / BASE_UNIT);

  for (let row = startRow; row < endRow; row += 1) {
    for (let column = startColumn; column < endColumn; column += 1) {
      if (gapMask[row]?.[column]) {
        return true;
      }
    }
  }

  return false;
};

const isConnectorPointBlocked = (point: ConnectorPoint, bounds?: ConnectorRouteBounds): boolean =>
  bounds?.gapMask ? connectorCellTouchesGap(point, bounds.gapMask) : false;

const eachPointAlongSegment = (
  a: ConnectorPoint,
  b: ConnectorPoint,
  visit: (point: ConnectorPoint) => boolean,
): boolean => {
  let current = a;
  while (!samePoint(current, b)) {
    if (a.y === b.y) {
      current = { x: stepToward(current.x, b.x), y: current.y };
    } else if (a.x === b.x) {
      current = { x: current.x, y: stepToward(current.y, b.y) };
    } else {
      current = {
        x: stepToward(current.x, b.x),
        y: stepToward(current.y, b.y),
      };
    }
    if (visit(current)) {
      return true;
    }
  }
  return false;
};

const pathTouchesBlockedGap = (points: ConnectorPoint[], bounds?: ConnectorRouteBounds): boolean => {
  if (points.length === 0) {
    return false;
  }
  if (isConnectorPointBlocked(points[0]!, bounds)) {
    return true;
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    if (eachPointAlongSegment(points[index]!, points[index + 1]!, (point) => isConnectorPointBlocked(point, bounds))) {
      return true;
    }
  }
  return false;
};

const buildConnectorAxisValues = (size: number, extraValues: number[]): number[] => {
  const min = LARGE_CELL_SIZE / 2;
  const max = Math.max(min, size - LARGE_CELL_SIZE / 2);
  const values = new Set<number>([min, max]);
  for (let value = min; value <= max; value += LARGE_CELL_SIZE) {
    values.add(value);
  }
  for (const value of extraValues) {
    if (Number.isFinite(value) && value >= 0 && value <= size) {
      values.add(value);
    }
  }
  return [...values].sort((a, b) => a - b);
};

const orderedDirectionsTowardTarget = (
  point: ConnectorPoint,
  target: ConnectorPoint,
  preferredConnection: ConnectorConnectionPreference,
): ConnectorDirection[] => {
  const horizontalFirst: ConnectorDirection[] = [
    target.x >= point.x ? "right" : "left",
    target.x >= point.x ? "left" : "right",
    target.y >= point.y ? "down" : "up",
    target.y >= point.y ? "up" : "down",
  ];
  const verticalFirst: ConnectorDirection[] = [
    target.y >= point.y ? "down" : "up",
    target.y >= point.y ? "up" : "down",
    target.x >= point.x ? "right" : "left",
    target.x >= point.x ? "left" : "right",
  ];
  const ordered = preferredConnection === "horizontal" ? horizontalFirst : verticalFirst;
  return ordered.filter((direction, index) => ordered.indexOf(direction) === index);
};

const neighborInDirection = (
  point: ConnectorPoint,
  direction: ConnectorDirection,
  xValues: number[],
  yValues: number[],
): ConnectorPoint | null => {
  if (direction === "left" || direction === "right") {
    const index = xValues.indexOf(point.x);
    const nextIndex = direction === "left" ? index - 1 : index + 1;
    const x = xValues[nextIndex];
    return x === undefined ? null : { x, y: point.y };
  }
  const index = yValues.indexOf(point.y);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  const y = yValues[nextIndex];
  return y === undefined ? null : { x: point.x, y };
};

const routeSearchStateKey = (point: ConnectorPoint, direction: ConnectorSearchDirection): string =>
  `${point.x}:${point.y}:${direction}`;

const pointDistanceToTarget = (point: ConnectorPoint, target: ConnectorPoint): number =>
  Math.abs(target.x - point.x) + Math.abs(target.y - point.y);

const findConnectorRoute = (
  source: ConnectorPoint,
  target: ConnectorPoint,
  preferredConnection: ConnectorConnectionPreference,
  bounds: ConnectorRouteBounds,
  enforceFirstAxis: boolean,
  enforceFinalAxis: boolean,
): ConnectorPoint[] | null => {
  if (samePoint(source, target)) {
    return [source];
  }

  const xValues = buildConnectorAxisValues(bounds.width, [source.x, target.x]);
  const yValues = buildConnectorAxisValues(bounds.height, [source.y, target.y]);
  const axis = preferredAxis(preferredConnection);
  const maxVisited = xValues.length * yValues.length * (CONNECTOR_DIRECTIONS.length + 1);
  type SearchState = {
    point: ConnectorPoint;
    direction: ConnectorSearchDirection;
    cost: number;
    path: ConnectorPoint[];
  };

  const open: SearchState[] = [{ point: source, direction: "start", cost: 0, path: [source] }];
  const bestCost = new Map<string, number>([[routeSearchStateKey(source, "start"), 0]]);
  let visited = 0;

  while (open.length > 0 && visited <= maxVisited) {
    open.sort(
      (a, b) =>
        a.cost - b.cost ||
        pointDistanceToTarget(a.point, target) - pointDistanceToTarget(b.point, target) ||
        routeSearchStateKey(a.point, a.direction).localeCompare(routeSearchStateKey(b.point, b.direction)),
    );
    const state = open.shift()!;
    visited += 1;

    if (samePoint(state.point, target)) {
      return state.path;
    }

    for (const direction of orderedDirectionsTowardTarget(state.point, target, preferredConnection)) {
      if (state.direction === "start" && enforceFirstAxis && directionAxis(direction) !== axis) {
        continue;
      }

      const neighbor = neighborInDirection(state.point, direction, xValues, yValues);
      if (!neighbor) {
        continue;
      }

      const reachesTarget = samePoint(neighbor, target);
      if (reachesTarget && enforceFinalAxis && directionAxis(direction) !== axis) {
        continue;
      }

      if (!reachesTarget && !samePoint(neighbor, source) && isConnectorPointBlocked(neighbor, bounds)) {
        continue;
      }

      const stepCost = Math.abs(neighbor.x - state.point.x) + Math.abs(neighbor.y - state.point.y);
      const bendCost = state.direction !== "start" && state.direction !== direction ? LARGE_CELL_SIZE / 4 : 0;
      const axisCost = directionAxis(direction) === axis ? 0 : 1;
      const nextCost = state.cost + stepCost + bendCost + axisCost;
      const key = routeSearchStateKey(neighbor, direction);
      const knownCost = bestCost.get(key);
      if (knownCost !== undefined && knownCost <= nextCost) {
        continue;
      }

      bestCost.set(key, nextCost);
      open.push({
        point: neighbor,
        direction,
        cost: nextCost,
        path: [...state.path, neighbor],
      });
    }
  }

  return null;
};

const routeWithPathSearch = (
  source: ConnectorPoint,
  target: ConnectorPoint,
  preferredConnection: ConnectorConnectionPreference,
  bounds?: ConnectorRouteBounds,
): ConnectorPoint[] | null => {
  const effectiveBounds = getEffectiveRouteBounds(source, target, bounds);
  return (
    findConnectorRoute(source, target, preferredConnection, effectiveBounds, true, true) ??
    findConnectorRoute(source, target, preferredConnection, effectiveBounds, false, true) ??
    findConnectorRoute(source, target, preferredConnection, effectiveBounds, true, false) ??
    findConnectorRoute(source, target, preferredConnection, effectiveBounds, false, false)
  );
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
  const repaired = [...points.slice(0, -1), p1, p2, target];
  return pathTouchesBlockedGap(repaired, bounds) ? points : repaired;
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

  if (pathTouchesBlockedGap(points, bounds)) {
    points = routeWithPathSearch(source, target, preferredConnection, bounds) ?? points;
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

export const connectorPointKey = (p: ConnectorPoint): string => `${p.x}:${p.y}`;

/** True if `q` lies on axis-aligned segment `[a,b]` (inclusive). */
export const isPointOnOrthoSegment = (a: ConnectorPoint, b: ConnectorPoint, q: ConnectorPoint): boolean => {
  if (a.y === b.y) {
    const y = a.y;
    if (q.y !== y) {
      return false;
    }
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return q.x >= minX && q.x <= maxX;
  }
  if (a.x === b.x) {
    const x = a.x;
    if (q.x !== x) {
      return false;
    }
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return q.y >= minY && q.y <= maxY;
  }
  return false;
};

export const isPointOnConnectorPolyline = (points: ConnectorPoint[], q: ConnectorPoint): boolean => {
  for (let i = 0; i < points.length - 1; i += 1) {
    if (isPointOnOrthoSegment(points[i]!, points[i + 1]!, q)) {
      return true;
    }
  }
  return false;
};

const getConnectorNativeCornerKeySet = (points: ConnectorPoint[]): Set<string> =>
  new Set(getConnectorCornerPoints(points).map(connectorPointKey));

/**
 * Nodes from other connectors (bends + perpendicular crossings) that lie on this polyline without being a bend here —
 * callers draw joint caps at these coordinates so crossings look consistent.
 */
export const getForeignCornerOverlapPoints = (
  points: ConnectorPoint[],
  foreignCorners: Iterable<ConnectorPoint>,
): ConnectorPoint[] => {
  const native = getConnectorNativeCornerKeySet(points);
  const seen = new Set<string>();
  const out: ConnectorPoint[] = [];
  for (const c of foreignCorners) {
    const k = connectorPointKey(c);
    if (native.has(k) || seen.has(k)) {
      continue;
    }
    if (!isPointOnConnectorPolyline(points, c)) {
      continue;
    }
    seen.add(k);
    out.push(c);
  }
  return out;
};

/** All bend vertices from other connector lines — used so routes that pass through inherit a visible joint. */
export const collectOtherConnectorCornerPoints = (
  selfId: string,
  instances: ComponentInstance[],
  bounds?: ConnectorRouteBounds,
): ConnectorPoint[] => {
  const all: ConnectorPoint[] = [];
  for (const inst of instances) {
    if (inst.type !== "connector-line" || inst.id === selfId) {
      continue;
    }
    const s = resolveConnectorEndpoint(inst.props.source, instances);
    const t = resolveConnectorEndpoint(inst.props.target, instances);
    if (!s || !t) {
      continue;
    }
    const routed = routeConnectorPath(s, t, inst.props.preferredConnection, bounds);
    all.push(...getConnectorCornerPoints(routed));
  }
  return all;
};

export const crossingsBetweenOrthoPolylines = (a: ConnectorPoint[], b: ConnectorPoint[]): ConnectorPoint[] => {
  const seen = new Set<string>();
  const out: ConnectorPoint[] = [];
  for (let i = 0; i < a.length - 1; i += 1) {
    const ax = a[i]!;
    const ay = a[i + 1]!;
    for (let j = 0; j < b.length - 1; j += 1) {
      const bx = b[j]!;
      const by = b[j + 1]!;
      const hit = orthogonalSegmentIntersection(ax, ay, bx, by);
      if (hit === null) {
        continue;
      }
      const k = connectorPointKey(hit);
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      out.push(hit);
    }
  }
  return out;
};

/**
 * Crossing of perpendicular axis-aligned segments. Returns null for parallel overlaps or skew (non‑orthogonal routes).
 */
export const orthogonalSegmentIntersection = (
  a: ConnectorPoint,
  b: ConnectorPoint,
  c: ConnectorPoint,
  d: ConnectorPoint,
): ConnectorPoint | null => {
  if (a.y === b.y && c.x === d.x) {
    return meetHorizontalVertical(a, b, c, d);
  }
  if (a.x === b.x && c.y === d.y) {
    return meetHorizontalVertical(c, d, a, b);
  }
  return null;
};

const meetHorizontalVertical = (
  h0: ConnectorPoint,
  h1: ConnectorPoint,
  v0: ConnectorPoint,
  v1: ConnectorPoint,
): ConnectorPoint | null => {
  const y = h0.y;
  const x = v0.x;
  const hx0 = Math.min(h0.x, h1.x);
  const hx1 = Math.max(h0.x, h1.x);
  const vy0 = Math.min(v0.y, v1.y);
  const vy1 = Math.max(v0.y, v1.y);
  if (x < hx0 || x > hx1 || y < vy0 || y > vy1) {
    return null;
  }
  return { x, y };
};

/** Other‑connector bend points plus perpendicular crossings (shared grid nodes across routes). */
export const collectExternalJunctionHints = (
  selfId: string,
  selfPoints: ConnectorPoint[],
  instances: ComponentInstance[],
  bounds?: ConnectorRouteBounds,
): ConnectorPoint[] => {
  const seen = new Set<string>();
  const out: ConnectorPoint[] = [];
  const pushUnique = (p: ConnectorPoint) => {
    const k = connectorPointKey(p);
    if (seen.has(k)) {
      return;
    }
    seen.add(k);
    out.push(p);
  };

  for (const c of collectOtherConnectorCornerPoints(selfId, instances, bounds)) {
    pushUnique(c);
  }

  for (const inst of instances) {
    if (inst.type !== "connector-line" || inst.id === selfId) {
      continue;
    }
    const s = resolveConnectorEndpoint(inst.props.source, instances);
    const t = resolveConnectorEndpoint(inst.props.target, instances);
    if (!s || !t) {
      continue;
    }
    const peer = routeConnectorPath(s, t, inst.props.preferredConnection, bounds);
    for (const px of crossingsBetweenOrthoPolylines(selfPoints, peer)) {
      pushUnique(px);
    }
  }

  return out;
};

/** Invalidates connector Pixi caches when any route topology changes (shared junction art). */
export const getConnectorRouteTopologySignature = (
  instances: ComponentInstance[],
  bounds?: ConnectorRouteBounds,
): string => {
  const parts: string[] = [];
  for (const inst of instances) {
    if (inst.type !== "connector-line") {
      continue;
    }
    const s = resolveConnectorEndpoint(inst.props.source, instances);
    const t = resolveConnectorEndpoint(inst.props.target, instances);
    if (!s || !t) {
      parts.push(`${inst.id}:`);
      continue;
    }
    const routed = routeConnectorPath(s, t, inst.props.preferredConnection, bounds);
    parts.push(`${inst.id}:${routed.map(connectorPointKey).join("|")}`);
  }
  parts.sort();
  return parts.join(";");
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

/**
 * 80×80 connector-lattice tiles overlapping `rect`, clipped first to `{0,width)×[0,height)`.
 */
export const getLatticeCellsIntersectingCanvasRect = (
  rect: { x: number; y: number; width: number; height: number },
  bounds: { width: number; height: number },
): ConnectorSegmentCell[] => {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(bounds.width, rect.x + rect.width);
  const y1 = Math.min(bounds.height, rect.y + rect.height);
  if (x1 <= x0 || y1 <= y0) {
    return [];
  }

  const ix0 = Math.floor(x0 / LARGE_CELL_SIZE);
  const iy0 = Math.floor(y0 / LARGE_CELL_SIZE);
  const ix1 = Math.floor((x1 - 1) / LARGE_CELL_SIZE);
  const iy1 = Math.floor((y1 - 1) / LARGE_CELL_SIZE);

  const cells: ConnectorSegmentCell[] = [];
  const seen = new Set<string>();

  for (let iy = iy0; iy <= iy1; iy += 1) {
    const cy = iy * LARGE_CELL_SIZE;
    for (let ix = ix0; ix <= ix1; ix += 1) {
      const cx = ix * LARGE_CELL_SIZE;

      const key = `${cx}:${cy}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      cells.push({
        x: cx,
        y: cy,
        width: LARGE_CELL_SIZE,
        height: LARGE_CELL_SIZE,
      });
    }
  }

  return cells;
};
