import { describe, expect, it } from "vitest";
import {
  flamesToPixelBounds,
  mergeGridCellRegions,
  pixelBoundsToCellRegion,
  regionCellCount,
  resolveStripeIndicesInRegion,
  smoothBlockGridIndicesInRegion,
} from "./playgroundGridDirty";
import type { PlaygroundFlame } from "./playgroundFlames";
import { buildStripeColors } from "./stripeColors";

describe("pixelBoundsToCellRegion", () => {
  it("maps display pixel bounds to stripe cell bounds with padding", () => {
    const region = pixelBoundsToCellRegion(
      { dirtyMinX: 10, dirtyMinY: 12, dirtyMaxX: 30, dirtyMaxY: 34 },
      7,
      7,
      28,
      28,
      1,
    );
    expect(region).toEqual({ colMin: 0, rowMin: 0, colMax: 3, rowMax: 3 });
    expect(regionCellCount(region!)).toBe(16);
  });

  it("returns null for empty bounds", () => {
    expect(pixelBoundsToCellRegion(null, 7, 7, 28, 28)).toBeNull();
  });
});

describe("flamesToPixelBounds", () => {
  it("unions flame rectangles", () => {
    const flames: PlaygroundFlame[] = [
      { x: 10, y: 20, width: 40, height: 8, speedPxPerSec: 1, opacity: 1, color: { r: 1, g: 2, b: 3 } },
      { x: 100, y: 5, width: 12, height: 30, speedPxPerSec: 1, opacity: 1, color: { r: 1, g: 2, b: 3 } },
    ];
    expect(flamesToPixelBounds(flames)).toEqual({
      dirtyMinX: 10,
      dirtyMinY: 5,
      dirtyMaxX: 112,
      dirtyMaxY: 35,
    });
  });
});

describe("mergeGridCellRegions", () => {
  it("expands to cover both regions", () => {
    const merged = mergeGridCellRegions(
      { colMin: 1, rowMin: 2, colMax: 3, rowMax: 4 },
      { colMin: 5, rowMin: 1, colMax: 6, rowMax: 2 },
    );
    expect(merged).toEqual({ colMin: 1, rowMin: 1, colMax: 6, rowMax: 4 });
  });
});

describe("smoothBlockGridIndicesInRegion", () => {
  it("only changes indices inside the dirty region", () => {
    const previous = Uint8Array.from([0, 1, 2, 3]);
    const next = Uint8Array.from([4, 5, 6, 7]);
    const smoothed = smoothBlockGridIndicesInRegion(
      next,
      previous,
      { colMin: 1, rowMin: 0, colMax: 1, rowMax: 0 },
      2,
      1,
    );
    expect(Array.from(smoothed)).toEqual([0, 2, 2, 3]);
  });
});

describe("resolveStripeIndicesInRegion", () => {
  it("updates only cells inside the region", () => {
    const luma = Uint8Array.from([0, 64, 128, 255]);
    const out = Uint8Array.from([9, 9, 9, 9]);
    resolveStripeIndicesInRegion(
      luma,
      buildStripeColors().stripes,
      { colMin: 1, rowMin: 0, colMax: 1, rowMax: 1 },
      2,
      out,
    );
    expect(out[0]).toBe(9);
    expect(out[2]).toBe(9);
    expect(out[1]).not.toBe(9);
    expect(out[3]).not.toBe(9);
  });
});
