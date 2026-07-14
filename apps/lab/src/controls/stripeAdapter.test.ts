import { describe, it, expect } from "vitest";
import { toEditable, fromEditable } from "./stripeAdapter";
import type { Stripe } from "@necatikcl/stripes-engine";

describe("stripeAdapter", () => {
  it("round-trips color, startFrom, and width", () => {
    const stripes: Stripe[] = [
      { color: 0xeb5729, startFrom: 0.9, width: 5, opacity: 1 },
      { color: 0x000000, startFrom: 0, width: 1, opacity: 0.5 },
      { color: 0xffffff, startFrom: 0.5, width: 64, opacity: 0 },
    ];

    const roundTripped = fromEditable(toEditable(stripes));

    expect(roundTripped).toEqual(stripes);
  });

  it("toEditable uses string index as id", () => {
    const stripes: Stripe[] = [
      { color: 0xeb5729, startFrom: 0.9, width: 5, opacity: 1 },
      { color: 0xfada98, startFrom: 0.28, width: 1, opacity: 1 },
    ];
    const editable = toEditable(stripes);
    expect(editable[0].id).toBe("0");
    expect(editable[1].id).toBe("1");
  });

  it("toEditable produces correct hex strings", () => {
    const stripes: Stripe[] = [{ color: 0xeb5729, startFrom: 0.9, width: 5, opacity: 1 }];
    const editable = toEditable(stripes);
    expect(editable[0].hex).toBe("#eb5729");
  });

  it("fromEditable handles hex without leading #", () => {
    const rows = [{ id: "0", hex: "eb5729", startFrom: 0.9, width: 5, opacity: 1 }];
    const result = fromEditable(rows);
    expect(result[0].color).toBe(0xeb5729);
  });

  it("fromEditable falls back to 0 for invalid hex", () => {
    const rows = [{ id: "0", hex: "notahex", startFrom: 0, width: 1, opacity: 1 }];
    const result = fromEditable(rows);
    expect(result[0].color).toBe(0);
  });
});
