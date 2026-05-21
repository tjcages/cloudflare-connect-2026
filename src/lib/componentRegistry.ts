import { getCodeSnippetMetrics, isCodeSnippetInstance } from "./code-snippet/layout";
import { getCodeSnippetHighlightCornerInCanvasSpace } from "./code-snippet/resize";
import {
  getIconBoxConnectorAnchorInRootSpace,
  getIconBoxFullHighlightBoundsInRootSpace,
  getIconBoxMetrics,
  ICON_BOX_OUTER_HEIGHT,
  ICON_BOX_SNAP_ANCHOR_X,
  ICON_BOX_SNAP_ANCHOR_Y,
  ICON_BOX_STROKE_ALIGN_NUDGE,
  isIconBoxInstance,
  resolveIconBoxLayout,
  type IconBoxContainerReticleCorner,
} from "./icon-box/layout";
import { DEFAULT_ICON_ID } from "./iconRegistry";
import {
  BASE_UNIT,
  LARGE_CELL_SIZE,
  type ComponentInstance,
  type CodeSnippetProps,
  type ComponentProps,
  type ComponentType,
  type ConnectorEndpoint,
  type ConnectorLineProps,
  type IconBoxProps,
  type PlusMarkerProps,
  type RectMarkerProps,
} from "../grid/types";

export type ComponentDefinition = {
  type: ComponentType;
  label: string;
  width: number;
  height: number;
  /** Offset from instance root (x, y) to the grid snap point. Icon-box uses prop-driven metrics at runtime. */
  snapAnchorX: number;
  snapAnchorY: number;
  defaultProps: ComponentProps;
  /** Layers list subtitle from current props; empty after trim → no second line. */
  dynamicTitle?: (config: ComponentProps) => string | undefined;
};

/** Added to rect-marker instance `x`/`y` when positioning the Pixi layer and for hit bounds (grid stroke alignment). */
export const RECT_MARKER_RENDER_OFFSET = 0.5;

export { getIconBoxMetrics } from "./icon-box/layout";

export const COMPONENT_REGISTRY: Record<ComponentType, ComponentDefinition> = {
  "icon-box": {
    type: "icon-box",
    label: "Icon Box",
    width: 80,
    height: ICON_BOX_OUTER_HEIGHT,
    snapAnchorX: ICON_BOX_SNAP_ANCHOR_X,
    snapAnchorY: ICON_BOX_SNAP_ANCHOR_Y,
    defaultProps: {
      length: 1,
      direction: "horizontal",
      matchCornersWithTheme: false,
      theme: "purple",
      iconId: DEFAULT_ICON_ID,
      title: "Workers",
      containerHighlighted: false,
      enabledByLine: "off",
    },
    dynamicTitle: (config) => {
      if (!("title" in config)) {
        return undefined;
      }
      const t = config.title.trim();
      return t.length ? t : undefined;
    },
  },
  "plus-marker": {
    type: "plus-marker",
    label: "Plus Marker",
    width: 40,
    height: 40,
    snapAnchorX: 0,
    snapAnchorY: 0,
    defaultProps: {
      theme: "orange",
    },
  },
  "rect-marker": {
    type: "rect-marker",
    label: "Rect Marker",
    width: 4,
    height: 4,
    snapAnchorX: 2,
    snapAnchorY: 2,
    defaultProps: {
      theme: "orange",
    },
  },
  "code-snippet": {
    type: "code-snippet",
    label: "Code Snippet",
    width: 320,
    height: 80,
    snapAnchorX: 0,
    snapAnchorY: 0,
    defaultProps: {
      code: 'import { DurableObject } from "cloudflare:workers";',
      language: "auto",
      theme: "orange",
      widthCells: 8,
      heightCells: 2,
    },
    dynamicTitle: (config) => {
      if (!("code" in config)) {
        return undefined;
      }
      const line = config.code.split("\n")[0]?.trim() ?? "";
      return line.length ? line : undefined;
    },
  },
  "connector-line": {
    type: "connector-line",
    label: "Connector Line",
    width: 0,
    height: 0,
    snapAnchorX: 0,
    snapAnchorY: 0,
    defaultProps: {
      preferredConnection: "horizontal",
      source: { kind: "cell", x: LARGE_CELL_SIZE / 2, y: LARGE_CELL_SIZE / 2 },
      target: { kind: "cell", x: LARGE_CELL_SIZE * 2 + LARGE_CELL_SIZE / 2, y: LARGE_CELL_SIZE / 2 },
      overlayGrid: true,
      animated: true,
      style: "solid",
      staticEndLeg: "unset",
    },
  },
};

