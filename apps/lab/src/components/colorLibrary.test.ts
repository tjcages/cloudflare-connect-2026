import { describe, expect, it } from "vitest";
import {
  COLOR_LIBRARY,
  findLibraryColor,
  findLibraryColorByHex,
  LIBRARY_COLOR,
  nextOrangeRedLibraryHex,
  orangeRedHotspotLibraryHexes,
  p3ColorForHex,
} from "./colorLibrary";

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
      const expectedLabels =
        groupName === "Orange"
          ? EXPECTED_LABELS.map((label) => (label === "700" ? "700 [Brand]" : label))
          : EXPECTED_LABELS;
      expect(group?.colors.map((color) => color.label)).toEqual(expectedLabels);
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
    expect(token("700 [Brand]")).toEqual({
      label: "700 [Brand]",
      hex: "#f77720",
      p3: "color(display-p3 0.968627 0.466667 0.12549)",
      oklch: undefined,
    });
    expect(p3ColorForHex("#f46021")).toBe("color(display-p3 0.956863 0.376471 0.129412)");
  });

  it("exposes Twizzler library aliases that resolve to real tokens", () => {
    expect(findLibraryColor("Orange", "900 [Accent]")?.hex).toBe(LIBRARY_COLOR.orangeAccent);
    expect(findLibraryColor("Orange", "800 [Pair]")?.hex).toBe(LIBRARY_COLOR.orangePair);
    expect(findLibraryColor("Orange", "700 [Brand]")?.hex).toBe(LIBRARY_COLOR.orangeBrand);
    expect(findLibraryColor("Orange", "1000")?.hex).toBe(LIBRARY_COLOR.orangeDeep);
    expect(findLibraryColor("Red", "900 [Accent]")?.hex).toBe(LIBRARY_COLOR.redAccent);
    expect(findLibraryColor("Neutral", "White")?.hex).toBe(LIBRARY_COLOR.white);
    expect(findLibraryColor("Neutral", "11")?.hex).toBe(LIBRARY_COLOR.graphite);
  });

  it("resolves hex values to variable token names", () => {
    expect(findLibraryColorByHex("#f46021")).toEqual({
      group: "Orange",
      label: "900 [Accent]",
      hex: "#f46021",
      token: "Orange / 900 [Accent]",
    });
    expect(findLibraryColorByHex("#FFFFFF")?.token).toBe("Neutral / White");
    expect(findLibraryColorByHex("#f86a00")).toBeNull();
  });

  it("picks unused Orange/Red library hexes for new hotspots", () => {
    expect(nextOrangeRedLibraryHex([])).toBe("#fea700");
    expect(nextOrangeRedLibraryHex(["#fea700", "#f46021"])).toBe("#f77720");
    expect(nextOrangeRedLibraryHex(["#fea700", "#f46021", "#f77720"])).toBe("#e92e28");
    const palette = orangeRedHotspotLibraryHexes();
    expect(
      palette.every(
        (hex) => findLibraryColorByHex(hex)?.group === "Orange" || findLibraryColorByHex(hex)?.group === "Red",
      ),
    ).toBe(true);
    expect(nextOrangeRedLibraryHex(palette)).toBe(palette[0]);
  });
});
