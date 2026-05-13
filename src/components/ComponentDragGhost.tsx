import { ComponentIcon } from "./ComponentIcon";
import { getComponentDefinition } from "./componentRegistry";
import { ComponentListItem } from "./ComponentListItem";
import { paletteBrush } from "../theme/palette";
import type { ComponentType } from "../grid/types";

type ComponentDragGhostProps = {
  componentType: ComponentType;
  clientX: number;
  clientY: number;
};

export const ComponentDragGhost = ({ componentType, clientX, clientY }: ComponentDragGhostProps) => {
  const definition = getComponentDefinition(componentType);
  const preview = (
    <ComponentIcon
      iconId={definition.defaultProps.iconId}
      color={paletteBrush(definition.defaultProps.theme).iconFillHex}
      size={16}
    />
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
