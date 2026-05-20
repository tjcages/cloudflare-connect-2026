import { describe, expect, it } from "vitest";
import { createComponentInstance } from "../../../lib/componentRegistry";
import {
  crossingsBetweenOrthoPolylines,
  getConnectorCornerPoints,
  getForeignCornerOverlapPoints,
  getConnectorSegmentCells,
  getLatticeCellsIntersectingCanvasRect,
  orthogonalSegmentIntersection,
  resolveConnectorEndpoint,
  routeConnectorPath,
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

  it("resolves icon-box-2x1 layer endpoints at shadow-card center on the connector lattice", () => {
    const box2x1 = createComponentInstance("icon-box-2x1", 43, 79, 2, 800, 560);
    const layerEndpoint: ConnectorEndpoint = { kind: "layer", instanceId: box2x1.id };
    // Geometric shadow-card center x is 160px; snaps to the nearer 80px connector lattice center at 200.
    expect(resolveConnectorEndpoint(layerEndpoint, [box2x1])).toEqual({ x: 200, y: 120 });
  });

  it("resolves icon-box-1x2 layer endpoints at shadow-card center on the connector lattice", () => {
    const box1x2 = createComponentInstance("icon-box-1x2", 43, 79, 2, 800, 560);
    const layerEndpoint: ConnectorEndpoint = { kind: "layer", instanceId: box1x2.id };
    expect(resolveConnectorEndpoint(layerEndpoint, [box1x2])).toEqual({ x: 120, y: 200 });
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

  it("enumerates lattice cells clipped to viewport bounds over a spanning rect", () => {
    const bounds = { width: 240, height: 200 };
    expect(getLatticeCellsIntersectingCanvasRect({ x: 0, y: 0, width: 240, height: 200 }, bounds)).toEqual([
      { x: 0, y: 0, width: 80, height: 80 },
      { x: 80, y: 0, width: 80, height: 80 },
      { x: 160, y: 0, width: 80, height: 80 },
      { x: 0, y: 80, width: 80, height: 80 },
      { x: 80, y: 80, width: 80, height: 80 },
      { x: 160, y: 80, width: 80, height: 80 },
      { x: 0, y: 160, width: 80, height: 80 },
      { x: 80, y: 160, width: 80, height: 80 },
      { x: 160, y: 160, width: 80, height: 80 },
    ]);
  });

  it("returns a single lattice cell for a partly overlapping viewport rect", () => {
    expect(
      getLatticeCellsIntersectingCanvasRect({ x: 100, y: 90, width: 50, height: 40 }, { width: 1000, height: 1000 }),
    ).toEqual([{ x: 80, y: 80, width: 80, height: 80 }]);
  });

  it("clips lattice enumeration to logical canvas extents", () => {
    expect(
      getLatticeCellsIntersectingCanvasRect({ x: 760, y: 0, width: 100, height: 80 }, { width: 800, height: 560 }),
    ).toEqual([{ x: 720, y: 0, width: 80, height: 80 }]);
  });

  it("returns no cells when the rect misses the clipped viewport entirely", () => {
    expect(
      getLatticeCellsIntersectingCanvasRect({ x: 900, y: 0, width: 80, height: 80 }, { width: 800, height: 560 }),
    ).toEqual([]);
  });

  it("centers vertical segment boxes on the routed large-cell centers", () => {
    const points = routeConnectorPath({ x: 40, y: 40 }, { x: 40, y: 200 }, "vertical");

    expect(getConnectorSegmentCells(points)).toEqual([
      { x: 0, y: 0, width: 80, height: 80 },
      { x: 0, y: 80, width: 80, height: 80 },
      { x: 0, y: 160, width: 80, height: 80 },
    ]);
  });

  it("detects '+' crossings between orthogonal polylines", () => {
    const horizontal = [
      { x: 40, y: 120 },
      { x: 280, y: 120 },
    ];
    const vertical = [
      { x: 120, y: 40 },
      { x: 120, y: 200 },
    ];
    expect(crossingsBetweenOrthoPolylines(horizontal, vertical)).toEqual([{ x: 120, y: 120 }]);
    expect(crossingsBetweenOrthoPolylines(vertical, horizontal)).toEqual([{ x: 120, y: 120 }]);
  });

  it("bridges joints when passing through foreign bend coords on a straight polyline segment", () => {
    const collinearSteps = [
      { x: 40, y: 120 },
      { x: 120, y: 120 },
      { x: 280, y: 120 },
    ];
    expect(getConnectorCornerPoints(collinearSteps)).toEqual([]);
    expect(getForeignCornerOverlapPoints(collinearSteps, [{ x: 120, y: 120 }])).toEqual([{ x: 120, y: 120 }]);
  });

  it("orthogonalSegmentIntersection returns the grid crossing of perpendicular spans", () => {
    expect(
      orthogonalSegmentIntersection({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 40, y: -20 }, { x: 40, y: 20 }),
    ).toEqual({
      x: 40,
      y: 0,
    });
    expect(
      orthogonalSegmentIntersection({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 10, y: -20 }, { x: 110, y: -20 }),
    ).toBeNull();
  });
});
