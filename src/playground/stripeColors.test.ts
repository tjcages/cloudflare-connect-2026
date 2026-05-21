import { describe, expect, it } from "vitest";
import { ACCENT_AMBER, ACCENT_LAVA, ACCENT_SOLAR } from "../theme/accents";
import { buildStripeColors, PLAYGROUND_STRIPE_BAND_HEX } from "./stripeColors";

describe("buildStripeColors", () => {
  it("maps bands 3–5 to Solar, Amber, and Lava theme accents", () => {
    const colors = buildStripeColors();
    expect(colors.bands[2].hex).toBe(ACCENT_SOLAR.hex);
    expect(colors.bands[3].hex).toBe(ACCENT_AMBER.hex);
    expect(colors.bands[4].hex).toBe(ACCENT_LAVA.hex);
  });

  it("keeps neutral gray on bands 1–2", () => {
    expect(PLAYGROUND_STRIPE_BAND_HEX[0]).toBe("#F3F3F3");
    expect(PLAYGROUND_STRIPE_BAND_HEX[1]).toBe("#F3F3F3");
  });

  it("includes display-p3 css on accent bands", () => {
    const colors = buildStripeColors();
    expect(colors.bands[4].displayP3Css).toBe(ACCENT_LAVA.displayP3);
    expect(colors.bands[3].displayP3Css).toBe(ACCENT_AMBER.displayP3);
  });
});
