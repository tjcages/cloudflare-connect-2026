import { describe, expect, it } from "vitest";
import { mergeFlameColorBytes } from "./playgroundFlameComposite";

describe("mergeFlameColorBytes", () => {
  it("returns source when flame cover is zero", () => {
    expect(mergeFlameColorBytes(255, 255, 255, 0, 0, 0, 1)).toEqual({
      r: 255,
      g: 255,
      b: 255,
      hasFlame: false,
    });
  });

  it("replaces white source with flame color at full cover", () => {
    expect(mergeFlameColorBytes(255, 255, 255, 255, 40, 20, 1)).toEqual({
      r: 255,
      g: 40,
      b: 20,
      hasFlame: true,
    });
  });

  it("leaves dark source unchanged when flame is weaker than max()", () => {
    const merged = mergeFlameColorBytes(10, 10, 10, 255, 40, 20, 1);
    expect(merged.r).toBe(255);
    expect(merged.g).toBe(40);
    expect(merged.b).toBe(20);
  });

  it("brightens (never darkens) a bright source under a partial white flame", () => {
    // The flame raster is white drawn over opaque black, so a half-coverage white streak reads
    // as premultiplied gray (128,128,128). Compositing it must add white light, not pull the
    // bright cell down toward gray.
    const merged = mergeFlameColorBytes(230, 230, 230, 128, 128, 128, 1);
    expect(merged.r).toBeGreaterThanOrEqual(230);
    expect(merged.g).toBeGreaterThanOrEqual(230);
    expect(merged.b).toBeGreaterThanOrEqual(230);
  });
});
