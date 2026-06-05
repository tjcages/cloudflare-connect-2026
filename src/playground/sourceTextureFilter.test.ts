import { describe, expect, it } from "vitest";
import { SOURCE_TEXTURE_FILTER_FRAGMENT } from "./sourceTextureFilter";

describe("SOURCE_TEXTURE_FILTER_FRAGMENT", () => {
  it("samples the source texture and remaps luminance for raw preview mode", () => {
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("texture(uTexture, vTextureCoord)");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("adjustLuma");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uBlackPoint");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uPosterizeLevels");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("floor(value * steps + 0.5)");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).not.toContain("round(");
  });
});
