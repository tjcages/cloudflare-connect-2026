import { describe, expect, it } from "vitest";
import type { ComponentInstance } from "../grid/types";
import { createComponentInstance } from "../lib/componentRegistry";
import {
  buildHoveredConnectorIds,
  collectConnectorLayerEndpointInstances,
  collectLinkedLayersForConnectors,
} from "./connectorLinkedLayerHighlights";

const defaultConnectorProps = {
  preferredConnection: "horizontal" as const,
  overlayGrid: true,
  animated: true,
  style: "solid" as const,
  staticEndLeg: "unset" as const,
};

describe("buildHoveredConnectorIds", () => {
  it("collects connector ids from canvas and sidebar hover when they reference connector-line layers", () => {
    const connector: ComponentInstance = {
      id: "c1",
      type: "connector-line",
      name: "C",
      x: 40,
      y: 40,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "cell", x: 40, y: 40 },
        target: { kind: "cell", x: 200, y: 40 },
        overlayGrid: true,
        animated: true,
        style: "solid",
        staticEndLeg: "unset",
      },
    };
    const box = createComponentInstance("icon-box", 40, 40, 1, 800, 560);
    const instances = [box, connector];
    expect(buildHoveredConnectorIds(instances, "c1", null)).toEqual(new Set(["c1"]));
    expect(buildHoveredConnectorIds(instances, null, "c1")).toEqual(new Set(["c1"]));
    expect(buildHoveredConnectorIds(instances, "c1", "c1")).toEqual(new Set(["c1"]));
    expect(buildHoveredConnectorIds(instances, box.id, null)).toEqual(new Set());
  });
});

describe("collectConnectorLayerEndpointInstances", () => {
  it("returns linked layers in source-then-target order without duplicates", () => {
    const a = createComponentInstance("icon-box", 40, 40, 1, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    const b = createComponentInstance("icon-box", 200, 200, 2, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    const connector: ComponentInstance = {
      id: "connector-line-1",
      type: "connector-line",
      name: "C",
      x: 40,
      y: 40,
      props: {
        ...defaultConnectorProps,
        source: { kind: "layer", instanceId: a.id },
        target: { kind: "layer", instanceId: b.id },
      },
    };
    expect(collectConnectorLayerEndpointInstances(connector, [a, b, connector])).toEqual([a, b]);
  });

  it("dedupes when source and target reference the same layer", () => {
    const a = createComponentInstance("icon-box", 40, 40, 1, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    const connector: ComponentInstance = {
      id: "connector-line-1",
      type: "connector-line",
      name: "C",
      x: 40,
      y: 40,
      props: {
        ...defaultConnectorProps,
        source: { kind: "layer", instanceId: a.id },
        target: { kind: "layer", instanceId: a.id },
      },
    };
    expect(collectConnectorLayerEndpointInstances(connector, [a, connector])).toEqual([a]);
  });

  it("returns empty when both endpoints are cells", () => {
    const connector: ComponentInstance = {
      id: "connector-line-1",
      type: "connector-line",
      name: "C",
      x: 40,
      y: 40,
      props: {
        ...defaultConnectorProps,
        source: { kind: "cell", x: 40, y: 40 },
        target: { kind: "cell", x: 200, y: 40 },
      },
    };
    expect(collectConnectorLayerEndpointInstances(connector, [connector])).toEqual([]);
  });

  it("skips missing instance ids", () => {
    const connector: ComponentInstance = {
      id: "connector-line-1",
      type: "connector-line",
      name: "C",
      x: 40,
      y: 40,
      props: {
        ...defaultConnectorProps,
        source: { kind: "layer", instanceId: "no-such-layer" },
        target: { kind: "layer", instanceId: "also-missing" },
      },
    };
    expect(collectConnectorLayerEndpointInstances(connector, [connector])).toEqual([]);
  });

  it("skips connector-line targets and still returns other linked layers", () => {
    const a = createComponentInstance("icon-box", 40, 40, 1, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    const nested: ComponentInstance = {
      id: "connector-line-inner",
      type: "connector-line",
      name: "Inner",
      x: 40,
      y: 40,
      props: {
        ...defaultConnectorProps,
        source: { kind: "cell", x: 40, y: 40 },
        target: { kind: "cell", x: 200, y: 40 },
      },
    };
    const connector: ComponentInstance = {
      id: "connector-line-1",
      type: "connector-line",
      name: "C",
      x: 40,
      y: 40,
      props: {
        ...defaultConnectorProps,
        source: { kind: "layer", instanceId: a.id },
        target: { kind: "layer", instanceId: nested.id },
      },
    };
    expect(collectConnectorLayerEndpointInstances(connector, [a, nested, connector])).toEqual([a]);
  });
});

describe("collectLinkedLayersForConnectors", () => {
  it("merges linked layers from multiple connectors in stable connector-id order", () => {
    const a = createComponentInstance("icon-box", 40, 40, 1, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    const b = createComponentInstance("icon-box", 200, 200, 2, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    const c = createComponentInstance("icon-box", 400, 200, 3, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    const cLow: ComponentInstance = {
      id: "connector-b",
      type: "connector-line",
      name: "B",
      x: 40,
      y: 40,
      props: {
        ...defaultConnectorProps,
        source: { kind: "layer", instanceId: b.id },
        target: { kind: "layer", instanceId: c.id },
      },
    };
    const cHigh: ComponentInstance = {
      id: "connector-a",
      type: "connector-line",
      name: "A",
      x: 40,
      y: 40,
      props: {
        ...defaultConnectorProps,
        source: { kind: "layer", instanceId: a.id },
        target: { kind: "layer", instanceId: b.id },
      },
    };
    const instances = [a, b, c, cLow, cHigh];
    const linked = collectLinkedLayersForConnectors(new Set(["connector-b", "connector-a"]), instances);
    expect(linked.map((i) => i.id)).toEqual([a.id, b.id, c.id]);
  });
});
