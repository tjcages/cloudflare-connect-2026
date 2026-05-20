import {
  ICON_BOX_1X2_MIN_ROOT_Y,
  ICON_BOX_1X2_OUTER_HEIGHT,
  ICON_BOX_1X2_SNAP_ANCHOR_Y,
  ICON_BOX_2X1_SNAP_ANCHOR_X,
  ICON_BOX_MIN_ROOT_Y,
  ICON_BOX_OUTER_HEIGHT,
  ICON_BOX_SNAP_ANCHOR_X,
  ICON_BOX_SNAP_ANCHOR_Y,
  getIconBoxConnectorAnchorInRootSpace,
  getIconBoxFullHighlightBoundsInRootSpace,
  getIconBoxLayoutVariant,
  getIconBoxShadowCardBoundsInRootSpace,
  isIconBoxComponentType,
  isIconBoxInstance,
} from "./icon-box/layout";
import { DEFAULT_ICON_ID } from "./iconRegistry";
import {
  BASE_UNIT,
  LARGE_CELL_SIZE,
  type ComponentInstance,
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
  /** Offset from instance root (x, y) to the grid snap point (icon-box: shadow-card center; icon-box-2x1: west edge; icon-box-1x2: north edge). */
  snapAnchorX: number;
  snapAnchorY: number;
  defaultProps: ComponentProps;
  /** Layers list subtitle from current props; empty after trim → no second line. */
  dynamicTitle?: (config: ComponentProps) => string | undefined;
};

/** Added to rect-marker instance `x`/`y` when positioning the Pixi layer and for hit bounds (grid stroke alignment). */
export const RECT_MARKER_RENDER_OFFSET = 0.5;

export const COMPONENT_REGISTRY: Record<ComponentType, ComponentDefinition> = {
  "icon-box": {
    type: "icon-box",
    label: "Icon Box",
    width: 80,
    height: ICON_BOX_OUTER_HEIGHT,
    snapAnchorX: ICON_BOX_SNAP_ANCHOR_X,
    snapAnchorY: ICON_BOX_SNAP_ANCHOR_Y,
    defaultProps: {
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
  "icon-box-2x1": {
    type: "icon-box-2x1",
    label: "Icon Box 2x1",
    width: 160,
    height: ICON_BOX_OUTER_HEIGHT,
    snapAnchorX: ICON_BOX_2X1_SNAP_ANCHOR_X,
    snapAnchorY: ICON_BOX_SNAP_ANCHOR_Y,
    defaultProps: {
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
  "icon-box-1x2": {
    type: "icon-box-1x2",
    label: "Icon Box 1x2",
    width: 80,
    height: ICON_BOX_1X2_OUTER_HEIGHT,
    snapAnchorX: ICON_BOX_SNAP_ANCHOR_X,
    snapAnchorY: ICON_BOX_1X2_SNAP_ANCHOR_Y,
    defaultProps: {
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
) => {
  if (type === "connector-line") {
    return snapConnectorCellCenter(x, y, canvasWidth, canvasHeight);
  }

  const definition = getComponentDefinition(type);
  const variant = getIconBoxLayoutVariant(type);
  const iconBoxBounds = variant !== null ? getIconBoxShadowCardBoundsInRootSpace(variant) : null;
  const maxX = Math.max(0, canvasWidth - definition.width);
  const maxY = Math.max(0, canvasHeight - (iconBoxBounds ? iconBoxBounds.y + iconBoxBounds.height : definition.height));

  const snapIconBoxAxisX = (): number =>
    variant === "icon-box-2x1"
      ? snapRootAxis(x, definition.snapAnchorX, maxX, 0, LARGE_CELL_SIZE, 0)
      : snapRootAxis(x, definition.snapAnchorX, maxX, 0, LARGE_CELL_SIZE, CONNECTOR_LATTICE_OFFSET);

  const snapIconBoxAxisY = (): number =>
    variant === "icon-box-1x2"
      ? snapRootAxis(y, definition.snapAnchorY, maxY, ICON_BOX_1X2_MIN_ROOT_Y, LARGE_CELL_SIZE, 0)
      : snapRootAxis(y, definition.snapAnchorY, maxY, ICON_BOX_MIN_ROOT_Y, LARGE_CELL_SIZE, CONNECTOR_LATTICE_OFFSET);

  return {
    x: variant !== null ? snapIconBoxAxisX() : snapRootAxis(x, definition.snapAnchorX, maxX),
    y: variant !== null ? snapIconBoxAxisY() : snapRootAxis(y, definition.snapAnchorY, maxY),
  };
};

export const getInstanceAnchorPoint = (instance: ComponentInstance): { x: number; y: number } => {
  if (isIconBoxComponentType(instance.type)) {
    const anchor = getIconBoxConnectorAnchorInRootSpace(instance.type);
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
  if (isIconBoxComponentType(instance.type)) {
    const r = getIconBoxShadowCardBoundsInRootSpace(instance.type);
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
    const r = getIconBoxFullHighlightBoundsInRootSpace(instance.props.title, instance.type);
    return {
      x: instance.x + r.x,
      y: instance.y + r.y,
      width: r.width,
      height: r.height,
    };
  }
  return getInstanceCanvasBounds(instance);
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
  const position = snapComponentPosition(x, y, canvasWidth, canvasHeight, type);

  if (type === "connector-line") {
    const source = snapConnectorCellCenter(x, y, canvasWidth, canvasHeight);
    let target = snapConnectorCellCenter(source.x + LARGE_CELL_SIZE * 2, source.y, canvasWidth, canvasHeight);
    if (target.x === source.x && target.y === source.y) {
      target = snapConnectorCellCenter(source.x - LARGE_CELL_SIZE * 2, source.y, canvasWidth, canvasHeight);
    }
    const props: ConnectorLineProps = {
      ...(definition.defaultProps as ConnectorLineProps),
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

  if (isIconBoxComponentType(type)) {
    return {
      id: `${type}-${index}`,
      type,
      name: `${definition.label} ${index}`,
      x: position.x,
      y: position.y,
      props: { ...(definition.defaultProps as IconBoxProps) },
    };
  }

  if (type === "rect-marker") {
    return {
      id: `${type}-${index}`,
      type,
      name: `${definition.label} ${index}`,
      x: position.x,
      y: position.y,
      props: { ...(definition.defaultProps as RectMarkerProps) },
    };
  }

  return {
    id: `${type}-${index}`,
    type,
    name: `${definition.label} ${index}`,
    x: position.x,
    y: position.y,
    props: { ...(definition.defaultProps as PlusMarkerProps) },
  };
};
