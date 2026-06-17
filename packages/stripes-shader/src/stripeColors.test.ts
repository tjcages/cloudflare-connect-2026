import { describe, expect, it } from "vitest";
import {
  addStripe,
  buildStripeColors,
  cloneDefaultOverlayStripes,
  cloneDefaultStripes,
  DEFAULT_OVERLAY_STRIPES,
  DEFAULT_STRIPES,
  displayP3CssToHex,
  hexToDisplayP3Css,
  normalizeStripe,
  removeStripe,
  resolveActivePlaygroundStripes,
  resolvePlaygroundPixiTint,
  resolveStripeIndices,
  resolveStripeRgb,
  resolveStripesForLuminanceMode,
  stripeColorFromHexPicker,
  STRIPE_WIDTH_STORAGE_MAX,
  stripeIndexForLuminance,
  updateStripe,
} from "./stripeColors";

describe("DEFAULT_STRIPES", () => {
  it("ramps gray (darkest) up to the loud orange (brightest) by ascending startFrom", () => {
    expect(DEFAULT_STRIPES.map((s) => s.hex)).toEqual([
      "#F3F3F3",
      "#FADA98",
      "#F8BD70",
      "#F69E4D",
      "#F27C33",
      "#EB5729",
    ]);
    const starts = DEFAULT_STRIPES.map((s) => s.startFrom);
    expect([...starts]).toEqual([...starts].sort((a, b) => a - b));
    // Orangest color sits at the brightest threshold.
    expect(DEFAULT_STRIPES[DEFAULT_STRIPES.length - 1]!.startFrom).toBe(0.9);
  });

  it("derives display-p3 css from each hex", () => {
    expect(DEFAULT_STRIPES[0]!.p3Css).toContain("display-p3");
  });
});

describe("stripeIndexForLuminance", () => {
  const stripes = cloneDefaultStripes();

  it("returns background below the lowest threshold", () => {
    expect(stripeIndexForLuminance(0.05, stripes)).toBe(0);
  });

  it("returns the stripe with the greatest startFrom not exceeding the luminance", () => {
    // thresholds: 0.12, 0.28, 0.44, 0.6, 0.76, 0.9
    expect(stripeIndexForLuminance(0.12, stripes)).toBe(1);
    expect(stripeIndexForLuminance(0.27, stripes)).toBe(1);
    expect(stripeIndexForLuminance(0.28, stripes)).toBe(2);
    expect(stripeIndexForLuminance(0.95, stripes)).toBe(6);
  });

  it("is order-independent (picks highest qualifying threshold)", () => {
    const shuffled = [stripes[2]!, stripes[0]!, stripes[5]!];
    // startFroms: 0.44, 0.12, 0.9 -> luminance 0.5 picks the 0.44 stripe (list position 0 -> index 1)
    expect(stripeIndexForLuminance(0.5, shuffled)).toBe(1);
    expect(stripeIndexForLuminance(0.95, shuffled)).toBe(3);
  });
});

describe("resolveStripeIndices", () => {
  it("buckets a luminance grid via the threshold LUT", () => {
    const stripes = cloneDefaultStripes();
    const luma = new Uint8Array([0, Math.round(0.3 * 255), 255]);
    expect(Array.from(resolveStripeIndices(luma, stripes))).toEqual([0, 2, 6]);
  });
});

describe("hex <-> display-p3", () => {
  it("derives p3 css from a hex using the same channel values", () => {
    expect(hexToDisplayP3Css("#EB5729")).toBe("color(display-p3 0.9216 0.3412 0.1608)");
  });

  it("maps a display-p3 string back to an sRGB hex (neutral grays round-trip)", () => {
    expect(displayP3CssToHex(hexToDisplayP3Css("#808080"))).toBe("#808080");
  });

  it("stripeColorFromHexPicker syncs hex and p3Css for color pickers", () => {
    expect(stripeColorFromHexPicker("#ff0000")).toEqual({
      hex: "#ff0000",
      p3Css: "color(display-p3 1 0 0)",
    });
  });

  it("normalizeStripe refreshes p3Css when hex changes without an explicit p3Css patch", () => {
    const stale = normalizeStripe({ hex: "#000000", p3Css: "color(display-p3 0 0 0)" });
    const next = normalizeStripe({ ...stale, hex: "#ff0000" });
    expect(next.p3Css).toBe("color(display-p3 1 0 0)");
  });

  it("resolveStripeRgb always derives display-p3 from hex when preferP3 is true", () => {
    const stripe = normalizeStripe({ hex: "#808080", p3Css: "color(display-p3 1 0 0)" });
    expect(resolveStripeRgb(stripe, true)).toEqual(
      resolveStripeRgb({ ...stripe, p3Css: hexToDisplayP3Css("#808080") }, true),
    );
  });

  it("resolvePlaygroundPixiTint leaves color unchanged when preferP3 is false", () => {
    expect(resolvePlaygroundPixiTint(0xff8040, false)).toBe(0xff8040);
  });
});

