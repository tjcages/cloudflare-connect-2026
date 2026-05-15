import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, normalizeConfig, updateLargeRatio, updateSmallRatio } from "./config";

describe("normalizeConfig", () => {
  it("uses a larger default share of 80x80 cells", () => {
    expect(DEFAULT_CONFIG.density).toBe(0.36);
    expect(DEFAULT_CONFIG.smallCellRatio).toBe(0.2);
    expect(DEFAULT_CONFIG.largeCellRatio).toBe(0.8);
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

  it("normalizes ratios so they sum to 1", () => {
    const config = normalizeConfig({
      ...DEFAULT_CONFIG,
      smallCellRatio: 2,
      largeCellRatio: 1,
    });

    expect(config.smallCellRatio + config.largeCellRatio).toBe(1);
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
  it("updates the large ratio when the small ratio changes", () => {
    expect(updateSmallRatio(0.35)).toEqual({
      smallCellRatio: 0.35,
      largeCellRatio: 0.65,
    });
  });

  it("updates the small ratio when the large ratio changes", () => {
    expect(updateLargeRatio(0.15)).toEqual({
      smallCellRatio: 0.85,
      largeCellRatio: 0.15,
    });
  });
});
