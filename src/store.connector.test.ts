import { describe, expect, it } from "vitest";
import type { ComponentInstance } from "./grid/types";
import { resetAppStoreDocumentToDefault, useAppStore } from "./store";

const connector: ComponentInstance = {
  id: "connector-line-1",
  type: "connector-line",
  name: "Connector Line 1",
  x: 40,
  y: 40,
  props: {
    preferredConnection: "horizontal",
    source: { kind: "cell", x: 40, y: 40 },
    target: { kind: "cell", x: 200, y: 40 },
    overlayGrid: true,
  },
};

describe("connector endpoint picking", () => {
  it("sets a picked static endpoint and clears pick mode", () => {
    resetAppStoreDocumentToDefault();
    useAppStore.setState({ instances: [connector] });

    useAppStore.getState().startConnectorEndpointPick("connector-line-1", "target");
    expect(useAppStore.getState().connectorEndpointPick).toEqual({
      connectorId: "connector-line-1",
      endpoint: "target",
      hoverCell: null,
    });

    useAppStore.getState().setConnectorEndpointHoverCell(278, 123);
    expect(useAppStore.getState().connectorEndpointPick?.hoverCell).toEqual({ x: 280, y: 120 });

    useAppStore.getState().setConnectorEndpointCell(278, 123);

    const updated = useAppStore.getState().instances[0];
    expect(updated.props).toMatchObject({
      target: { kind: "cell", x: 280, y: 120 },
    });
    expect(useAppStore.getState().connectorEndpointPick).toBeNull();
  });

  it("cancels endpoint picking without changing the connector", () => {
    resetAppStoreDocumentToDefault();
    useAppStore.setState({ instances: [connector] });

    useAppStore.getState().startConnectorEndpointPick("connector-line-1", "source");
    useAppStore.getState().setConnectorEndpointHoverCell(120, 120);
    useAppStore.getState().cancelConnectorEndpointPick();

    expect(useAppStore.getState().instances[0]).toEqual(connector);
    expect(useAppStore.getState().connectorEndpointPick).toBeNull();
  });
});

describe("connector layer order", () => {
  it("appends new connector lines behind other layers", () => {
    resetAppStoreDocumentToDefault();
    useAppStore.setState({ instances: [], nextInstanceIndex: 1 });

    useAppStore.getState().finalizeCreateAt("icon-box", 40, 40);
    useAppStore.getState().finalizeCreateAt("connector-line", 120, 40);
    useAppStore.getState().finalizeCreateAt("icon-box", 200, 40);

    expect(useAppStore.getState().instances.map((instance) => instance.id)).toEqual([
      "icon-box-3",
      "icon-box-1",
      "connector-line-2",
    ]);
  });
});
