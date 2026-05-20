import { describe, expect, it } from "vitest";
import { smoothBlockGridWidths } from "./stabilizeBlockGrid";
import { STRIPE_WIDTH_MID, STRIPE_WIDTH_NARROW, STRIPE_WIDTH_NONE, STRIPE_WIDTH_WIDE } from "./stripeGridConstants";

describe("smoothBlockGridWidths", () => {
  it("steps width bands by at most one per update", () => {
    const previous = new Uint8Array([STRIPE_WIDTH_NARROW]);
    const next = new Uint8Array([STRIPE_WIDTH_WIDE]);
    expect(smoothBlockGridWidths(next, previous)[0]).toBe(STRIPE_WIDTH_MID);

    const previousWide = new Uint8Array([STRIPE_WIDTH_WIDE]);
    const nextNone = new Uint8Array([STRIPE_WIDTH_NONE]);
    expect(smoothBlockGridWidths(nextNone, previousWide)[0]).toBe(STRIPE_WIDTH_MID);
  });

  it("copies next widths when there is no previous grid", () => {
    const next = new Uint8Array([STRIPE_WIDTH_WIDE]);
    expect(smoothBlockGridWidths(next, undefined)[0]).toBe(STRIPE_WIDTH_WIDE);
  });
});
