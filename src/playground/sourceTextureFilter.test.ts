import { describe, expect, it } from "vitest";
import { SOURCE_TEXTURE_FILTER_FRAGMENT } from "./sourceTextureFilter";

describe("SOURCE_TEXTURE_FILTER_FRAGMENT", () => {
  it("samples the source texture and remaps luminance for raw preview mode", () => {
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("readCompositedSource");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("texture(uTexture, uv)");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("source.rgb / alpha");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("adjustLuma");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uBlackPoint");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uPosterizeLevels");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("floor(value * steps + 0.5)");
  });

  it("composites flames before tone adjustments in preview", () => {
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("vec3 merged = applyFlames(sampleFilteredSourceRgb(vTextureCoord));");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("float mergedLuma = sampleMergedLuma(merged);");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("float adjusted = adjustLuma(mergedLuma);");
  });

  it("supports colors-mode preview with tone mapping on foreground and background", () => {
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uniform float uColorsMode");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uniform vec3 uTextureBgColor");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("colorPixelPresence");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("pixelSaturation");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("mergedLuma > 0.0001");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("adjustLuma(bgLuma)");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("boxBlurSourceRgb");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("compositeSourceRgb");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("finalColor = vec4(clamp(finalRgb, 0.0, 1.0), 1.0)");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("merged * (adjusted / mergedLuma)");
  });

  it("supports preview blur and sharpen before tone mapping", () => {
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uniform float uBlurRadius");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uniform float uSharpenAmount");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uniform vec2 uTexelSize");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("sampleFilteredSourceRgb");
  });

  it("blends flames over the preview so they stay visible on bright pixels", () => {
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uniform sampler2D uFlames");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("return mix(sourceRgb, flameRgb, flameCover);");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("flamesEdgeMask(vDisplayCoord)");
  });

  it("fades flames near canvas edges with configurable inset ramp", () => {
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uFlamesMaskStart");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uFlamesMaskEnd");
  });
});
