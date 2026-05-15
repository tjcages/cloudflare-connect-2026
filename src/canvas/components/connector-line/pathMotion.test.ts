import { describe, expect, it } from "vitest";
import { bounceDistanceAlong, getPolylineMetrics, slicePolylineByDistance } from "./pathMotion";

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

  it("bounces along the path with period 2L", () => {
    const L = 100;
    expect(bounceDistanceAlong(0, 1, L)).toBe(0);
    expect(bounceDistanceAlong(100, 1, L)).toBe(100);
    expect(bounceDistanceAlong(150, 1, L)).toBe(50);
    expect(bounceDistanceAlong(200, 1, L)).toBe(0);
  });
});
