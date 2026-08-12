import { describe, expect, it } from "vitest";
import { COLOR_LIBRARY, findLibraryColor, LIBRARY_COLOR, p3ColorForHex } from "./colorLibrary";

const CHROMATIC_GROUPS = ["Red", "Orange", "Green", "Blue", "Purple"];
const EXPECTED_LABELS = [
  "0",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800 [Pair]",
  "900 [Accent]",
  "1000",
  "1100",
  "1200",
  "1300",
  "1400",
  "1500",
];

describe("color library", () => {
  it("matches the Figma Accent Light palette order and P3 metadata", () => {
    for (const groupName of CHROMATIC_GROUPS) {
      const group = COLOR_LIBRARY.find((candidate) => candidate.name === groupName);
      expect(group?.colors.map((color) => color.label)).toEqual(EXPECTED_LABELS);
      expect(group?.colors).toHaveLength(16);

      for (const color of group?.colors ?? []) {
        expect(color.p3).toMatch(/^color\(display-p3 /);
        expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("uses the exact Figma Orange Accent Light tokens", () => {
    const orange = COLOR_LIBRARY.find((group) => group.name === "Orange");
    const token = (label: string) => orange?.colors.find((color) => color.label === label);

    expect(token("900 [Accent]")).toEqual({
      label: "900 [Accent]",
      hex: "#f46021",
      p3: "color(display-p3 0.956863 0.376471 0.129412)",
      oklch: undefined,
    });
    expect(token("800 [Pair]")).toMatchObject({
      hex: "#fea700",
      p3: "color(display-p3 0.996078 0.654902 0)",
    });
    expect(p3ColorForHex("#f46021")).toBe("color(display-p3 0.956863 0.376471 0.129412)");
  });

  it("exposes Twizzler library aliases that resolve to real tokens", () => {
    expect(findLibraryColor("Orange", "900 [Accent]")?.hex).toBe(LIBRARY_COLOR.orangeAccent);
    expect(findLibraryColor("Orange", "800 [Pair]")?.hex).toBe(LIBRARY_COLOR.orangePair);
    expect(findLibraryColor("Orange", "1000")?.hex).toBe(LIBRARY_COLOR.orangeDeep);
    expect(findLibraryColor("Neutral", "White")?.hex).toBe(LIBRARY_COLOR.white);
    expect(findLibraryColor("Neutral", "11")?.hex).toBe(LIBRARY_COLOR.graphite);
  });
});