describe("stripe list editing", () => {
  it("adds, updates, and removes stripes immutably", () => {
    const base = buildStripeColors();
    const added = addStripe(base);
    expect(added.stripes.length).toBe(base.stripes.length + 1);

    const firstId = base.stripes[0]!.id;
    const updated = updateStripe(base, firstId, { startFrom: 0.42, width: 5 });
    expect(updated.stripes[0]!.startFrom).toBe(0.42);
    expect(updated.stripes[0]!.width).toBe(5);
    expect(base.stripes[0]!.startFrom).not.toBe(0.42);

    const removed = removeStripe(base, firstId);
    expect(removed.stripes.find((s) => s.id === firstId)).toBeUndefined();
  });

  it("clamps width and startFrom on update", () => {
    const base = buildStripeColors();
    const id = base.stripes[0]!.id;
    const clamped = updateStripe(base, id, { startFrom: 5, width: 99 });
    expect(clamped.stripes[0]!.startFrom).toBe(1);
    // Width stores up to the encode ceiling so wide cells can carry thick stripes;
    // the shader clamps the drawn thickness to the actual cell size.
    expect(clamped.stripes[0]!.width).toBe(STRIPE_WIDTH_STORAGE_MAX);
  });
});

describe("DEFAULT_OVERLAY_STRIPES", () => {
  it("contains the three loudest default colors with ascending thresholds", () => {
    expect(DEFAULT_OVERLAY_STRIPES.map((stripe) => stripe.hex)).toEqual(["#F69E4D", "#F27C33", "#EB5729"]);
    expect(DEFAULT_OVERLAY_STRIPES.map((stripe) => stripe.startFrom)).toEqual([0.6, 0.76, 0.9]);
  });

  it("clones into an editable list", () => {
    const cloned = cloneDefaultOverlayStripes();
    expect(cloned).toHaveLength(3);
    expect(cloned[0]!.hex).toBe("#F69E4D");
    cloned[0]!.hex = "#000000";
    expect(DEFAULT_OVERLAY_STRIPES[0]!.hex).toBe("#F69E4D");
  });
});

describe("resolveStripesForLuminanceMode", () => {
  it("returns luminance stripes unchanged", () => {
    const colors = buildStripeColors(cloneDefaultStripes());
    expect(resolveStripesForLuminanceMode(colors, "luminance")).toEqual(colors.stripes);
  });

  it("returns overlay stripes unchanged", () => {
    const colors = buildStripeColors(cloneDefaultOverlayStripes());
    expect(resolveStripesForLuminanceMode(colors, "overlay")).toEqual(colors.stripes);
  });

  it("fills missing colors-mode widths from defaults", () => {
    const colors = buildStripeColors([{ ...cloneDefaultStripes()[0]!, width: undefined as unknown as number }]);
    const resolved = resolveStripesForLuminanceMode(colors, "colors");
    expect(resolved[0]!.width).toBe(5);
  });
});

describe("resolveActivePlaygroundStripes", () => {
  it("selects overlay stripes only in overlay mode", () => {
    const stripes = cloneDefaultStripes();
    const overlayStripes = cloneDefaultOverlayStripes();
    expect(resolveActivePlaygroundStripes("luminance", stripes, overlayStripes)).toBe(stripes);
    expect(resolveActivePlaygroundStripes("colors", stripes, overlayStripes)).toBe(stripes);
    expect(resolveActivePlaygroundStripes("overlay", stripes, overlayStripes)).toBe(overlayStripes);
  });
});