export const getComponentDefinition = (type: ComponentType) => COMPONENT_REGISTRY[type];

const formatConnectorEndpointSubtitle = (endpoint: ConnectorEndpoint, instances: ComponentInstance[]): string => {
  if (endpoint.kind === "cell") {
    return `x: ${endpoint.x} y: ${endpoint.y}`;
  }

  const layer = instances.find((inst) => inst.id === endpoint.instanceId);
  if (!layer || layer.type === "connector-line") {
    return "Unknown layer";
  }

  const def = getComponentDefinition(layer.type);
  if (isIconBoxInstance(layer)) {
    const t = layer.props.title.trim();
    return t.length ? `${def.label} / ${t}` : def.label;
  }

  return def.label;
};

export const getInstanceLayerSubtitle = (
  instance: ComponentInstance,
  instances: ComponentInstance[] = [],
): string | undefined => {
  if (instance.type === "connector-line") {
    const left = formatConnectorEndpointSubtitle(instance.props.source, instances);
    const right = formatConnectorEndpointSubtitle(instance.props.target, instances);
    return `${left} → ${right}`;
  }

  const definition = getComponentDefinition(instance.type);
  if (!definition.dynamicTitle) {
    return undefined;
  }
  const raw = definition.dynamicTitle(instance.props);
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : undefined;
};

/** Snap one axis so anchor (root + anchorOffset) lies on the target lattice and root stays in [minRoot, maxRoot]. */
const snapRootAxis = (
  root: number,
  anchorOffset: number,
  maxRoot: number,
  minRoot = 0,
  step = BASE_UNIT,
  latticeOffset = 0,
): number => {
  const anchor = root + anchorOffset;
  const kIdeal = Math.round((anchor - latticeOffset) / step);
  const kMin = Math.ceil((minRoot + anchorOffset - latticeOffset) / step);
  const kMax = Math.floor((maxRoot + anchorOffset - latticeOffset) / step);
  if (kMin > kMax) {
    return Math.min(maxRoot, Math.max(minRoot, root));
  }
  const k = Math.min(kMax, Math.max(kMin, kIdeal));
  return latticeOffset + k * step - anchorOffset;
};

const CONNECTOR_LATTICE_OFFSET = LARGE_CELL_SIZE / 2;

const snapConnectorAxis = (value: number, canvasSize: number): number => {
  const min = CONNECTOR_LATTICE_OFFSET;
  const max = Math.max(min, canvasSize - CONNECTOR_LATTICE_OFFSET);
  const snapped =
    CONNECTOR_LATTICE_OFFSET + Math.round((value - CONNECTOR_LATTICE_OFFSET) / LARGE_CELL_SIZE) * LARGE_CELL_SIZE;
  return Math.min(max, Math.max(min, snapped));
};

export const snapConnectorCellCenter = (
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } => ({
  x: snapConnectorAxis(x, canvasWidth),
  y: snapConnectorAxis(y, canvasHeight),
});

