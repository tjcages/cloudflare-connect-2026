import { describe, expect, it } from "vitest";
import {
  bandFromDistance,
  DEFAULT_STRIPE_BAND_BREAKPOINTS,
  normalizeStripeBandBreakpoints,
  setStripeBandBreakpoint,
  stripeBandDistanceLabel,
} from "./stripeBandThresholds";

describe("bandFromDistance with breakpoints", () => {
  it("maps scaled distance into contiguous bands", () => {
    const breakpoints = DEFAULT_STRIPE_BAND_BREAKPOINTS;
    expect(bandFromDistance(0, true, 1, breakpoints)).toBe(0);
    expect(bandFromDistance(1, false, 1, breakpoints)).toBe(1);
    expect(bandFromDistance(2, false, 1, breakpoints)).toBe(2);
    expect(bandFromDistance(5, false, 1, breakpoints)).toBe(5);
    expect(bandFromDistance(12, false, 1, breakpoints)).toBe(5);
  });
});

describe("setStripeBandBreakpoint", () => {
  it("pushes later breakpoints when an upper bound moves up", () => {
    const next = setStripeBandBreakpoint(DEFAULT_STRIPE_BAND_BREAKPOINTS, 0, 3);
    expect(next[0]).toBe(3);
    expect(next[1]).toBeGreaterThan(3);
    expect(next[1]).toBeLessThan(next[2]);
    expect(next[2]).toBeLessThan(next[3]);
  });

  it("pulls earlier breakpoints when an upper bound moves down", () => {
    const wide = normalizeStripeBandBreakpoints([4, 5, 6, 7]);
    const next = setStripeBandBreakpoint(wide, 2, 2.5);
    expect(next[2]).toBe(2.5);
    expect(next[0]).toBeLessThan(next[1]);
    expect(next[1]).toBeLessThan(2.5);
  });
});

describe("stripeBandDistanceLabel", () => {
  it("describes the deepest band as open-ended", () => {
    expect(stripeBandDistanceLabel(DEFAULT_STRIPE_BAND_BREAKPOINTS, 4)).toBe(">4");
  });
});
