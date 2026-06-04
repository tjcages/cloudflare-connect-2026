import { describe, expect, it } from "vitest";
import { decodeStripeIndex, encodeStripeIndex, STRIPE_INDEX_MAX } from "./stripeGridConstants";

describe("stripe index encoding", () => {
  it("stores the stripe index directly in the byte range", () => {
    expect(encodeStripeIndex(0)).toBe(0);
    expect(encodeStripeIndex(1)).toBe(1);
    expect(encodeStripeIndex(6)).toBe(6);
    expect(encodeStripeIndex(STRIPE_INDEX_MAX + 10)).toBe(STRIPE_INDEX_MAX);
  });

  it("round-trips through decode", () => {
    for (const index of [0, 1, 5, 42, 255]) {
      expect(decodeStripeIndex(encodeStripeIndex(index))).toBe(index);
    }
  });

  it("treats negative input as background", () => {
    expect(encodeStripeIndex(-3)).toBe(0);
  });
});
