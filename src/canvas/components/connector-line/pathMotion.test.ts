import { describe, expect, it } from "vitest";
import { arcDistanceToPointOnPolyline, getPolylineMetrics, slicePolylineByDistance } from "./pathMotion";

describe("pathMotion", () => {
  it("measures a simple horizontal segment", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const m = getPolylineMetrics(points);
    expect(m.totalLength).toBe(100);
  });

  it("slices the middle of a segment without corner vertices", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const m = getPolylineMetrics(points);
    const slice = slicePolylineByDistance(points, m, 30, 50);
    expect(slice).toEqual([
      { x: 30, y: 0 },
      { x: 50, y: 0 },
    ]);
  });

  it("measures arc length to a vertex or strict interior lattice point along a stepped segment", () => {
    const points = [
      { x: 40, y: 120 },
      { x: 120, y: 120 },
      { x: 200, y: 120 },
    ];
    const m = getPolylineMetrics(points);
    expect(arcDistanceToPointOnPolyline(points, m, { x: 120, y: 120 })).toBe(80);
    expect(arcDistanceToPointOnPolyline(points, m, { x: 80, y: 120 })).toBe(40);
  });
});
