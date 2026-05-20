import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  getPlaceableSlotCount,
  normalizeConfig,
  prefersAllSmallCells,
  updateSmallRatio,
} from "./config";

describe("normalizeConfig", () => {
  it("uses density for large fill and an independent small-cell ratio", () => {
    expect(DEFAULT_CONFIG.density).toBe(0.36);
    expect(DEFAULT_CONFIG.smallCellRatio).toBe(0.2);
    expect(prefersAllSmallCells(DEFAULT_CONFIG.smallCellRatio)).toBe(false);
  });

  it("defaults the grid stroke color to the browser starter color", () => {
    expect(DEFAULT_CONFIG.strokeColor).toBe("#f3f3f3");
    expect(normalizeConfig(DEFAULT_CONFIG).strokeColor).toBe("#f3f3f3");
  });

  it("preserves a configured grid stroke color", () => {
    const config = normalizeConfig({
      ...DEFAULT_CONFIG,
      strokeColor: "#123456",
    });

    expect(config.strokeColor).toBe("#123456");
  });

  it("rounds dimensions to the nearest 40px and adds the render stroke buffer", () => {
    const config = normalizeConfig({
      ...DEFAULT_CONFIG,
      width: 103,
      height: 179,
    });

    expect(config.logicalWidth).toBe(120);
    expect(config.logicalHeight).toBe(160);
    expect(config.renderWidth).toBe(121);
    expect(config.renderHeight).toBe(161);
  });

  it("clamps the small-cell ratio into 0..1", () => {
    const config = normalizeConfig({
      ...DEFAULT_CONFIG,
      smallCellRatio: 2,
    });

    expect(config.smallCellRatio).toBe(1);
  });

  it("counts placeable slots as total minus gap-mask blocks", () => {
    const config = normalizeConfig({
      ...DEFAULT_CONFIG,
      width: 320,
      height: 320,
      gapMask: [
        [true, true, false, false, false, false, false, false],
        [true, true, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false],
      ],
    });

    expect(getPlaceableSlotCount(config)).toBe(60);
  });

  it("normalizes density to the 0..1 range", () => {
    const config = normalizeConfig({
      ...DEFAULT_CONFIG,
      density: 2,
    });

    expect(config.density).toBe(1);
  });
});

describe("ratio updates", () => {
  it("updates only the small-cell ratio", () => {
    expect(updateSmallRatio(0.35)).toEqual({
      smallCellRatio: 0.35,
    });
  });
});
