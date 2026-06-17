import { describe, expect, it } from "vitest";
import {
  displayP3ToSrgb,
  hexToRgb01,
  parseDisplayP3Css,
  resolveFillRgb,
  stripeFillFromAccent,
  supportsDisplayP3,
} from "./colorSpace";
import { ACCENT_LAVA } from "./accents";

describe("parseDisplayP3Css", () => {
  it("parses display-p3 triplets", () => {
    expect(parseDisplayP3Css(ACCENT_LAVA.displayP3)).toEqual([0.9216, 0.3412, 0.1608]);
  });

  it("returns white for invalid input", () => {
    expect(parseDisplayP3Css("not-a-color")).toEqual([1, 1, 1]);
  });
});

describe("resolveFillRgb", () => {
  it("uses srgb when P3 is not preferred", () => {
    const fill = stripeFillFromAccent(ACCENT_LAVA);
    expect(resolveFillRgb(fill, false)).toEqual(fill.srgb);
  });

  it("converts displayP3 to sRGB for filter uniforms when preferred", () => {
    const fill = stripeFillFromAccent(ACCENT_LAVA);
    const converted = resolveFillRgb(fill, true);
    expect(converted).toEqual(displayP3ToSrgb(fill.displayP3));
    expect(converted).not.toEqual(fill.srgb);
  });
});

describe("displayP3ToSrgb", () => {
  it("maps Lava P3 to a different gamma-encoded sRGB triplet than hex", () => {
    const p3 = parseDisplayP3Css(ACCENT_LAVA.displayP3);
    const srgb = displayP3ToSrgb(p3);
    expect(srgb).not.toEqual(hexToRgb01(ACCENT_LAVA.hex));
  });
});

describe("supportsDisplayP3", () => {
  it("returns a boolean without throwing", () => {
    expect(typeof supportsDisplayP3()).toBe("boolean");
  });
});
