import { describe, it, expect } from "vitest";
import { clampToMaxTexture, resolveOutputSize, resolveFieldSize, capFieldToTaps } from "./resolution";

describe("resolution", () => {
  it("rounds css × dpr for output size", () => {
    expect(resolveOutputSize(800, 600, 2, 8192)).toEqual({ width: 1600, height: 1200 });
    expect(resolveOutputSize(800, 600, 1.5, 8192)).toEqual({ width: 1200, height: 900 });
  });
  it("clamps to max texture size preserving aspect", () => {
    expect(clampToMaxTexture({ width: 16384, height: 8192 }, 8192)).toEqual({ width: 8192, height: 4096 });
    expect(clampToMaxTexture({ width: 4000, height: 4000 }, 8192)).toEqual({ width: 4000, height: 4000 });
  });
  it("output respects the max texture clamp", () => {
    // 3840 css × 3 dpr = 11520 > 8192 → scaled down, aspect preserved
    const out = resolveOutputSize(3840, 2160, 3, 8192);
    expect(Math.max(out.width, out.height)).toBeLessThanOrEqual(8192);
    expect(out.width / out.height).toBeCloseTo(3840 / 2160, 3);
  });
  it("field size is fieldScale of output, min 1", () => {
    expect(resolveFieldSize({ width: 1600, height: 1200 }, 0.5)).toEqual({ width: 800, height: 600 });
    expect(resolveFieldSize({ width: 1, height: 1 }, 0.1)).toEqual({ width: 1, height: 1 });
  });
  it("caps the field to the tap grid the downsample can read", () => {
    // 440x320 css at dpr 2 with 7px cells: 880x640 output, 63x46 grid.
    expect(capFieldToTaps({ width: 880, height: 640 }, 63, 46, 4)).toEqual({ width: 252, height: 184 });
  });
  it("never upscales a field that is already at or below the cap", () => {
    // The quote runs fieldScale 0.25 on a 1120x1120 output with an 80x80 grid.
    expect(capFieldToTaps({ width: 280, height: 280 }, 80, 80, 4)).toEqual({ width: 280, height: 280 });
  });
  it("keeps at least one texel per axis", () => {
    expect(capFieldToTaps({ width: 8, height: 8 }, 0, 0, 4)).toEqual({ width: 1, height: 1 });
  });
});
