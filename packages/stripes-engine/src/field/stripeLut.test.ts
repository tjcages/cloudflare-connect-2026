import { describe, it, expect } from "vitest";
import { buildStripeLut, lutSignature } from "./stripeLut";

const STRIPES = [
  { color: 0x000000, startFrom: 0.0, width: 4 },
  { color: 0xff8833, startFrom: 0.5, width: 8 },
];

describe("buildStripeLut", () => {
  it("is 256 RGBA entries", () => {
    expect(buildStripeLut(STRIPES).length).toBe(256 * 4);
  });
  it("maps a low value to band 0, a high value to band 1", () => {
    const lut = buildStripeLut(STRIPES);
    // v=0 → band 0 (black, width 4)
    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([0, 0, 0, 4]);
    // v=255 (t=1.0) → band 1 (ff8833, width 8)
    const i = 255 * 4;
    expect([lut[i], lut[i + 1], lut[i + 2], lut[i + 3]]).toEqual([0xff, 0x88, 0x33, 8]);
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
});
