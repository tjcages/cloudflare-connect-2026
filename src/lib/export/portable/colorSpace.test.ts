import { describe, expect, it } from "vitest";
import {
  buildStripeColors,
  PLAYGROUND_STRIPE_BAND_HEX,
  PLAYGROUND_STRIPE_BAND_SWATCH_P3,
  stripeColorsToUniformRgb,
} from "../../../playground/stripeColors";
import { bandUniformRgb } from "./colorSpace";

describe("export band uniforms", () => {
  it("matches playground P3→sRGB conversion for default stripe ramp", () => {
    const colors = buildStripeColors();
    const playground = stripeColorsToUniformRgb(colors, true);
    const exported = PLAYGROUND_STRIPE_BAND_HEX.map((hex, index) =>
      bandUniformRgb(hex, PLAYGROUND_STRIPE_BAND_SWATCH_P3[index], true),
    );

    for (let i = 0; i < 5; i++) {
      expect(exported[i][0]).toBeCloseTo(playground[i][0], 4);
      expect(exported[i][1]).toBeCloseTo(playground[i][1], 4);
      expect(exported[i][2]).toBeCloseTo(playground[i][2], 4);
    }
  });
});
