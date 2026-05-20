import { describe, expect, it } from "vitest";
import { ACCENT_LAVA, ACCENT_SOLAR } from "../theme/accents";
import { buildStripeColors } from "./stripeColors";
import { hexToRgb01 } from "./stripeFilterOptions";

describe("buildStripeColors", () => {
  it("maps 1px to grid stroke and 3px/5px to accent tokens", () => {
    const colors = buildStripeColors("#aabbcc");

    expect(colors.narrow).toEqual(hexToRgb01("#aabbcc"));
    expect(colors.mid).toEqual(hexToRgb01(ACCENT_SOLAR.hex));
    expect(colors.wide).toEqual(hexToRgb01(ACCENT_LAVA.hex));
  });
});
