import type { ComponentInstance, ConnectorEndpoint } from "../../../grid/types";
import { isIconBoxInstance } from "../../../lib/icon-box/layout";
import { paletteBrush } from "../../../theme/palette";

const isThemedConnectorLayer = (
  layer: ComponentInstance | undefined,
): layer is Extract<ComponentInstance, { type: "icon-box" | "plus-marker" | "rect-marker" }> =>
  layer !== undefined && (isIconBoxInstance(layer) || layer.type === "plus-marker" || layer.type === "rect-marker");

/** Signature for connector redraw when a bound layer’s theme (fill) changes. */
export const getConnectorEndpointThemeSignature = (
  endpoint: ConnectorEndpoint,
  instances: ComponentInstance[],
): string => {
  if (endpoint.kind === "cell") {
    return "cell";
  }
  const layer = instances.find((i) => i.id === endpoint.instanceId);
  if (isThemedConnectorLayer(layer)) {
    return `${layer.id}:${layer.props.theme}`;
  }
  return "unknown";
};

/** Theme **fill** (`paletteBrush().fill`) for icon-box / themed markers; else neutral synced to grid stroke. */
export const resolveConnectorEndpointThemeFill = (
  endpoint: ConnectorEndpoint,
  instances: ComponentInstance[],
  gridStrokeHex: string,
): number => {
  if (endpoint.kind === "layer") {
    const layer = instances.find((i) => i.id === endpoint.instanceId);
    if (isThemedConnectorLayer(layer)) {
      return paletteBrush(layer.props.theme, { neutralFillSyncHex: gridStrokeHex }).fill;
    }
  }
  return paletteBrush("neutral", { neutralFillSyncHex: gridStrokeHex }).fill;
};
