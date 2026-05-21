import { describe, expect, it } from "vitest";
import type { ComponentInstance } from "../../../grid/types";
import { createGapMask } from "../../../grid/mask";
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
  routeConnectorPathForInstance,
  applyStaticEndLeg,
  getStaticEndLegPoint,
  getConnectorCornerPointsForInstance,
  getConnectorSegmentCellsForInstance,
  resolveStaticEndLegForTarget,
} from "./route";
import type { ConnectorEndpoint } from "../../../grid/types";

const segmentCellTouchesGap = (
  cell: { x: number; y: number; width: number; height: number },
  gapMask: boolean[][],
): boolean => {
  const startRow = cell.y / 40;
  const endRow = (cell.y + cell.height) / 40;
  const startColumn = cell.x / 40;
  const endColumn = (cell.x + cell.width) / 40;
  for (let row = startRow; row < endRow; row += 1) {
    for (let column = startColumn; column < endColumn; column += 1) {
      if (gapMask[row]?.[column]) {
        return true;
      }
    }
  }
  return false;
};

describe("connector line routing", () => {
  it("resolves static cell endpoints and layer endpoints on the 80px connector lattice", () => {
    const iconBox = createComponentInstance("icon-box", 43, 79, 1, 800, 560);
    const cellEndpoint: ConnectorEndpoint = { kind: "cell", x: 200, y: 120 };
    const layerEndpoint: ConnectorEndpoint = { kind: "layer", instanceId: iconBox.id };

    expect(resolveConnectorEndpoint(cellEndpoint, [iconBox])).toEqual({ x: 200, y: 120 });
    expect(resolveConnectorEndpoint(layerEndpoint, [iconBox])).toEqual({ x: 120, y: 120 });
  });

  it("resolves length-2 horizontal icon-box layer endpoints at shadow-card center on the connector lattice", () => {
    const base = createComponentInstance("icon-box", 43, 79, 2, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    const box2x1: Extract<ComponentInstance, { type: "icon-box" }> = {
      ...base,
      props: { ...base.props, length: 2, direction: "horizontal" },
    };
    const layerEndpoint: ConnectorEndpoint = { kind: "layer", instanceId: box2x1.id };
    expect(resolveConnectorEndpoint(layerEndpoint, [box2x1])).toEqual({ x: 200, y: 120 });
  });

  it("resolves length-2 vertical icon-box layer endpoints at shadow-card center on the connector lattice", () => {
    const base = createComponentInstance("icon-box", 43, 79, 2, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    const box1x2: Extract<ComponentInstance, { type: "icon-box" }> = {
      ...base,
      props: { ...base.props, length: 2, direction: "vertical" },
    };
    const layerEndpoint: ConnectorEndpoint = { kind: "layer", instanceId: box1x2.id };
    expect(resolveConnectorEndpoint(layerEndpoint, [box1x2])).toEqual({ x: 120, y: 200 });
  });

  it("resolves length-3 horizontal icon-box layer endpoints at shadow-card center on the connector lattice", () => {
    const base = createComponentInstance("icon-box", 43, 79, 2, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    const box3x1: Extract<ComponentInstance, { type: "icon-box" }> = {
      ...base,
      props: { ...base.props, length: 3, direction: "horizontal" },
    };
    const layerEndpoint: ConnectorEndpoint = { kind: "layer", instanceId: box3x1.id };
    expect(resolveConnectorEndpoint(layerEndpoint, [box3x1])).toEqual({ x: 200, y: 120 });
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

  it("routes horizontal layer anchors out of and into component sides", () => {
    const sourceBox = createComponentInstance("icon-box", 40, 40, 1, 800, 560);
    const targetBox = createComponentInstance("icon-box", 240, 200, 2, 800, 560);
    const source = resolveConnectorEndpoint({ kind: "layer", instanceId: sourceBox.id }, [sourceBox, targetBox]);
    const target = resolveConnectorEndpoint({ kind: "layer", instanceId: targetBox.id }, [sourceBox, targetBox]);

    expect(source).not.toBeNull();
    expect(target).not.toBeNull();

    const points = routeConnectorPath(source!, target!, "horizontal", { width: 800, height: 560 });

    expect(points[1]!.y).toBe(points[0]!.y);
    expect(points[1]!.x).not.toBe(points[0]!.x);
    expect(points.at(-2)!.y).toBe(points.at(-1)!.y);
    expect(points.at(-2)!.x).not.toBe(points.at(-1)!.x);
  });

  it("detours horizontal routes around gap-mask slots", () => {
    const gapMask = createGapMask(6, 8);
    gapMask[2]![2] = true;

    const points = routeConnectorPath({ x: 40, y: 40 }, { x: 280, y: 200 }, "horizontal", {
      width: 320,
      height: 240,
      gapMask,
    });

    expect(points).not.toContainEqual({ x: 120, y: 120 });
    expect(points[1]!.y).toBe(points[0]!.y);
    expect(points.at(-2)!.y).toBe(points.at(-1)!.y);
    expect(getConnectorSegmentCells(points).some((cell) => segmentCellTouchesGap(cell, gapMask))).toBe(false);
  });

  it("checks blocked gap slots along long dogleg spans, not only at vertices", () => {
    const gapMask = createGapMask(6, 12);
    gapMask[2]![4] = true;

    const points = routeConnectorPath({ x: 40, y: 40 }, { x: 440, y: 40 }, "horizontal", {
      width: 480,
      height: 240,
      gapMask,
    });

    expect(points).not.toContainEqual({ x: 200, y: 120 });
    expect(getConnectorSegmentCells(points).some((cell) => segmentCellTouchesGap(cell, gapMask))).toBe(false);
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

  it("resolves static end leg from canvas edge proximity for static cell targets", () => {
    const bounds = { width: 800, height: 560 };
    expect(resolveStaticEndLegForTarget({ kind: "cell", x: 40, y: 120 }, bounds.width, bounds.height)).toBe("left");
    expect(resolveStaticEndLegForTarget({ kind: "cell", x: 760, y: 120 }, bounds.width, bounds.height)).toBe("right");
    expect(resolveStaticEndLegForTarget({ kind: "cell", x: 200, y: 40 }, bounds.width, bounds.height)).toBe("top");
    expect(resolveStaticEndLegForTarget({ kind: "cell", x: 200, y: 520 }, bounds.width, bounds.height)).toBe("bottom");
    expect(resolveStaticEndLegForTarget({ kind: "cell", x: 200, y: 120 }, bounds.width, bounds.height)).toBe("unset");
    expect(resolveStaticEndLegForTarget({ kind: "layer", instanceId: "icon-box-1" }, bounds.width, bounds.height)).toBe(
      "unset",
    );
  });

  it("extends a static cell target path from center toward the chosen in-cell edge", () => {
    const cellCenter = { x: 200, y: 120 };
    expect(getStaticEndLegPoint(cellCenter, "left")).toEqual({ x: 160, y: 120 });
    expect(getStaticEndLegPoint(cellCenter, "right")).toEqual({ x: 240, y: 120 });
    expect(getStaticEndLegPoint(cellCenter, "top")).toEqual({ x: 200, y: 80 });
    expect(getStaticEndLegPoint(cellCenter, "bottom")).toEqual({ x: 200, y: 160 });

    const base = routeConnectorPath({ x: 40, y: 120 }, cellCenter, "horizontal");
    expect(applyStaticEndLeg(base, { kind: "cell", ...cellCenter }, "left")).toEqual([...base, { x: 160, y: 120 }]);
    expect(applyStaticEndLeg(base, { kind: "cell", ...cellCenter }, "unset")).toEqual(base);
    expect(applyStaticEndLeg(base, { kind: "layer", instanceId: "icon-box-1" }, "left")).toEqual(base);
  });

  it("routes connector instances with static end legs applied after pathfinding", () => {
    const bounds = { width: 800, height: 560 };
    const connector: Extract<ComponentInstance, { type: "connector-line" }> = {
      id: "connector-line-1",
      type: "connector-line",
      name: "Connector Line 1",
      x: 40,
      y: 120,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "cell", x: 120, y: 120 },
        target: { kind: "cell", x: 760, y: 120 },
        overlayGrid: true,
        animated: true,
        style: "solid",
      },
    };

    expect(routeConnectorPathForInstance(connector, [connector], bounds).at(-1)).toEqual({ x: 800, y: 120 });
    expect(routeConnectorPathForInstance(connector, [connector], bounds).at(-2)).toEqual({ x: 760, y: 120 });
  });

  it("does not add a misaligned segment cell for static end leg edge points", () => {
    const cellCenter = { x: 200, y: 120 };
    const base = routeConnectorPath({ x: 40, y: 120 }, cellCenter, "horizontal");
    const withLeg = applyStaticEndLeg(base, { kind: "cell", ...cellCenter }, "bottom");

    expect(getConnectorSegmentCells(withLeg)).toEqual(getConnectorSegmentCells(base));
  });

  it("omits the target segment lattice cell when a static end leg is active", () => {
    const bounds = { width: 800, height: 560 };
    const connector: Extract<ComponentInstance, { type: "connector-line" }> = {
      id: "connector-line-1",
      type: "connector-line",
      name: "Connector Line 1",
      x: 40,
      y: 120,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "cell", x: 40, y: 120 },
        target: { kind: "cell", x: 200, y: 520 },
        overlayGrid: true,
        animated: true,
        style: "dashed",
      },
    };

    const cells = getConnectorSegmentCellsForInstance(connector, [connector], bounds);
    expect(cells.some((cell) => cell.x === 160 && cell.y === 80)).toBe(false);
    expect(cells.some((cell) => cell.x === 80 && cell.y === 80)).toBe(true);
  });

  it("omits the in-cell pivot joint when a static end leg is active", () => {
    const cellCenter = { x: 200, y: 120 };
    const base = routeConnectorPath({ x: 40, y: 120 }, cellCenter, "horizontal");
    const withLeg = applyStaticEndLeg(base, { kind: "cell", ...cellCenter }, "bottom");

    expect(getConnectorCornerPoints(withLeg)).toContainEqual(cellCenter);
    expect(getConnectorCornerPointsForInstance(withLeg, { kind: "cell", ...cellCenter }, "bottom")).not.toContainEqual(
      cellCenter,
    );
  });
});
