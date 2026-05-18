import type { ComponentInstance, ConnectorLineInstance } from "../grid/types";

/** Layer instances referenced by `kind: "layer"` endpoints (deduped, stable source-then-target order). */
export const collectConnectorLayerEndpointInstances = (
  connector: ConnectorLineInstance,
  instances: ComponentInstance[],
): ComponentInstance[] => {
  const seen = new Set<string>();
  const out: ComponentInstance[] = [];
  for (const end of [connector.props.source, connector.props.target]) {
    if (end.kind !== "layer") {
      continue;
    }
    const id = end.instanceId;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    const inst = instances.find((i) => i.id === id);
    if (!inst || inst.type === "connector-line") {
      continue;
    }
    out.push(inst);
  }
  return out;
};

export const buildHoveredConnectorIds = (
  instances: ComponentInstance[],
  canvasHoveredLayerId: string | null,
  sidebarHoveredLayerId: string | null,
): Set<string> => {
  const hoveredConnectorIds = new Set<string>();
  for (const id of [canvasHoveredLayerId, sidebarHoveredLayerId]) {
    if (!id) {
      continue;
    }
    if (instances.find((i) => i.id === id)?.type === "connector-line") {
      hoveredConnectorIds.add(id);
    }
  }
  return hoveredConnectorIds;
};

/** Linked layers for any of the given connector ids (deduped across connectors, deterministic by connector id sort). */
export const collectLinkedLayersForConnectors = (
  connectorIds: ReadonlySet<string>,
  instances: ComponentInstance[],
): ComponentInstance[] => {
  const seenLayer = new Set<string>();
  const out: ComponentInstance[] = [];
  for (const cid of [...connectorIds].sort()) {
    const c = instances.find((i) => i.id === cid);
    if (!c || c.type !== "connector-line") {
      continue;
    }
    for (const layer of collectConnectorLayerEndpointInstances(c, instances)) {
      if (seenLayer.has(layer.id)) {
        continue;
      }
      seenLayer.add(layer.id);
      out.push(layer);
    }
  }
  return out;
};
