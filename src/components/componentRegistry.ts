import { ICON_BOX_INNER_CENTER_X, ICON_BOX_INNER_CENTER_Y, ICON_BOX_OUTER_HEIGHT } from "./iconBoxLayout";
import { BASE_UNIT, type ComponentInstance, type ComponentType, type IconBoxProps } from "../grid/types";
import { DEFAULT_ICON_ID } from "./iconRegistry";

export type ComponentDefinition = {
  type: ComponentType;
  label: string;
  width: number;
  height: number;
  /** Offset from instance root (x, y) to the logical snap point (e.g. inner card center for icon-box). */
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
    snapAnchorX: ICON_BOX_INNER_CENTER_X,
    snapAnchorY: ICON_BOX_INNER_CENTER_Y,
    defaultProps: {
      cornerTheme: "neutral",
      theme: "purple",
      iconId: DEFAULT_ICON_ID,
      title: "Workers",
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

/** Snap one axis so anchor (root + offset) lies on BASE_UNIT and root stays in [0, maxRoot]. */
const snapRootAxis = (root: number, anchorOffset: number, maxRoot: number): number => {
  const anchor = root + anchorOffset;
  const kIdeal = Math.round(anchor / BASE_UNIT);
  const kMin = Math.ceil(anchorOffset / BASE_UNIT);
  const kMax = Math.floor((maxRoot + anchorOffset) / BASE_UNIT);
  if (kMin > kMax) {
    return Math.min(maxRoot, Math.max(0, root));
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
    y: snapRootAxis(y, definition.snapAnchorY, maxY),
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
