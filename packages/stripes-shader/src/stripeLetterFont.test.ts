import { describe, expect, it } from "vitest";
import { STRIPE_LETTER_CHARSET } from "./stripeLetterFont";

describe("STRIPE_LETTER_CHARSET", () => {
  it("includes uppercase, lowercase, digits, and symbols", () => {
    expect(STRIPE_LETTER_CHARSET).toContain("A");
    expect(STRIPE_LETTER_CHARSET).toContain("z");
    expect(STRIPE_LETTER_CHARSET).toContain("0");
    expect(STRIPE_LETTER_CHARSET).toContain("9");
    expect(STRIPE_LETTER_CHARSET).toContain("@");
    expect(STRIPE_LETTER_CHARSET).toContain("#");
    expect(STRIPE_LETTER_CHARSET).not.toContain(" ");
    expect(STRIPE_LETTER_CHARSET.length).toBe(94);
  });
});
