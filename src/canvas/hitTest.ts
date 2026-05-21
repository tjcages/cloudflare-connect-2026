import {
  getCodeSnippetHighlightStrokeCornerInCanvasSpace,
  getIconBoxHighlightStrokeCornerInCanvasSpace,
  getInstanceCanvasBounds,
} from "../lib/componentRegistry";
import { isCodeSnippetInstance } from "../lib/code-snippet/layout";
import { isIconBoxInstance, type IconBoxContainerReticleCorner } from "../lib/icon-box/layout";
import type { ComponentInstance } from "../grid/types";
import {
  resolveConnectorEndpoint,
  routeConnectorPath,
  type ConnectorRouteBounds,
} from "./components/connector-line/route";

const CONNECTOR_HIT_TOLERANCE = 6;

/** Half-width of square hit target around each resize handle center. */
export const ICON_BOX_RESIZE_HANDLE_HIT_SLOP = 5;

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

export const hitTestIconBoxResizeHandle = (
  instance: Extract<ComponentInstance, { type: "icon-box" }>,
  x: number,
  y: number,
): { corner: IconBoxContainerReticleCorner } | null => {
  const corners: IconBoxContainerReticleCorner[] = ["tl", "tr", "bl", "br"];
  for (const corner of corners) {
    const center = getIconBoxHighlightStrokeCornerInCanvasSpace(instance, corner);
    if (
      Math.abs(x - center.x) <= ICON_BOX_RESIZE_HANDLE_HIT_SLOP &&
      Math.abs(y - center.y) <= ICON_BOX_RESIZE_HANDLE_HIT_SLOP
    ) {
      return { corner };
    }
  }
  return null;
};

export const hitTestCodeSnippetResizeHandle = (
  instance: Extract<ComponentInstance, { type: "code-snippet" }>,
  x: number,
  y: number,
): { corner: IconBoxContainerReticleCorner } | null => {
  const corners: IconBoxContainerReticleCorner[] = ["tl", "tr", "bl", "br"];
  for (const corner of corners) {
    const center = getCodeSnippetHighlightStrokeCornerInCanvasSpace(instance, corner);
    if (
      Math.abs(x - center.x) <= ICON_BOX_RESIZE_HANDLE_HIT_SLOP &&
      Math.abs(y - center.y) <= ICON_BOX_RESIZE_HANDLE_HIT_SLOP
    ) {
      return { corner };
    }
  }
  return null;
};

export const hitTestSelectedResizeHandle = (
  selectedInstance: ComponentInstance | null | undefined,
  x: number,
  y: number,
): { corner: IconBoxContainerReticleCorner } | null => {
  if (!selectedInstance) {
    return null;
  }
  if (isIconBoxInstance(selectedInstance)) {
    return hitTestIconBoxResizeHandle(selectedInstance, x, y);
  }
  if (isCodeSnippetInstance(selectedInstance)) {
    return hitTestCodeSnippetResizeHandle(selectedInstance, x, y);
  }
  return null;
};

/** @deprecated Use hitTestSelectedResizeHandle */
export const hitTestSelectedIconBoxResizeHandle = hitTestSelectedResizeHandle;
