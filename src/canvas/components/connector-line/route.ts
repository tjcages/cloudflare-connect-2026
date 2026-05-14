import { getInstanceAnchorPoint } from "../../../lib/componentRegistry";
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

const routeBothAxes = (
  source: ConnectorPoint,
  target: ConnectorPoint,
  preferredConnection: ConnectorConnectionPreference,
): ConnectorPoint[] => {
  const points = [source];
  let current = source;
  const primaryAxis = preferredConnection === "horizontal" ? "x" : "y";
  const secondaryAxis = primaryAxis === "x" ? "y" : "x";

  const primaryDelta = Math.abs(target[primaryAxis] - source[primaryAxis]);
  if (primaryDelta > LARGE_CELL_SIZE) {
    current = {
      ...current,
      [primaryAxis]: current[primaryAxis] + sign(target[primaryAxis] - current[primaryAxis]) * LARGE_CELL_SIZE,
    };
    pushPoint(points, current);
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

export const routeConnectorPath = (
  source: ConnectorPoint,
  target: ConnectorPoint,
  preferredConnection: ConnectorConnectionPreference,
  bounds?: ConnectorRouteBounds,
): ConnectorPoint[] => {
  if (source.x === target.x || source.y === target.y) {
    return routeStraightWithDogleg(source, target, preferredConnection, bounds);
  }

  return routeBothAxes(source, target, preferredConnection);
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
