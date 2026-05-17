import { ComponentIcon } from "./ComponentIcon";
import { ComponentListItem } from "./ComponentListItem";
import { PlusMarkerGlyph } from "./PlusMarkerGlyph";
import { RectMarkerGlyph } from "./RectMarkerGlyph";
import type { ComponentType, IconBoxProps, PlusMarkerProps, RectMarkerProps } from "../grid/types";
import { getComponentDefinition } from "../lib/componentRegistry";
import { SIDEBAR_LIST_ICON_PX } from "./iconTokens";
import { paletteBrush } from "../theme/palette";
import { cn } from "../lib/cn";

type ComponentDragGhostProps = {
  componentType: ComponentType;
  clientX: number;
  clientY: number;
};

export const ComponentDragGhost = ({ componentType, clientX, clientY }: ComponentDragGhostProps) => {
  const definition = getComponentDefinition(componentType);
  const preview =
    componentType === "connector-line" ? (
      <svg
        className="block"
        width={SIDEBAR_LIST_ICON_PX}
        height={SIDEBAR_LIST_ICON_PX}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
      >
        <path d="M5 7h6v6h8" />
        <path d="M5 7h0.01" />
        <path d="M19 13h0.01" />
      </svg>
    ) : componentType === "plus-marker" ? (
      <PlusMarkerGlyph theme={(definition.defaultProps as PlusMarkerProps).theme} />
    ) : componentType === "rect-marker" ? (
      <RectMarkerGlyph theme={(definition.defaultProps as RectMarkerProps).theme} size={SIDEBAR_LIST_ICON_PX} />
    ) : (
      <ComponentIcon
        iconId={(definition.defaultProps as IconBoxProps).iconId}
        color={paletteBrush((definition.defaultProps as IconBoxProps).theme).iconFillHex}
        size={SIDEBAR_LIST_ICON_PX}
      />
    );

  return (
    <div
      data-testid="component-drag-ghost"
      className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-1/2"
      style={{ left: clientX, top: clientY }}
    >
      <ComponentListItem
        className={cn(
          "w-[260px] rounded-md border border-builder-hairline bg-builder-surface",
          "shadow-[0_0_0_1px_#f3f3f3,0_8px_20px_rgb(0_0_0/0.08)]",
        )}
        preview={preview}
        title={definition.label}
      />
    </div>
  );
};
