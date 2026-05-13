import { describe, expect, it } from "vitest";
import { createComponentInstance } from "../../../components/componentRegistry";
import {
  resolveConnectorEndpoint,
  routeConnectorPath,
  getConnectorSegmentCells,
  getConnectorCornerPoints,
} from "./route";
import type { ConnectorEndpoint } from "../../../grid/types";

describe("connector line routing", () => {
  it("resolves static cell endpoints and layer endpoints on the 80px connector lattice", () => {
    const iconBox = createComponentInstance("icon-box", 43, 79, 1, 800, 560);
    const cellEndpoint: ConnectorEndpoint = { kind: "cell", x: 200, y: 120 };
    const layerEndpoint: ConnectorEndpoint = { kind: "layer", instanceId: iconBox.id };

    expect(resolveConnectorEndpoint(cellEndpoint, [iconBox])).toEqual({ x: 200, y: 120 });
    expect(resolveConnectorEndpoint(layerEndpoint, [iconBox])).toEqual({ x: 120, y: 120 });
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
