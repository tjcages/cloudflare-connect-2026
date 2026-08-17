import { describe, expect, it } from "vitest";
import { COMET_LOGO_BACKGROUND_POINT_COUNT, COMET_LOGO_TRAIL_SEGMENT_COUNT } from "./points";
import { COMET_LOGO_DEFAULT_SHAPE, cometLogoPointCounts, cometLogoPoolPointCount } from "./shape";

describe("comet logo point counts", () => {
  it("carries a 160-particle background field", () => {
    expect(COMET_LOGO_BACKGROUND_POINT_COUNT).toBe(160);
  });

  it("uses eight trail segments", () => {
    expect(COMET_LOGO_TRAIL_SEGMENT_COUNT).toBe(8);
  });

  it("derives its render counts from the shape", () => {
    const counts = cometLogoPointCounts(COMET_LOGO_DEFAULT_SHAPE);
    expect(counts.logo).toBe(COMET_LOGO_DEFAULT_SHAPE.points.length);
    expect(counts.render).toBe(counts.logo + COMET_LOGO_BACKGROUND_POINT_COUNT);
    expect(counts.activeRender).toBe(counts.render + 96);
  });

  it("sizes the logo pool from a fractional density", () => {
    const logoCount = COMET_LOGO_DEFAULT_SHAPE.points.length;
    expect(cometLogoPoolPointCount(1, COMET_LOGO_DEFAULT_SHAPE)).toBe(logoCount);
    expect(cometLogoPoolPointCount(2.25, COMET_LOGO_DEFAULT_SHAPE)).toBe(Math.round(2.25 * logoCount));
  });

  it("never returns an empty pool", () => {
    expect(cometLogoPoolPointCount(0, COMET_LOGO_DEFAULT_SHAPE)).toBe(1);
  });
});
