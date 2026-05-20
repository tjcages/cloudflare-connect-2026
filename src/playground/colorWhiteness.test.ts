import { describe, expect, it } from "vitest";
import { isIgnoredBgPixel, pixelWhiteness, whitenessDeficitFromBg } from "./colorWhiteness";

const WHITE_BG = 0.98;

describe("colorWhiteness", () => {
  it("treats near-white video pixels as background", () => {
    expect(isIgnoredBgPixel(250, 252, 255, WHITE_BG, 0.08)).toBe(true);
    expect(isIgnoredBgPixel(255, 255, 255, WHITE_BG, 0.08)).toBe(true);
  });

  it("gives blue a high whiteness deficit vs white reference", () => {
    const blueDeficit = whitenessDeficitFromBg(40, 90, 220, WHITE_BG);
    const whiteDeficit = whitenessDeficitFromBg(250, 252, 255, WHITE_BG);
    expect(blueDeficit).toBeGreaterThan(0.3);
    expect(whiteDeficit).toBeLessThan(0.05);
  });

  it("ranks blue min channel below white", () => {
    expect(pixelWhiteness(40, 90, 220)).toBeLessThan(pixelWhiteness(255, 255, 255));
  });
});
