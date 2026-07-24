import { describe, it, expect } from "vitest";
import {
  buildStripeLut,
  buildStripeOpacityLut,
  lutSignature,
  stripeDotBandEligibility,
  WIDTH_LUT_SCALE,
} from "./stripeLut";

const STRIPES = [
  { color: 0x000000, startFrom: 0.0, width: 4, opacity: 1 },
  { color: 0xff8833, startFrom: 0.5, width: 8, opacity: 0.5 },
];

const STRIPES_NO_ZERO = [
  { color: 0xff0000, startFrom: 0.2, width: 10, opacity: 0.25 },
  { color: 0x00ff00, startFrom: 0.8, width: 12, opacity: 1 },
];

describe("buildStripeLut", () => {
  it("is 256 RGBA entries", () => {
    expect(buildStripeLut(STRIPES).length).toBe(256 * 4);
  });
  it("maps a low value to band 0, a high value to band 1, packing width x2", () => {
    const lut = buildStripeLut(STRIPES);
    // v=0 → band 0 (black, width 4 → alpha 8)
    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([0, 0, 0, 8]);
    // v=255 (t=1.0) → band 1 (ff8833, width 8 → alpha 16)
    const i = 255 * 4;
    expect([lut[i], lut[i + 1], lut[i + 2], lut[i + 3]]).toEqual([0xff, 0x88, 0x33, 16]);
  });
  it("packs half-pixel widths without rounding away the fraction", () => {
    const lut = buildStripeLut([{ color: 0x123456, startFrom: 0, width: 0.5, opacity: 1 }]);
    expect(lut[3]).toBe(Math.round(0.5 * WIDTH_LUT_SCALE));
  });
  it("the boundary value picks the upper band", () => {
    const lut = buildStripeLut(STRIPES);
    const i = 128 * 4; // 128/255 ≈ 0.502 ≥ 0.5 → band 1
    expect([lut[i], lut[i + 1], lut[i + 2]]).toEqual([0xff, 0x88, 0x33]);
  });
  it("signature changes with the list, stable for equal lists", () => {
    expect(lutSignature(STRIPES)).toBe(lutSignature([...STRIPES]));
    expect(lutSignature(STRIPES)).not.toBe(lutSignature([STRIPES[0]]));
  });
  it("signature changes when only opacity changes", () => {
    expect(lutSignature(STRIPES)).not.toBe(lutSignature(STRIPES.map((s) => ({ ...s, opacity: 0.9 }))));
  });
  it("encodes no stripe below the lowest threshold", () => {
    const lut = buildStripeLut(STRIPES_NO_ZERO);
    // v=0 (t=0.0) is below startFrom=0.2 → [0,0,0,0] (no stripe)
    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([0, 0, 0, 0]);
    // v=255 (t=1.0) → band with highest startFrom (0.8, green, width 12 → alpha 24)
    const i = 255 * 4;
    expect([lut[i], lut[i + 1], lut[i + 2], lut[i + 3]]).toEqual([0, 0xff, 0, 24]);
  });
});

describe("buildStripeOpacityLut", () => {
  it("is 256 RGBA entries, empty list all zero", () => {
    expect(buildStripeOpacityLut(STRIPES).length).toBe(256 * 4);
    expect([...buildStripeOpacityLut([]).slice(0, 8)]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
  it("packs opacity into r, ramp position into g, dot eligibility into b, alpha 255", () => {
    const lut = buildStripeOpacityLut(STRIPES);
    // v=0 → band 0: opacity 1 → 255, rampT 0/(2-1)=0 → 0
    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([255, 0, 255, 255]);
    // v=255 → band 1: opacity 0.5 → 128, rampT 1/(2-1)=1 → 255
    const i = 255 * 4;
    expect([lut[i], lut[i + 1], lut[i + 2], lut[i + 3]]).toEqual([128, 255, 255, 255]);
  });
  it("bands below the lowest threshold pack zero opacity with alpha 255", () => {
    const lut = buildStripeOpacityLut(STRIPES_NO_ZERO);
    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([0, 0, 0, 255]);
    const mid = 128 * 4; // t≈0.502 → band 0 (opacity 0.25 → 64, rampT 0 → 0)
    expect([lut[mid], lut[mid + 1], lut[mid + 2], lut[mid + 3]]).toEqual([64, 0, 255, 255]);
  });
});

describe("stripeDotBandEligibility", () => {
  const rankedStripes = [
    { color: 0x202020, startFrom: 0, width: 4, opacity: 1 },
    { color: 0xf0f0f0, startFrom: 0.25, width: 4, opacity: 1 },
    { color: 0x808080, startFrom: 0.5, width: 4, opacity: 1 },
    { color: 0xffffff, startFrom: 0.75, width: 1.5, opacity: 1 },
  ];

  it("selects the highest source-brightness band first", () => {
    expect(stripeDotBandEligibility(rankedStripes, 0.1)).toEqual([false, false, true, false]);
    expect(stripeDotBandEligibility(rankedStripes, 0.5)).toEqual([false, true, true, false]);
  });

  it("uses band brightness rather than the displayed palette color", () => {
    const paletteStripes = [
      { color: 0xffffff, startFrom: 0, width: 4, opacity: 1 },
      { color: 0x602000, startFrom: 0.5, width: 4, opacity: 1 },
    ];
    expect(stripeDotBandEligibility(paletteStripes, 0.1)).toEqual([false, true]);
  });

  it("selects none at zero density and all eligible stripes at full density", () => {
    expect(stripeDotBandEligibility(rankedStripes, 0)).toEqual([false, false, false, false]);
    expect(stripeDotBandEligibility(rankedStripes, 1)).toEqual([true, true, true, false]);
  });
});
