import { describe, expect, it } from "vitest";
import { bandIndexForValue } from "./cellBand";
import { DEFAULT_STRIPES } from "../config/normalize";

describe("bandIndexForValue", () => {
  it("returns 0 below the lowest threshold", () => {
    expect(bandIndexForValue(0.05, DEFAULT_STRIPES)).toBe(0);
  });

  it("returns 1-based band index for the highest startFrom <= value", () => {
    expect(bandIndexForValue(0.13, DEFAULT_STRIPES)).toBe(1);
    expect(bandIndexForValue(0.3, DEFAULT_STRIPES)).toBe(2);
    expect(bandIndexForValue(0.95, DEFAULT_STRIPES)).toBe(6);
  });

  it("returns 0 for empty stripes", () => {
    expect(bandIndexForValue(0, [])).toBe(0);
    expect(bandIndexForValue(0.5, [])).toBe(0);
  });

  it("is order-independent (sorts by startFrom)", () => {
    const shuffled = [
      DEFAULT_STRIPES[3],
      DEFAULT_STRIPES[0],
      DEFAULT_STRIPES[5],
      DEFAULT_STRIPES[2],
      DEFAULT_STRIPES[1],
      DEFAULT_STRIPES[4],
    ];
    expect(bandIndexForValue(0.05, shuffled)).toBe(0);
    expect(bandIndexForValue(0.13, shuffled)).toBe(1);
    expect(bandIndexForValue(0.3, shuffled)).toBe(2);
    expect(bandIndexForValue(0.95, shuffled)).toBe(6);
  });
});
