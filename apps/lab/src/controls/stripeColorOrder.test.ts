import { describe, expect, it } from "vitest";
import type { EditableStripe } from "./stripeAdapter";
import { reverseStripeColors } from "./stripeColorOrder";

describe("stripe color order transforms", () => {
  it("reverses only color order while preserving threshold and width order", () => {
    const stripes: EditableStripe[] = [
      { id: "a", hex: "#111111", startFrom: 0.1, width: 1, opacity: 1 },
      { id: "b", hex: "#222222", startFrom: 0.4, width: 2, opacity: 0.5 },
      { id: "c", hex: "#333333", startFrom: 0.8, width: 3, opacity: 0.25 },
    ];

    expect(reverseStripeColors(stripes)).toEqual([
      { id: "a", hex: "#333333", startFrom: 0.1, width: 1, opacity: 1 },
      { id: "b", hex: "#222222", startFrom: 0.4, width: 2, opacity: 0.5 },
      { id: "c", hex: "#111111", startFrom: 0.8, width: 3, opacity: 0.25 },
    ]);
  });

  it("does not mutate the input", () => {
    const stripes: EditableStripe[] = [
      { id: "a", hex: "#111111", startFrom: 0.1, width: 1, opacity: 1 },
      { id: "b", hex: "#222222", startFrom: 0.4, width: 2, opacity: 1 },
    ];

    reverseStripeColors(stripes);

    expect(stripes.map((stripe) => stripe.hex)).toEqual(["#111111", "#222222"]);
  });
});
