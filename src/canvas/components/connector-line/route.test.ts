import { describe, expect, it } from "vitest";
import { createComponentInstance } from "../../../lib/componentRegistry";
import {
  getConnectorLineEndpointHighlightCenters,
  resolveConnectorEndpoint,
  resolveConnectorLineEndpoints,
  routeConnectorPath,
  getConnectorSegmentCells,
  getConnectorCornerPoints,
} from "./route";
import type { ComponentInstance, ConnectorEndpoint } from "../../../grid/types";

describe("connector line routing", () => {
  it("resolves static cell endpoints and layer endpoints on the 80px connector lattice", () => {
    const iconBox = createComponentInstance("icon-box", 43, 79, 1, 800, 560);
    const cellEndpoint: ConnectorEndpoint = { kind: "cell", x: 200, y: 120 };
    const layerEndpoint: ConnectorEndpoint = { kind: "layer", instanceId: iconBox.id };

    expect(resolveConnectorEndpoint(cellEndpoint, [iconBox])).toEqual({ x: 200, y: 120 });
    expect(resolveConnectorEndpoint(layerEndpoint, [iconBox])).toEqual({ x: 120, y: 120 });
  });

  it("resolveConnectorLineEndpoints picks left half of icon-box-2x1 when peer lies to the west", () => {
    const wide = createComponentInstance("icon-box-2x1", 43, 79, 1, 800, 560);
    const connector = {
      id: "connector-line-1",
      type: "connector-line" as const,
      name: "Connector Line 1",
      x: 40,
      y: 40,
      props: {
        preferredConnection: "horizontal" as const,
        source: { kind: "layer" as const, instanceId: wide.id },
        target: { kind: "cell" as const, x: 40, y: 120 },
        overlayGrid: true as const,
        animated: true as const,
      },
    };
    const resolved = resolveConnectorLineEndpoints(connector, [wide, connector as ComponentInstance]);
    expect(resolved?.source).toEqual({ x: 40, y: 120 });
    expect(resolved?.target).toEqual({ x: 40, y: 120 });
  });

  it("resolveConnectorLineEndpoints picks right half of icon-box-2x1 when peer lies to the east", () => {
    const wide = createComponentInstance("icon-box-2x1", 43, 79, 2, 800, 560);
    const connector = {
      id: "connector-line-1",
      type: "connector-line" as const,
      name: "Connector Line 1",
      x: 40,
      y: 40,
      props: {
        preferredConnection: "horizontal" as const,
        source: { kind: "layer" as const, instanceId: wide.id },
        target: { kind: "cell" as const, x: 280, y: 120 },
        overlayGrid: true as const,
        animated: true as const,
      },
    };
    const resolved = resolveConnectorLineEndpoints(connector, [wide, connector as ComponentInstance]);
    expect(resolved?.source).toEqual({ x: 120, y: 120 });
    expect(resolved?.target).toEqual({ x: 280, y: 120 });
  });

  it("layers icon-box-2x1 endpoints into two highlight centers plus deduped static cells", () => {
    const wide = createComponentInstance("icon-box-2x1", 43, 79, 1, 800, 560);
    const connector = {
      id: "connector-line-1",
      type: "connector-line" as const,
      name: "Connector Line 1",
      x: 40,
      y: 40,
      props: {
        preferredConnection: "horizontal" as const,
        source: { kind: "layer" as const, instanceId: wide.id },
        target: { kind: "cell" as const, x: 40, y: 120 },
        overlayGrid: true as const,
        animated: true as const,
      },
    };
    const instList = [wide, connector as ComponentInstance];
    const resolved = resolveConnectorLineEndpoints(connector, instList)!;
    expect(getConnectorLineEndpointHighlightCenters(connector, instList, resolved)).toEqual([
      { x: 40, y: 120 },
      { x: 120, y: 120 },
    ]);
  });

  it("uses a horizontal first leg when horizontal preference connects collinear vertical anchor points", () => {
    const points = routeConnectorPath({ x: 120, y: 40 }, { x: 120, y: 200 }, "horizontal", {
      width: 800,
      height: 560,
    });

    expect(points[0]).toEqual({ x: 120, y: 40 });
    expect(points[1]).toEqual({ x: 200, y: 40 });
    expect(points.at(-1)).toEqual({ x: 120, y: 200 });
    expect(points[1]!.y).toBe(points[0]!.y);
    expect(points[2]!.x).toBe(points[1]!.x);
    expect(points[2]!.y).not.toBe(points[1]!.y);
  });

  it("when Δx is one cell, horizontal path still starts with a horizontal jog (never vertical-first)", () => {
    const points = routeConnectorPath({ x: 200, y: 100 }, { x: 280, y: 300 }, "horizontal", {
      width: 800,
      height: 560,
    });
    expect(points[1]!.y).toBe(points[0]!.y);
    expect(points[1]!.x).not.toBe(points[0]!.x);
  });

  it("routes horizontal preference with 80px segments and no longer than Manhattan distance", () => {
    const points = routeConnectorPath({ x: 40, y: 40 }, { x: 200, y: 200 }, "horizontal");

    expect(points).toEqual([
      { x: 40, y: 40 },
      { x: 120, y: 40 },
      { x: 120, y: 120 },
      { x: 120, y: 200 },
      { x: 200, y: 200 },
    ]);
  });

  it("routes horizontal preference into the target from the side", () => {
    const points = routeConnectorPath({ x: 40, y: 40 }, { x: 200, y: 200 }, "horizontal");

    expect(points.at(-2)?.y).toBe(200);
    expect(points.at(-2)?.x).not.toBe(200);
  });

  it("routes vertical preference by taking the first and last movement vertically when possible", () => {
    const points = routeConnectorPath({ x: 40, y: 40 }, { x: 200, y: 200 }, "vertical");

    expect(points).toEqual([
      { x: 40, y: 40 },
      { x: 40, y: 120 },
      { x: 120, y: 120 },
      { x: 200, y: 120 },
      { x: 200, y: 200 },
    ]);
  });

  it("keeps routed points centered on the 80px connector lattice", () => {
    const points = routeConnectorPath({ x: 40, y: 40 }, { x: 120, y: 200 }, "horizontal");

    expect(points.at(-1)).toEqual({ x: 120, y: 200 });
    expect(points.every((point) => (point.x - 40) % 80 === 0 && (point.y - 40) % 80 === 0)).toBe(true);
  });

  it("adds a tasteful dogleg for long straight connections without inflating route length", () => {
    const points = routeConnectorPath({ x: 40, y: 40 }, { x: 280, y: 40 }, "horizontal");

    expect(points).toEqual([
      { x: 40, y: 40 },
      { x: 120, y: 40 },
      { x: 120, y: 120 },
      { x: 200, y: 120 },
      { x: 200, y: 40 },
      { x: 280, y: 40 },
    ]);
  });

  it("keeps straight doglegs inside provided canvas bounds", () => {
    const points = routeConnectorPath({ x: 40, y: 520 }, { x: 280, y: 520 }, "horizontal", {
      width: 800,
      height: 560,
    });

    expect(points.every((point) => point.y >= 0 && point.y <= 560)).toBe(true);
    expect(points).toContainEqual({ x: 120, y: 440 });
  });

  it("falls back to stepped straight routing when bounds have no room for a dogleg", () => {
    expect(
      routeConnectorPath({ x: 40, y: 40 }, { x: 280, y: 40 }, "horizontal", {
        width: 800,
        height: 80,
      }),
    ).toEqual([
      { x: 40, y: 40 },
      { x: 120, y: 40 },
      { x: 200, y: 40 },
      { x: 280, y: 40 },
    ]);
  });

  it("centers 80x80 segment boxes on each routed large-cell center", () => {
    const points = routeConnectorPath({ x: 40, y: 40 }, { x: 200, y: 200 }, "horizontal");

    expect(getConnectorSegmentCells(points)).toEqual([
      { x: 0, y: 0, width: 80, height: 80 },
      { x: 80, y: 0, width: 80, height: 80 },
      { x: 80, y: 80, width: 80, height: 80 },
      { x: 80, y: 160, width: 80, height: 80 },
      { x: 160, y: 160, width: 80, height: 80 },
    ]);
    for (const [index, cell] of getConnectorSegmentCells(points).entries()) {
      expect({ x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 }).toEqual(points[index]);
    }
    expect(getConnectorCornerPoints(points)).toEqual([
      { x: 120, y: 40 },
      { x: 120, y: 200 },
    ]);
  });

  it("centers vertical segment boxes on the routed large-cell centers", () => {
    const points = routeConnectorPath({ x: 40, y: 40 }, { x: 40, y: 200 }, "vertical");

    expect(getConnectorSegmentCells(points)).toEqual([
      { x: 0, y: 0, width: 80, height: 80 },
      { x: 0, y: 80, width: 80, height: 80 },
      { x: 0, y: 160, width: 80, height: 80 },
    ]);
  });
});
