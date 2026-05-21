import { describe, expect, it } from "vitest";
import { widthPxFromBand } from "./stripeGridConstants";

describe("widthPxFromBand", () => {
  it("maps bands 1–5 to 1–5px stripe widths", () => {
    expect(widthPxFromBand(1)).toBe(1);
    expect(widthPxFromBand(2)).toBe(2);
    expect(widthPxFromBand(3)).toBe(3);
    expect(widthPxFromBand(4)).toBe(4);
    expect(widthPxFromBand(5)).toBe(5);
  });
});
