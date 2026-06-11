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

  it("scales stripe edge fade with renderer resolution and caps it for thin stripes", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("uniform float uScreenScale");
    expect(STRIPE_FILTER_FRAGMENT).toContain("0.5 / screenScale");
    expect(STRIPE_FILTER_FRAGMENT).not.toContain("smoothstep(0.0, 0.75, dist)");
  });

  it("supports compositing stripes over the source texture in overlay mode", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("uniform float uTextureUnderlay");
    expect(STRIPE_FILTER_FRAGMENT).toContain("mix(texturePixel.rgb, stripeColor, stripeCoverage)");
    expect(STRIPE_FILTER_FRAGMENT).toContain("finalColor = vec4(texturePixel.rgb, texturePixel.a)");
  });

  it("promotes stripe bands from cell-aligned flame luminance before drawing stripes", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("uniform sampler2D uFlames");
    expect(STRIPE_FILTER_FRAGMENT).toContain("uniform sampler2D uStripeIndexLut");
    expect(STRIPE_FILTER_FRAGMENT).toContain("resolveStripeBand");
    expect(STRIPE_FILTER_FRAGMENT).not.toContain("mergeFlameColor");
  });
});
