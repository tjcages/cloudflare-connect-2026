import { describe, expect, it } from "vitest";
import { stripeBandFromBgDistance } from "./computeBlockGrid";
import { DEFAULT_STRIPE_BAND_BREAKPOINTS } from "./stripeBandThresholds";
import {
  STRIPE_BAND_COUNT,
  STRIPE_BAND_NONE,
  decodeStripeBand,
  encodeStripeBand,
  widthPxFromBand,
} from "./stripeGridConstants";

const defaultOptions = {
  density: 1,
  bandBreakpoints: DEFAULT_STRIPE_BAND_BREAKPOINTS,
};

describe("stripeBandFromBgDistance", () => {
  it("returns none for background or invalid distance", () => {
    expect(stripeBandFromBgDistance(0, true, defaultOptions)).toBe(STRIPE_BAND_NONE);
    expect(stripeBandFromBgDistance(3, true, defaultOptions)).toBe(STRIPE_BAND_NONE);
    expect(stripeBandFromBgDistance(0, false, defaultOptions)).toBe(STRIPE_BAND_NONE);
  });

  it("maps foreground distances 1…5+ into equal bands", () => {
    expect(stripeBandFromBgDistance(1, false, defaultOptions)).toBe(1);
    expect(stripeBandFromBgDistance(2, false, defaultOptions)).toBe(2);
    expect(stripeBandFromBgDistance(4, false, defaultOptions)).toBe(4);
    expect(stripeBandFromBgDistance(5, false, defaultOptions)).toBe(5);
    expect(stripeBandFromBgDistance(12, false, defaultOptions)).toBe(5);
  });

  it("scales bands with density", () => {
    expect(stripeBandFromBgDistance(4, false, { ...defaultOptions, density: 2 })).toBe(2);
    expect(stripeBandFromBgDistance(4, false, { ...defaultOptions, density: 0.5 })).toBe(5);
  });
});

describe("widthPxFromBand", () => {
  it("uses equal 5px steps across five bands", () => {
    expect(widthPxFromBand(0)).toBe(0);
    expect(widthPxFromBand(1)).toBe(1);
    expect(widthPxFromBand(2)).toBe(2);
    expect(widthPxFromBand(3)).toBe(3);
    expect(widthPxFromBand(4)).toBe(4);
    expect(widthPxFromBand(5)).toBe(5);
  });
});

describe("encodeStripeBand / decodeStripeBand", () => {
  it("round-trips bands 0 and 1…5", () => {
    expect(decodeStripeBand(encodeStripeBand(0))).toBe(0);
    for (let band = 1; band <= STRIPE_BAND_COUNT; band++) {
      expect(decodeStripeBand(encodeStripeBand(band))).toBe(band);
    }
  });
});
