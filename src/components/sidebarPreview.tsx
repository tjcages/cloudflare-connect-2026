import type { ReactNode } from "react";
import type { ComponentInstance, IconBoxProps, PlusMarkerProps, RectMarkerProps } from "../grid/types";
import { COMPONENT_REGISTRY, type ComponentDefinition } from "../lib/componentRegistry";
import { paletteBrush, type PaletteBrush, type PaletteThemeId } from "../theme/palette";
import { ComponentIcon } from "./ComponentIcon";
import { PlusMarkerGlyph } from "./PlusMarkerGlyph";
import { RectMarkerGlyph } from "./RectMarkerGlyph";
import { SIDEBAR_LIST_ICON_PX } from "./iconTokens";

export const CONNECTOR_LINE_ICON_HEX = paletteBrush("neutral").iconFillHex;

export const ConnectorLineIcon = ({ size = SIDEBAR_LIST_ICON_PX }: { size?: number }) => (
  <svg
    className="component-icon"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.7}
    style={{ color: CONNECTOR_LINE_ICON_HEX }}
  >
    <path d="M5 9h6v6h8" />
    <path d="M5 9h0.01" />
    <path d="M19 15h0.01" />
  </svg>
);

export type SidebarPreviewRenderers = {
  renderIcon: (props: IconBoxProps) => ReactNode;
  renderPreview: (instance: ComponentInstance) => ReactNode;
  renderDefinitionPreview: (definition: ComponentDefinition) => ReactNode;
  brushFor: (theme: PaletteThemeId) => PaletteBrush;
};

export const createSidebarPreviewRenderers = (gridStrokeColor: string | undefined): SidebarPreviewRenderers => {
  const neutralOpts = gridStrokeColor !== undefined ? { neutralFillSyncHex: gridStrokeColor } : undefined;
  const brushFor = (theme: PaletteThemeId) => paletteBrush(theme, neutralOpts);

  const renderIcon = (props: IconBoxProps) => (
    <ComponentIcon iconId={props.iconId} color={brushFor(props.theme).iconFillHex} size={SIDEBAR_LIST_ICON_PX} />
  );

  const renderPreview = (instance: ComponentInstance) =>
    instance.type === "connector-line" ? (
      <ConnectorLineIcon />
    ) : instance.type === "plus-marker" ? (
      <PlusMarkerGlyph theme={instance.props.theme} gridStrokeColor={gridStrokeColor} />
    ) : instance.type === "rect-marker" ? (
      <RectMarkerGlyph theme={instance.props.theme} gridStrokeColor={gridStrokeColor} />
    ) : (
      renderIcon(instance.props)
    );

  const renderDefinitionPreview = (definition: ComponentDefinition) =>
    definition.type === "connector-line" ? (
      <ConnectorLineIcon />
    ) : definition.type === "plus-marker" ? (
      <PlusMarkerGlyph theme={(definition.defaultProps as PlusMarkerProps).theme} gridStrokeColor={gridStrokeColor} />
    ) : definition.type === "rect-marker" ? (
      <RectMarkerGlyph theme={(definition.defaultProps as RectMarkerProps).theme} gridStrokeColor={gridStrokeColor} />
    ) : (
      renderIcon(definition.defaultProps as IconBoxProps)
    );

  return { renderIcon, renderPreview, renderDefinitionPreview, brushFor };
};

export const COMPONENT_DEFINITION_LIST = Object.values(COMPONENT_REGISTRY);
