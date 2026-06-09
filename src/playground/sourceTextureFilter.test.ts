import { describe, expect, it } from "vitest";
import { SOURCE_TEXTURE_FILTER_FRAGMENT } from "./sourceTextureFilter";

describe("SOURCE_TEXTURE_FILTER_FRAGMENT", () => {
  it("samples the source texture and remaps luminance for raw preview mode", () => {
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("texture(uTexture, vTextureCoord)");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("adjustLuma");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uBlackPoint");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uPosterizeLevels");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("floor(value * steps + 0.5)");
  });

  it("composites flames before tone adjustments in preview", () => {
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("vec3 merged = applyFlames(sourceColor.rgb);");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("float mergedLuma = sampleMergedLuma(merged);");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("float adjusted = adjustLuma(mergedLuma);");
  });

  it("supports colors-mode preview luminance from distance to texture background", () => {
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uniform float uColorsMode");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uniform vec3 uTextureBgColor");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("colorDistanceLuma");
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
