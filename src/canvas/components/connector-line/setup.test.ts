import { describe, expect, it } from "vitest";
import { COMPONENT_REGISTRY } from "../../../lib/componentRegistry";
import type { ComponentInstance, IconBoxProps } from "../../../grid/types";
import { parseHexColor } from "../../color";
import { CONNECTOR_HIGHLIGHT_COLOR } from "../constants";
import {
  getConnectorBaseLayerFingerprint,
  getConnectorCornerCapRect,
  getConnectorJointPoints,
  getConnectorRenderSpec,
  resolveSharedJointStrokeColor,
} from "./setup";

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

  it("uses a base-layer fingerprint stable under instance list reorder", () => {
    const bounds = { width: 800, height: 560 };
    const a: ComponentInstance = {
      id: "c-a",
      type: "connector-line",
      name: "A",
      x: 0,
      y: 0,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "cell", x: 40, y: 40 },
        target: { kind: "cell", x: 120, y: 40 },
        overlayGrid: false,
        animated: false,
      },
    };
    const b: ComponentInstance = {
      id: "c-b",
      type: "connector-line",
      name: "B",
      x: 0,
      y: 0,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "cell", x: 40, y: 120 },
        target: { kind: "cell", x: 120, y: 120 },
        overlayGrid: false,
        animated: false,
      },
    };
    const fpLo = getConnectorBaseLayerFingerprint([a, b], 0x333333, bounds);
    const fpHi = getConnectorBaseLayerFingerprint([b, a], 0x333333, bounds);
    expect(fpLo).toBe(fpHi);
  });

  it("resolves joint stroke to grid color for cell endpoints", () => {
    const bounds = { width: 800, height: 560 };
    const gridHex = "#F3F3F3";
    const gridColor = parseHexColor(gridHex);
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
    ];
    const joint = getConnectorJointPoints(connectors, bounds)[0]!;
    expect(resolveSharedJointStrokeColor(joint, connectors, bounds, gridHex, gridColor, null)).toBe(gridColor);
  });

  it("uses selection highlight on joints owned by the selected connector", () => {
    const bounds = { width: 800, height: 560 };
    const gridHex = "#F3F3F3";
    const gridColor = parseHexColor(gridHex);
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
    ];
    const joint = getConnectorJointPoints(connectors, bounds)[0]!;
    expect(resolveSharedJointStrokeColor(joint, connectors, bounds, gridHex, gridColor, "connector-line-1")).toBe(
      CONNECTOR_HIGHLIGHT_COLOR,
    );
  });

  it("uses themed endpoint fill for joint stroke when source is a themed layer", () => {
    const bounds = { width: 800, height: 560 };
    const gridHex = "#F3F3F3";
    const gridColor = parseHexColor(gridHex);
    const icon: ComponentInstance = {
      id: "icon-orange",
      type: "icon-box",
      name: "Box",
      x: 40,
      y: 40,
      props: {
        ...(COMPONENT_REGISTRY["icon-box"].defaultProps as IconBoxProps),
        theme: "orange",
      },
    };
    const connector: ComponentInstance = {
      id: "c-themed",
      type: "connector-line",
      name: "C",
      x: 0,
      y: 0,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "layer", instanceId: "icon-orange" },
        target: { kind: "cell", x: 280, y: 200 },
        overlayGrid: false,
        animated: false,
      },
    };
    const instances = [icon, connector];
    const joints = getConnectorJointPoints(instances, bounds);
    expect(joints.length).toBeGreaterThan(0);
    const orange = parseHexColor("#FF4802");
    expect(resolveSharedJointStrokeColor(joints[0]!, instances, bounds, gridHex, gridColor, null)).toBe(orange);
  });
});
