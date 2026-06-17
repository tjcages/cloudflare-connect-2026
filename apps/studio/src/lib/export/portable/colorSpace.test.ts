import { describe, expect, it } from "vitest";
import { buildStripeColors, resolveStripeRgb } from "../../../playground/stripeColors";
import { bandUniformRgb } from "./colorSpace";

describe("export stripe uniforms", () => {
  it("matches playground P3→sRGB conversion for the default stripe ramp", () => {
    const colors = buildStripeColors();

    for (const stripe of colors.stripes) {
      const playground = resolveStripeRgb(stripe, true);
      const exported = bandUniformRgb(stripe.hex, stripe.p3Css, true);
      expect(exported[0]).toBeCloseTo(playground[0], 4);
      expect(exported[1]).toBeCloseTo(playground[1], 4);
      expect(exported[2]).toBeCloseTo(playground[2], 4);
    }
  });
});
