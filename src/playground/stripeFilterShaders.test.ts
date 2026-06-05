import { describe, expect, it } from "vitest";
import { STRIPE_FILTER_FRAGMENT, STRIPE_FILTER_VERTEX } from "./stripeFilterShaders";

describe("STRIPE_FILTER_FRAGMENT", () => {
  it("keeps non-stripe shader output transparent for CSS canvas backgrounds", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("vec4(0.0, 0.0, 0.0, 0.0)");
    expect(STRIPE_FILTER_FRAGMENT).not.toContain("finalColor = vec4(1.0, 1.0, 1.0, 1.0)");
  });

  it("premultiplies stripe coverage so anti-aliased edges do not fringe", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("vec4(stripeColor * stripeCoverage, stripeCoverage)");
    expect(STRIPE_FILTER_FRAGMENT).not.toContain("vec4(stripeColor, stripeCoverage)");
  });

  it("maps stripe grid indices from filter quad position instead of texture UVs", () => {
    expect(STRIPE_FILTER_VERTEX).toContain("vDisplayCoord = aPosition");
    expect(STRIPE_FILTER_FRAGMENT).toContain("vec2 pixelCoord = vDisplayCoord * uPixelSize");
    expect(STRIPE_FILTER_FRAGMENT).not.toContain("vec2 pixelCoord = vTextureCoord * uPixelSize");
  });
});
