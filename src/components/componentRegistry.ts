import { BASE_UNIT, type ComponentInstance, type ComponentType, type IconBoxProps } from "../grid/types";

export type ComponentDefinition = {
  type: ComponentType;
  label: string;
  width: number;
  height: number;
  defaultProps: IconBoxProps;
};

export const COMPONENT_REGISTRY: Record<ComponentType, ComponentDefinition> = {
  "icon-box": {
    type: "icon-box",
    label: "icon-box",
    width: 80,
    height: 80,
    defaultProps: {
      cornerColor: "#F3F3F3",
    },
  },
};

export const getComponentDefinition = (type: ComponentType) => COMPONENT_REGISTRY[type];

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
  const snappedX = Math.round(x / BASE_UNIT) * BASE_UNIT;
  const snappedY = Math.round(y / BASE_UNIT) * BASE_UNIT;

  return {
    x: Math.min(maxX, Math.max(0, snappedX)),
    y: Math.min(maxY, Math.max(0, snappedY)),
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
