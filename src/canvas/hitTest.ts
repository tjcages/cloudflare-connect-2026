import { getInstanceCanvasBounds } from "../components/componentRegistry";
import type { ComponentInstance } from "../grid/types";
import {
  resolveConnectorEndpoint,
  routeConnectorPath,
  type ConnectorRouteBounds,
} from "./components/connector-line/route";

const CONNECTOR_HIT_TOLERANCE = 6;

const isPointNearConnectorPath = (
  instance: Extract<ComponentInstance, { type: "connector-line" }>,
  instances: ComponentInstance[],
  x: number,
  y: number,
  bounds?: ConnectorRouteBounds,
) => {
  const source = resolveConnectorEndpoint(instance.props.source, instances);
  const target = resolveConnectorEndpoint(instance.props.target, instances);
  if (!source || !target) {
    return false;
  }

  const points = routeConnectorPath(source, target, instance.props.preferredConnection, bounds);
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const minX = Math.min(a.x, b.x) - CONNECTOR_HIT_TOLERANCE;
    const maxX = Math.max(a.x, b.x) + CONNECTOR_HIT_TOLERANCE;
    const minY = Math.min(a.y, b.y) - CONNECTOR_HIT_TOLERANCE;
    const maxY = Math.max(a.y, b.y) + CONNECTOR_HIT_TOLERANCE;
    if (a.y === b.y && x >= minX && x <= maxX && Math.abs(y - a.y) <= CONNECTOR_HIT_TOLERANCE) {
      return true;
    }
    if (a.x === b.x && y >= minY && y <= maxY && Math.abs(x - a.x) <= CONNECTOR_HIT_TOLERANCE) {
      return true;
    }
  }

  return false;
};

export const hitTestComponentInstances = (
  instances: ComponentInstance[],
  x: number,
  y: number,
  bounds?: ConnectorRouteBounds,
) => {
  for (let index = 0; index < instances.length; index += 1) {
    const instance = instances[index];
    if (instance.type === "connector-line") {
      if (isPointNearConnectorPath(instance, instances, x, y, bounds)) {
        return instance;
      }
      continue;
    }

    const b = getInstanceCanvasBounds(instance);

    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
      return instance;
    }
  }

  return undefined;
};
