import type { ComponentInstance, ConnectorEndpoint } from "../../../grid/types";
import { paletteBrush } from "../../../theme/palette";

/** Signature for connector redraw when a bound layer’s theme (fill) changes. */
export const getConnectorEndpointThemeSignature = (
  endpoint: ConnectorEndpoint,
  instances: ComponentInstance[],
): string => {
  if (endpoint.kind === "cell") {
    return "cell";
  }
  const layer = instances.find((i) => i.id === endpoint.instanceId);
  if (
    layer?.type === "icon-box" ||
    layer?.type === "icon-box-2x1" ||
    layer?.type === "plus-marker" ||
    layer?.type === "rect-marker"
  ) {
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
    if (
      layer?.type === "icon-box" ||
      layer?.type === "icon-box-2x1" ||
      layer?.type === "plus-marker" ||
      layer?.type === "rect-marker"
    ) {
      return paletteBrush(layer.props.theme, { neutralFillSyncHex: gridStrokeHex }).fill;
    }
  }
  return paletteBrush("neutral", { neutralFillSyncHex: gridStrokeHex }).fill;
};
