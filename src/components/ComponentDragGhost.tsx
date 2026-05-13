import { ComponentIcon } from "./ComponentIcon";
import { getComponentDefinition } from "./componentRegistry";
import { ComponentListItem } from "./ComponentListItem";
import { paletteBrush } from "../theme/palette";
import type { ComponentType, IconBoxProps } from "../grid/types";

type ComponentDragGhostProps = {
  componentType: ComponentType;
  clientX: number;
  clientY: number;
};

export const ComponentDragGhost = ({ componentType, clientX, clientY }: ComponentDragGhostProps) => {
  const definition = getComponentDefinition(componentType);
  const iconBoxProps = definition.defaultProps as IconBoxProps;
  const preview =
    componentType === "connector-line" ? (
      <svg
        className="component-icon"
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5 7h6v6h8" />
        <path d="M5 7h0.01" />
        <path d="M19 13h0.01" />
      </svg>
    ) : (
      <ComponentIcon iconId={iconBoxProps.iconId} color={paletteBrush(iconBoxProps.theme).iconFillHex} size={16} />
    );

  return (
    <div
      role="presentation"
      aria-hidden
      data-testid="component-drag-ghost"
      className="component-drag-ghost-root"
      style={{ left: clientX, top: clientY }}
    >
      <ComponentListItem className="component-drag-ghost-row" preview={preview} title={definition.label} />
    </div>
  );
};
