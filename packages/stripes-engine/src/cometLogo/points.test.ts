import { describe, expect, it } from "vitest";
import {
  COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT,
  COMET_LOGO_POINT_COUNT,
  COMET_LOGO_TRAIL_SEGMENT_COUNT,
  cometLogoPoolPointCount,
} from "./points";

describe("comet logo point counts", () => {
  it("carries a 160-particle background field", () => {
    expect(COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT).toBe(160);
  });

  it("uses eight trail segments", () => {
    expect(COMET_LOGO_TRAIL_SEGMENT_COUNT).toBe(8);
  });

  it("sizes the logo pool from a fractional density", () => {
    expect(cometLogoPoolPointCount(1)).toBe(COMET_LOGO_POINT_COUNT);
    expect(cometLogoPoolPointCount(2.25)).toBe(Math.round(2.25 * COMET_LOGO_POINT_COUNT));
  });

  it("never returns an empty pool", () => {
    expect(cometLogoPoolPointCount(0)).toBe(1);
  });
});
