import { describe, expect, it } from "vitest";
import type { ComponentInstance } from "../grid/types";
import type { ConnectorEndpointPickState } from "../types/document";
import { getConnectorSelectionCellPoints } from "./selection-setup";

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
  },
};

describe("connector selection cell highlights", () => {
  it("does not draw selected connector endpoints in the global selection layer", () => {
    expect(getConnectorSelectionCellPoints(connector.id, [connector], null)).toEqual([]);
  });

  it("includes the static endpoint hover cell while picking", () => {
    const pick: ConnectorEndpointPickState = {
      connectorId: connector.id,
      endpoint: "target",
      hoverCell: { x: 280, y: 120 },
    };

    expect(getConnectorSelectionCellPoints(null, [connector], pick)).toEqual([{ x: 280, y: 120 }]);
  });
});
