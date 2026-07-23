import { describe, expect, it } from "vitest";
import { COLOR_LIBRARY, p3ColorForHex } from "./colorLibrary";

const EXPECTED_PALETTE_TOKENS = [
  "0",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800-Pair",
  "900-Accent",
  "1000",
  "1100",
  "1200",
  "1300",
  "1400",
  "1500",
];

describe("color library", () => {
  it("exposes the complete P3 OKLCH token scale for every chromatic palette", () => {
    const palettes = COLOR_LIBRARY.filter((group) => group.name !== "Neutral");

    expect(palettes.map((group) => group.name)).toEqual(["Red", "Orange", "Green", "Blue", "Purple"]);
    for (const palette of palettes) {
      expect(palette.colors.map((color) => color.label)).toEqual(EXPECTED_PALETTE_TOKENS);
      expect(palette.colors.every((color) => color.p3?.startsWith("color(display-p3 "))).toBe(true);
      expect(palette.colors.every((color) => color.oklch?.startsWith("oklch("))).toBe(true);
    }
  });

  it("keeps the supplied Orange 700 token and its P3 lookup in sync", () => {
    const orange700 = COLOR_LIBRARY.find((group) => group.name === "Orange")?.colors.find(
      (color) => color.label === "700",
    );

    expect(orange700).toEqual({
      label: "700",
      hex: "#f27235",
      p3: "color(display-p3 0.95 0.4488 0.2071)",
      oklch: "oklch(0.708 0.206 42.151)",
    });
    expect(p3ColorForHex("#f27235")).toBe("color(display-p3 0.95 0.4488 0.2071)");
  });

  it("uses the revised Red, Green, and Blue tokens", () => {
    const token = (groupName: string, label: string) =>
      COLOR_LIBRARY.find((group) => group.name === groupName)?.colors.find((color) => color.label === label);

    expect(token("Red", "700")).toMatchObject({
      hex: "#e65543",
      p3: "color(display-p3 0.9035 0.3335 0.2631)",
      oklch: "oklch(0.655 0.218 29.029)",
    });
    expect(token("Green", "300")).toMatchObject({
      hex: "#c3ed9f",
      oklch: "oklch(0.892 0.129 134.413)",
    });
    expect(token("Green", "400")).toMatchObject({
      hex: "#a6e186",
      oklch: "oklch(0.842 0.16 138.263)",
    });
    expect(token("Green", "500")).toMatchObject({
      hex: "#87d36e",
      oklch: "oklch(0.786 0.186 141.723)",
    });
    expect(token("Blue", "800-Pair")).toMatchObject({
      hex: "#6dceff",
      p3: "color(display-p3 0.4276 0.8082 0.9999)",
      oklch: "oklch(0.806 0.139 226.453)",
    });
  });
});