export const snapComponentPosition = (
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  type: ComponentType,
  props?: ComponentProps,
) => {
  if (type === "connector-line") {
    return snapConnectorCellCenter(x, y, canvasWidth, canvasHeight);
  }

  if (type === "code-snippet") {
    const snippetProps = (props ?? getComponentDefinition("code-snippet").defaultProps) as CodeSnippetProps;
    const metrics = getCodeSnippetMetrics(snippetProps);
    const maxX = Math.max(0, canvasWidth - metrics.width);
    const maxY = Math.max(0, canvasHeight - metrics.height);
    return {
      x: snapRootAxis(x, metrics.snapAnchorX, maxX),
      y: snapRootAxis(y, metrics.snapAnchorY, maxY),
    };
  }

  if (type === "icon-box") {
    const iconProps = (props ?? getComponentDefinition("icon-box").defaultProps) as IconBoxProps;
    const metrics = getIconBoxMetrics(iconProps);
    const maxX = Math.max(0, canvasWidth - metrics.width);
    const maxY = Math.max(0, canvasHeight - (metrics.shadowCardBounds.y + metrics.shadowCardBounds.height));

    const snapIconBoxAxisX = (): number =>
      metrics.edgeSnapX
        ? snapRootAxis(x, metrics.snapAnchorX, maxX, 0, LARGE_CELL_SIZE, 0)
        : snapRootAxis(x, metrics.snapAnchorX, maxX, 0, LARGE_CELL_SIZE, CONNECTOR_LATTICE_OFFSET);

    const snapIconBoxAxisY = (): number =>
      metrics.edgeSnapY
        ? snapRootAxis(y, metrics.snapAnchorY, maxY, metrics.minRootY, LARGE_CELL_SIZE, 0)
        : snapRootAxis(y, metrics.snapAnchorY, maxY, metrics.minRootY, LARGE_CELL_SIZE, CONNECTOR_LATTICE_OFFSET);

    return { x: snapIconBoxAxisX(), y: snapIconBoxAxisY() };
  }

  const definition = getComponentDefinition(type);
  const maxX = Math.max(0, canvasWidth - definition.width);
  const maxY = Math.max(0, canvasHeight - definition.height);

  return {
    x: snapRootAxis(x, definition.snapAnchorX, maxX),
    y: snapRootAxis(y, definition.snapAnchorY, maxY),
  };
};

export const getInstanceAnchorPoint = (instance: ComponentInstance): { x: number; y: number } => {
  if (isIconBoxInstance(instance)) {
    const spec = resolveIconBoxLayout(instance.props);
    const anchor = getIconBoxConnectorAnchorInRootSpace(spec);
    return { x: instance.x + anchor.x, y: instance.y + anchor.y };
  }
  const definition = getComponentDefinition(instance.type);
  return {
    x: instance.x + definition.snapAnchorX,
    y: instance.y + definition.snapAnchorY,
  };
};

/**
 * Pointer hit bounds in logical canvas space.
 * Icon-box: shadowed inner card plus `ICON_BOX_SELECTION_PADDING` (icon-box layout); excludes title strip (see hitTest tests).
 */
export const getInstanceCanvasBounds = (
  instance: ComponentInstance,
): { x: number; y: number; width: number; height: number } => {
  const definition = getComponentDefinition(instance.type);
  if (isCodeSnippetInstance(instance)) {
    const metrics = getCodeSnippetMetrics(instance.props);
    return {
      x: instance.x,
      y: instance.y,
      width: metrics.width,
      height: metrics.height,
    };
  }
  if (isIconBoxInstance(instance)) {
    const { shadowCardBounds: r } = getIconBoxMetrics(instance.props);
    return {
      x: instance.x + r.x,
      y: instance.y + r.y,
      width: r.width,
      height: r.height,
    };
  }
  if (instance.type === "connector-line") {
    const { source, target } = instance.props;
    if (source.kind === "cell" && target.kind === "cell") {
      const minX = Math.min(source.x, target.x);
      const minY = Math.min(source.y, target.y);
      return {
        x: minX - LARGE_CELL_SIZE / 2,
        y: minY - LARGE_CELL_SIZE / 2,
        width: Math.abs(target.x - source.x) + LARGE_CELL_SIZE,
        height: Math.abs(target.y - source.y) + LARGE_CELL_SIZE,
      };
    }
  }
  if (instance.type === "rect-marker") {
    const o = RECT_MARKER_RENDER_OFFSET;
    return {
      x: instance.x + o,
      y: instance.y + o,
      width: definition.width,
      height: definition.height,
    };
  }
  return {
    x: instance.x,
    y: instance.y,
    width: definition.width,
    height: definition.height,
  };
};

