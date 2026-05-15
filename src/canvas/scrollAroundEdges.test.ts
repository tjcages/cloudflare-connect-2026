import { describe, expect, it } from "vitest";
import { getCanvasPanelEdgeScrollStep } from "./scrollAroundEdges";

describe("getCanvasPanelEdgeScrollStep", () => {
  const rect = { left: 100, right: 300, top: 80, bottom: 380 };

  it("returns zero when the pointer is away from edges", () => {
    expect(getCanvasPanelEdgeScrollStep(rect, 200, 200, { edgePx: 40, maxStepPx: 10 })).toEqual({
      scrollDx: 0,
      scrollDy: 0,
    });
  });

  it("scrolls left when the pointer is inside the left edge zone", () => {
    const step = getCanvasPanelEdgeScrollStep(rect, 115, 200, { edgePx: 40, maxStepPx: 10 });
    expect(step.scrollDy).toBe(0);
    expect(step.scrollDx).toBeLessThan(0);
    expect(step.scrollDx).toBeGreaterThanOrEqual(-10);
  });

  it("scrolls down when the pointer is inside the bottom edge zone", () => {
    const step = getCanvasPanelEdgeScrollStep(rect, 200, 375, { edgePx: 40, maxStepPx: 10 });
    expect(step.scrollDx).toBe(0);
    expect(step.scrollDy).toBeGreaterThan(0);
    expect(step.scrollDy).toBeLessThanOrEqual(10);
  });
});
