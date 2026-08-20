import { describe, expect, it } from "vitest";
import { badgeMarkFill, findBadgeTheme, hexLuma } from "./badge-themes";

describe("badge mark fill", () => {
  it("tints saturated accents onto the SVG", () => {
    const coral = findBadgeTheme("coral-classic");
    expect(hexLuma(coral.accent)).toBeLessThanOrEqual(0.65);
    expect(badgeMarkFill(coral)).toBe(coral.accent);
  });

  it("falls back to the deep token when the accent is too light", () => {
    const light = findBadgeTheme("light");
    expect(hexLuma(light.accent)).toBeGreaterThan(0.65);
    expect(badgeMarkFill(light)).toBe(light.deep);
  });
});
