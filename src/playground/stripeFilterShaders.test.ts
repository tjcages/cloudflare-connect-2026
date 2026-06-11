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

  it("declares the cursor trail uniforms", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("uniform sampler2D uCursorTrail;");
    expect(STRIPE_FILTER_FRAGMENT).toContain("uniform sampler2D uCursorTrailPush;");
    expect(STRIPE_FILTER_FRAGMENT).toContain("uniform float uCursorTrailEnabled;");
    expect(STRIPE_FILTER_FRAGMENT).toContain("uniform float uCursorTrailPushEnabled;");
    expect(STRIPE_FILTER_FRAGMENT).toContain("uniform float uCursorTrailPushRange;");
  });

  it("boosts per-cell bucketing luma from the block map G channel without re-inverting", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("float l = srcBlock.g;");
    expect(STRIPE_FILTER_FRAGMENT).not.toContain("bucketingLuma(srcBlock.g)");
  });

  it("applies inverted-mode trail algebra for overlay luminance", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("l *= (1.0 - trailLift);");
    expect(STRIPE_FILTER_FRAGMENT).toContain("l += (1.0 - l) * trailLift;");
  });

  it("gates the brighten by existing content so empty cells never turn white", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("float trailLift = trail.a * smoothstep(0.0, 0.25, presence);");
    expect(STRIPE_FILTER_FRAGMENT).not.toContain("l += (1.0 - l) * trail.a;");
  });

  it("keeps brighten-only trail cells monotonic via the band max policy", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("max(storedBand, trailBand)");
  });

  it("displaces pre-stripe data by whole cells and tears it where the field diverges", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("(push.xy * 255.0 - 128.0) / 127.0 * uCursorTrailPushRange");
    expect(STRIPE_FILTER_FRAGMENT).toContain("vec2 srcPos = vec2(colIndex, rowIndex) + 0.5 - offset;");
    expect(STRIPE_FILTER_FRAGMENT).toContain("float tear = push.z;");
    expect(STRIPE_FILTER_FRAGMENT).toContain("l *= (1.0 - tear);");
    // Stripes are the final process: the fragment coordinate is never warped and rects never move.
    expect(STRIPE_FILTER_FRAGMENT).not.toContain("pixelCoord = clamp(pixelCoord - ");
    expect(STRIPE_FILTER_FRAGMENT).not.toContain("cellPushOffset");
  });

  it("keeps sparse stripes alive under push via content-max footprint sampling", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("vec2 base = floor(srcPos - 0.5);");
    expect(STRIPE_FILTER_FRAGMENT).toContain("if (s10.r > srcBlock.r)");
    expect(STRIPE_FILTER_FRAGMENT).toContain("if (s11.r > srcBlock.r)");
  });

  it("tints stripes with the trail color only in colors mode", () => {
    expect(STRIPE_FILTER_FRAGMENT).toContain("mix(stripeColor, trail.rgb, trail.a)");
    const tintIndex = STRIPE_FILTER_FRAGMENT.indexOf("mix(stripeColor, trail.rgb, trail.a)");
    const gateIndex = STRIPE_FILTER_FRAGMENT.lastIndexOf("if (uUseCellColors > 0.5)", tintIndex);
    expect(gateIndex).toBeGreaterThan(-1);
  });
});
