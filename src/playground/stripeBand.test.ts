import { describe, expect, it } from "vitest";
import { stripeBandFromLuminance } from "./computeBlockGrid";
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

describe("stripeBandFromLuminance", () => {
  it("returns none for background or zero luminance", () => {
    expect(stripeBandFromLuminance(0, true, defaultOptions)).toBe(STRIPE_BAND_NONE);
    expect(stripeBandFromLuminance(0.5, true, defaultOptions)).toBe(STRIPE_BAND_NONE);
    expect(stripeBandFromLuminance(0, false, defaultOptions)).toBe(STRIPE_BAND_NONE);
  });

  it("maps foreground luminance into equal bands", () => {
    const band1Lum = 1 / 16;
    expect(stripeBandFromLuminance(band1Lum, false, defaultOptions)).toBe(1);
    expect(stripeBandFromLuminance(2 / 16, false, defaultOptions)).toBe(2);
    expect(stripeBandFromLuminance(4 / 16, false, defaultOptions)).toBe(4);
    expect(stripeBandFromLuminance(5 / 16, false, defaultOptions)).toBe(5);
    expect(stripeBandFromLuminance(12 / 16, false, defaultOptions)).toBe(5);
  });

  it("scales bands with density", () => {
    expect(stripeBandFromLuminance(4 / 16, false, { ...defaultOptions, density: 2 })).toBe(2);
    expect(stripeBandFromLuminance(4 / 16, false, { ...defaultOptions, density: 0.5 })).toBe(5);
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
