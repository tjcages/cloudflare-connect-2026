import { describe, expect, it } from "vitest";
import { CONNECTOR_HIGHLIGHT_COLOR } from "../constants";
import { getConnectorCornerCapRect, getConnectorJointPoints, getConnectorRenderSpec } from "./setup";
import type { ComponentInstance } from "../../../grid/types";

describe("connector line render spec", () => {
  it("places segment and endpoint frames in the structural plane below connector chrome", () => {
    expect(getConnectorRenderSpec(false, 0xf3f3f3).structuralDrawOrder).toEqual(["segmentFrames", "endpointFrames"]);
    expect(getConnectorRenderSpec(false, 0xf3f3f3).chromeTracksDrawOrder).toEqual([
      "lineUnderlay",
      "line",
      "routeMask",
    ]);
    expect(getConnectorRenderSpec(false, 0xf3f3f3).jointsChromeDrawOrder).toEqual(["cornerCaps"]);
    expect(getConnectorRenderSpec(false, 0xf3f3f3).chromePulseDrawOrder).toEqual(["connectorWave", "litCorners"]);
  });

  it("uses blue line and corner strokes when the connector is selected", () => {
    expect(getConnectorRenderSpec(true, 0xf3f3f3)).toMatchObject({
      lineColor: CONNECTOR_HIGHLIGHT_COLOR,
      cornerStrokeColor: CONNECTOR_HIGHLIGHT_COLOR,
      segmentFrameColor: 0xf3f3f3,
    });
  });

  it("centers corner caps on the connector route point", () => {
    const rect = getConnectorCornerCapRect({ x: 120, y: 120 });

    expect(rect).toEqual({
      x: 117,
      y: 117,
      size: 6,
      radius: 1,
    });
    expect(rect.x + rect.size / 2).toBe(120);
    expect(rect.y + rect.size / 2).toBe(120);
  });

  it("deduplicates shared joint points across connector lines", () => {
    const connectors: ComponentInstance[] = [
      {
        id: "connector-line-1",
        type: "connector-line",
        name: "Connector Line 1",
        x: 40,
        y: 40,
        props: {
          preferredConnection: "horizontal",
          source: { kind: "cell", x: 40, y: 40 },
          target: { kind: "cell", x: 120, y: 120 },
          overlayGrid: true,
          animated: true,
        },
      },
      {
        id: "connector-line-2",
        type: "connector-line",
        name: "Connector Line 2",
        x: 40,
        y: 120,
        props: {
          preferredConnection: "vertical",
          source: { kind: "cell", x: 40, y: 120 },
          target: { kind: "cell", x: 120, y: 40 },
          overlayGrid: true,
          animated: true,
        },
      },
    ];

    const jointPoints = getConnectorJointPoints(connectors, { width: 800, height: 560 });

    expect(jointPoints).toEqual([
      { x: 120, y: 40 },
      { x: 120, y: 120 },
      { x: 200, y: 40 },
      { x: 200, y: 120 },
    ]);
    expect(jointPoints.filter((point) => point.x === 120 && point.y === 120)).toHaveLength(1);
  });
});
