import {
  ICON_BOX_MIN_ROOT_Y,
  ICON_BOX_OUTER_HEIGHT,
  ICON_BOX_SNAP_ANCHOR_X,
  ICON_BOX_SNAP_ANCHOR_Y,
  getIconBoxShadowCardBoundsInRootSpace,
} from "./iconBoxLayout";
import { BASE_UNIT, type ComponentInstance, type ComponentType, type IconBoxProps } from "../grid/types";
import { DEFAULT_ICON_ID } from "./iconRegistry";

export type ComponentDefinition = {
  type: ComponentType;
  label: string;
  width: number;
  height: number;
  /** Offset from instance root (x, y) to the grid snap point (icon-box: center of shadow-card ± selection padding). */
  snapAnchorX: number;
  snapAnchorY: number;
  defaultProps: IconBoxProps;
  /** Layers list subtitle from current props; empty after trim → no second line. */
  dynamicTitle?: (config: IconBoxProps) => string | undefined;
};

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
    },
    dynamicTitle: (config) => {
      const t = config.title.trim();
      return t.length ? t : undefined;
    },
  },
};

export const getComponentDefinition = (type: ComponentType) => COMPONENT_REGISTRY[type];

export const getInstanceLayerSubtitle = (instance: ComponentInstance): string | undefined => {
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

/** Snap one axis so anchor (root + anchorOffset) lies on BASE_UNIT and root stays in [minRoot, maxRoot]. */
const snapRootAxis = (root: number, anchorOffset: number, maxRoot: number, minRoot = 0): number => {
  const anchor = root + anchorOffset;
  const kIdeal = Math.round(anchor / BASE_UNIT);
  const kMin = Math.ceil((minRoot + anchorOffset) / BASE_UNIT);
  const kMax = Math.floor((maxRoot + anchorOffset) / BASE_UNIT);
  if (kMin > kMax) {
    return Math.min(maxRoot, Math.max(minRoot, root));
  }
  const k = Math.min(kMax, Math.max(kMin, kIdeal));
  return k * BASE_UNIT - anchorOffset;
};

export const snapComponentPosition = (
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  type: ComponentType,
) => {
  const definition = getComponentDefinition(type);
  const maxX = Math.max(0, canvasWidth - definition.width);
  const maxY = Math.max(0, canvasHeight - definition.height);

  return {
    x: snapRootAxis(x, definition.snapAnchorX, maxX),
    y:
      type === "icon-box"
        ? snapRootAxis(y, definition.snapAnchorY, maxY, ICON_BOX_MIN_ROOT_Y)
        : snapRootAxis(y, definition.snapAnchorY, maxY),
  };
};

/**
 * Pointer and selection bounds in logical canvas space.
 * Icon-box: shadowed inner card plus `ICON_BOX_SELECTION_PADDING` (iconBoxLayout); excludes title and bottom accent.
 */
export const getInstanceCanvasBounds = (
  instance: ComponentInstance,
): { x: number; y: number; width: number; height: number } => {
  const definition = getComponentDefinition(instance.type);
  if (instance.type === "icon-box") {
    const r = getIconBoxShadowCardBoundsInRootSpace();
    return {
      x: instance.x + r.x,
      y: instance.y + r.y,
      width: r.width,
      height: r.height,
    };
  }
  return {
    x: instance.x,
    y: instance.y,
    width: definition.width,
    height: definition.height,
  };
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

  return {
    id: `${type}-${index}`,
    type,
    name: `${definition.label} ${index}`,
    x: position.x,
    y: position.y,
    props: {
      ...definition.defaultProps,
    },
  };
};
