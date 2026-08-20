import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { badgeMarkFill, badgeSwatchColors, findBadgeTheme, hexLuma } from "./badge-themes";

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

  it("builds a four-stop metallic swatch from the theme tokens", () => {
    const blue = findBadgeTheme("blue");
    const stops = badgeSwatchColors(blue);
    expect(stops).toHaveLength(4);
    expect(stops[0]).toBe(blue.deep);
    expect(stops[1]).toBe(blue.accent);
    expect(stops[3]).toBe(blue.pair);
    expect(new Set(stops).size).toBeGreaterThan(1);
  });

  it("drives the color dots with an animated liquid mesh", () => {
    const swatch = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgeThemeSwatch.tsx"
      ),
      "utf8"
    );
    expect(swatch).toContain('from "modgrad"');
    expect(swatch).toContain('variant="liquid"');
    expect(swatch).toContain("animate");
    expect(swatch).toContain("grain");
  });
});
