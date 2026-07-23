import { describe, expect, it } from "vitest";
import { COLOR_LIBRARY } from "../components/colorLibrary";
import type { EditableStripe } from "./stripeAdapter";
import { applyStripePalette, detectStripePalette, mapPaletteColor, shuffleStripePalette } from "./stripePalette";

function color(groupName: string, label: string): string {
  const hex = COLOR_LIBRARY.find((group) => group.name === groupName)?.colors.find(
    (c) => c.label.match(/^\d+/)?.[0] === label,
  )?.hex;
  if (!hex) throw new Error(`Missing ${groupName} ${label}`);
  return hex;
}

describe("stripe palette mapping", () => {
  it("builds named palettes in fixed token order without using the Pair color", () => {
    const stripes: EditableStripe[] = Array.from({ length: 9 }, (_, index) => ({
      id: String(index),
      hex: "#000000",
      startFrom: index / 9,
      width: index + 1,
      opacity: 0.5,
    }));

    const mapped = applyStripePalette(stripes, "Orange");

    expect(mapped.map((stripe) => stripe.hex)).toEqual([
      color("Neutral", "1"),
      color("Orange", "100"),
      color("Orange", "200"),
      color("Orange", "300"),
      color("Orange", "400"),
      color("Orange", "500"),
      color("Orange", "600"),
      color("Orange", "700"),
      color("Orange", "900"),
    ]);
    expect(mapped.map((stripe) => stripe.hex)).not.toContain(color("Orange", "800"));
    expect(mapped.map((stripe) => stripe.opacity)).toEqual(Array(mapped.length).fill(1));
    expect(detectStripePalette(mapped)).toBe("Orange");
  });

  it("starts at Neutral 1 and ends at 900 when the stripe count differs from the token count", () => {
    const stripes: EditableStripe[] = Array.from({ length: 10 }, (_, index) => ({
      id: String(index),
      hex: color("Orange", "1000"),
      startFrom: 0.1 + index * 0.05,
      width: 0.5 + index * 0.5,
      opacity: 0.5,
    }));

    const mapped = applyStripePalette(stripes, "Blue", "#ffffff");

    expect(mapped[0].hex).toBe(color("Neutral", "1"));
    expect(mapped[mapped.length - 1].hex).toBe(color("Blue", "900"));
    expect(mapped.slice(0, 9).map((stripe) => stripe.hex)).toEqual([
      color("Neutral", "1"),
      color("Blue", "100"),
      color("Blue", "200"),
      color("Blue", "300"),
      color("Blue", "400"),
      color("Blue", "500"),
      color("Blue", "600"),
      color("Blue", "700"),
      color("Blue", "900"),
    ]);
    expect(mapped.map((stripe) => stripe.hex)).not.toContain(color("Blue", "800"));
    expect(mapped.map((stripe) => stripe.opacity)).toEqual(Array(10).fill(1));
    expect(mapped.map((stripe) => stripe.startFrom)).toEqual(stripes.map((stripe) => stripe.startFrom));
    expect(mapped.map((stripe) => stripe.width)).toEqual(stripes.map((stripe) => stripe.width));
    expect(detectStripePalette(mapped, "#ffffff")).toBe("Blue");
  });

  it("does not apply background-ramp settings to named palettes", () => {
    const stripes: EditableStripe[] = Array.from({ length: 6 }, (_, index) => ({
      id: String(index),
      hex: "#000000",
      startFrom: index / 6,
      width: index + 1,
      opacity: 1,
    }));
    const baseline = applyStripePalette(stripes, "Orange", undefined, "linear", {
      brightnessAdd: 30,
      hueDriftDeg: 0,
      saturationBoost: 0,
    });
    const adjusted = applyStripePalette(stripes, "Orange", undefined, "linear", {
      brightnessAdd: 60,
      hueDriftDeg: 45,
      saturationBoost: 50,
    });

    expect(baseline[0].hex).toBe(color("Neutral", "1"));
    expect(adjusted[0].hex).toBe(color("Neutral", "1"));
    expect(baseline[baseline.length - 1].hex).toBe(color("Orange", "900"));
    expect(adjusted[adjusted.length - 1].hex).toBe(color("Orange", "900"));
    expect(adjusted.map((stripe) => stripe.hex)).toEqual(baseline.map((stripe) => stripe.hex));
    expect(detectStripePalette(adjusted)).toBe("Orange");
  });

  it("maps Neutral from a light gray to black", () => {
    const stripes: EditableStripe[] = Array.from({ length: 6 }, (_, index) => ({
      id: String(index),
      hex: "#ff0000",
      startFrom: index / 6,
      width: 1,
      opacity: 1,
    }));

    const mapped = applyStripePalette(stripes, "Neutral");

    expect(mapped[0].hex).toBe(color("Neutral", "1"));
    expect(mapped[mapped.length - 1].hex).toBe("#000000");
    expect(mapped.map((stripe) => stripe.hex)).toEqual([
      "#fafafa",
      "#f4f4f4",
      "#ebebeb",
      "#b8b8b8",
      "#292929",
      "#000000",
    ]);
    expect(detectStripePalette(mapped)).toBe("Neutral");
  });

  it("detects a palette from mapped stripe colors", () => {
    const stripes: EditableStripe[] = [
      { id: "1000", hex: color("Purple", "1000"), startFrom: 0.2, width: 1, opacity: 1 },
      { id: "900", hex: color("Purple", "900"), startFrom: 0.32, width: 1, opacity: 1 },
    ];

    expect(detectStripePalette(stripes)).toBe("Purple");
  });

  it("shuffles palette groups while preserving tone levels", () => {
    const stripes: EditableStripe[] = [
      { id: "gray", hex: "#f3f3f3", startFrom: 0.08, width: 1, opacity: 1 },
      { id: "900", hex: color("Orange", "900"), startFrom: 0.2, width: 1, opacity: 1 },
      { id: "800", hex: color("Orange", "800"), startFrom: 0.32, width: 1, opacity: 1 },
    ];
    const values = [0.9, 0.9, 0.9];
    const random = () => values.shift() ?? 0;

    const shuffled = shuffleStripePalette(stripes, random);

    expect(shuffled[0].hex).toBe(color("Purple", "1000"));
    expect(shuffled[1].hex).toBe(color("Purple", "900"));
    expect(shuffled[2].hex).toBe(color("Purple", "700"));
    expect(shuffled.map((stripe) => stripe.hex)).not.toContain(color("Purple", "800"));
  });

  it("maps a single palette-token color to the same level in another group", () => {
    expect(mapPaletteColor(color("Orange", "900"), "Purple")).toBe(color("Purple", "900"));
    expect(mapPaletteColor(color("Orange", "800"), "Purple")).toBe(color("Purple", "800"));
  });

  it("adds a white eased opacity palette without changing threshold or width", () => {
    const stripes: EditableStripe[] = [
      { id: "a", hex: color("Orange", "1000"), startFrom: 0.2, width: 1, opacity: 1 },
      { id: "b", hex: color("Orange", "900"), startFrom: 0.32, width: 1.5, opacity: 1 },
      { id: "c", hex: color("Orange", "800"), startFrom: 0.44, width: 2, opacity: 1 },
    ];

    const mapped = applyStripePalette(stripes, "White");

    expect(mapped.map((stripe) => stripe.hex)).toEqual(["#ffffff", "#ffffff", "#ffffff"]);
    expect(mapped.map((stripe) => stripe.opacity)).toEqual([0, 0.35, 0.7]);
    expect(mapped.map((stripe) => stripe.startFrom)).toEqual([0.2, 0.32, 0.44]);
    expect(mapped.map((stripe) => stripe.width)).toEqual([1, 1.5, 2]);
    expect(detectStripePalette(mapped)).toBe("White");
  });

  it("uses the ramp easing curve for white palette opacity", () => {
    const stripes: EditableStripe[] = [
      { id: "a", hex: color("Orange", "1000"), startFrom: 0.2, width: 1, opacity: 1 },
      { id: "b", hex: color("Orange", "900"), startFrom: 0.32, width: 1.5, opacity: 1 },
      { id: "c", hex: color("Orange", "800"), startFrom: 0.44, width: 2, opacity: 1 },
    ];

    const linear = applyStripePalette(stripes, "White", undefined, "linear");
    const easeIn = applyStripePalette(stripes, "White", undefined, "easeInQuad");

    expect(linear.map((stripe) => stripe.opacity)).toEqual([0, 0.35, 0.7]);
    expect(easeIn.map((stripe) => stripe.opacity)).toEqual([0, 0.175, 0.7]);
    expect(detectStripePalette(easeIn, undefined, "easeInQuad")).toBe("White");
  });

  it("adds a background-driven OKLCH ramp palette with full opacity without changing threshold or width", () => {
    const stripes: EditableStripe[] = [
      { id: "a", hex: color("Orange", "1000"), startFrom: 0.2, width: 1, opacity: 0.8 },
      { id: "b", hex: color("Orange", "900"), startFrom: 0.32, width: 1.5, opacity: 0.7 },
      { id: "c", hex: color("Orange", "800"), startFrom: 0.44, width: 2, opacity: 0.6 },
      { id: "d", hex: color("Orange", "700"), startFrom: 0.56, width: 2.5, opacity: 0.5 },
    ];

    const mapped = applyStripePalette(stripes, "Background Ramp", "#5865f2");

    expect(mapped.map((stripe) => stripe.hex)).toHaveLength(4);
    expect(new Set(mapped.map((stripe) => stripe.hex)).size).toBe(4);
    expect(mapped.map((stripe) => stripe.opacity)).toEqual([1, 1, 1, 1]);
    expect(mapped.map((stripe) => stripe.startFrom)).toEqual([0.2, 0.32, 0.44, 0.56]);
    expect(mapped.map((stripe) => stripe.width)).toEqual([1, 1.5, 2, 2.5]);
    expect(detectStripePalette(mapped, "#5865f2")).toBe("Background Ramp");
  });

  it("uses custom easing to shape the background ramp brightness", () => {
    const stripes: EditableStripe[] = [
      { id: "a", hex: color("Orange", "1000"), startFrom: 0.2, width: 1, opacity: 1 },
      { id: "b", hex: color("Orange", "900"), startFrom: 0.32, width: 1.5, opacity: 1 },
      { id: "c", hex: color("Orange", "800"), startFrom: 0.44, width: 2, opacity: 1 },
      { id: "d", hex: color("Orange", "700"), startFrom: 0.56, width: 2.5, opacity: 1 },
    ];

    const linear = applyStripePalette(stripes, "Background Ramp", "#203524", "linear");
    const custom = applyStripePalette(stripes, "Background Ramp", "#203524", "custom:0.9,0,0.95,0.2");

    expect(custom.map((stripe) => stripe.hex)).not.toEqual(linear.map((stripe) => stripe.hex));
    expect(detectStripePalette(custom, "#203524", "custom:0.9,0,0.95,0.2")).toBe("Background Ramp");
  });

  it("keeps background ramp neutral for black and grayscale backgrounds", () => {
    const stripes: EditableStripe[] = [
      { id: "a", hex: color("Orange", "1000"), startFrom: 0.2, width: 1, opacity: 1 },
      { id: "b", hex: color("Orange", "900"), startFrom: 0.32, width: 1.5, opacity: 1 },
      { id: "c", hex: color("Orange", "800"), startFrom: 0.44, width: 2, opacity: 1 },
      { id: "d", hex: color("Orange", "700"), startFrom: 0.56, width: 2.5, opacity: 1 },
    ];

    const mapped = applyStripePalette(stripes, "Background Ramp", "#000000", "linear");

    expect(mapped.map((stripe) => stripe.hex)).toEqual(["#060606", "#222222", "#414141", "#636363"]);
    expect(detectStripePalette(mapped, "#000000", "linear")).toBe("Background Ramp");
  });

  it("leaves non-palette single colors unmapped", () => {
    expect(mapPaletteColor("#f3f3f3", "Purple")).toBeNull();
  });
});
