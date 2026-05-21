import { describe, expect, it } from "vitest";
import type { BlockGrid } from "./computeBlockGrid";
import { buildStripeColors } from "./stripeColors";
import { stripeGridToSvg } from "./stripeGridToSvg";

describe("stripeGridToSvg", () => {
  it("emits display-p3 fills with sRGB fallbacks in a style block", () => {
    const grid: BlockGrid = {
      cols: 1,
      rows: 1,
      bands: new Uint8Array([5]),
    };
    const svg = stripeGridToSvg(grid, buildStripeColors(), 7, 7);

    expect(svg).toContain("display-p3");
    expect(svg).toContain("#FF2C00");
    expect(svg).toContain("#FF7E00");
    expect(svg).toContain("fill-band-5");
    expect(svg).toContain("@supports");
  });
});