/** Selection outline bounds; icon-box wraps title bar + chrome through accent bar (excludes glow/filter pad below accent). */
export const getInstanceHighlightBounds = (
  instance: ComponentInstance,
): { x: number; y: number; width: number; height: number } => {
  if (isIconBoxInstance(instance)) {
    const spec = resolveIconBoxLayout(instance.props);
    const r = getIconBoxFullHighlightBoundsInRootSpace(instance.props.title, spec);
    return {
      x: instance.x + r.x,
      y: instance.y + r.y,
      width: r.width,
      height: r.height,
    };
  }
  return getInstanceCanvasBounds(instance);
};

export const getCodeSnippetHighlightStrokeCornerInCanvasSpace = (
  instance: Extract<ComponentInstance, { type: "code-snippet" }>,
  corner: IconBoxContainerReticleCorner,
): { x: number; y: number } => {
  const metrics = getCodeSnippetMetrics(instance.props);
  return getCodeSnippetHighlightCornerInCanvasSpace(
    { x: instance.x, y: instance.y },
    metrics.width,
    metrics.height,
    corner,
  );
};

/** Center point of the selection stroke at each highlight corner (matches selection-setup +0.5 nudge). */
export const getIconBoxHighlightStrokeCornerInCanvasSpace = (
  instance: Extract<ComponentInstance, { type: "icon-box" }>,
  corner: IconBoxContainerReticleCorner,
): { x: number; y: number } => {
  const b = getInstanceHighlightBounds(instance);
  const n = ICON_BOX_STROKE_ALIGN_NUDGE;
  switch (corner) {
    case "tl":
      return { x: b.x + n, y: b.y + n };
    case "tr":
      return { x: b.x + b.width + n, y: b.y + n };
    case "bl":
      return { x: b.x + n, y: b.y + b.height + n };
    case "br":
      return { x: b.x + b.width + n, y: b.y + b.height + n };
  }
};

export const createComponentInstance = (
  type: ComponentType,
  x: number,
  y: number,
  index: number,
  canvasWidth = Number.POSITIVE_INFINITY,
  canvasHeight = Number.POSITIVE_INFINITY,
): ComponentInstance => {
  const definition = getComponentDefinition(type);
  const defaultProps = definition.defaultProps;

  if (type === "connector-line") {
    const source = snapConnectorCellCenter(x, y, canvasWidth, canvasHeight);
    let target = snapConnectorCellCenter(source.x + LARGE_CELL_SIZE * 2, source.y, canvasWidth, canvasHeight);
    if (target.x === source.x && target.y === source.y) {
      target = snapConnectorCellCenter(source.x - LARGE_CELL_SIZE * 2, source.y, canvasWidth, canvasHeight);
    }
    const props: ConnectorLineProps = {
      ...(defaultProps as ConnectorLineProps),
      source: { kind: "cell", ...source },
      target: { kind: "cell", ...target },
    };

    return {
      id: `${type}-${index}`,
      type,
      name: `${definition.label} ${index}`,
      x: source.x,
      y: source.y,
      props,
    };
  }

  const position = snapComponentPosition(x, y, canvasWidth, canvasHeight, type, defaultProps);

  if (type === "icon-box") {
    return {
      id: `${type}-${index}`,
      type,
      name: `${definition.label} ${index}`,
      x: position.x,
      y: position.y,
      props: { ...(defaultProps as IconBoxProps) },
    };
  }

  if (type === "rect-marker") {
    return {
      id: `${type}-${index}`,
      type,
      name: `${definition.label} ${index}`,
      x: position.x,
      y: position.y,
      props: { ...(defaultProps as RectMarkerProps) },
    };
  }

  if (type === "code-snippet") {
    return {
      id: `${type}-${index}`,
      type,
      name: `${definition.label} ${index}`,
      x: position.x,
      y: position.y,
      props: { ...(defaultProps as CodeSnippetProps) },
    };
  }

  return {
    id: `${type}-${index}`,
    type,
    name: `${definition.label} ${index}`,
    x: position.x,
    y: position.y,
    props: { ...(defaultProps as PlusMarkerProps) },
  };
};
