import { describe, expect, it } from "vitest";
import { FLOWING_LINES_SHADER_SOURCE } from "./flowingLinesShaderSource";

describe("flowingLinesShaderSource", () => {
  it("contains the reference ribbon geometry and anti-aliased isolines", () => {
    expect(FLOWING_LINES_SHADER_SOURCE).toContain("void mainImage(out vec4 fragColor, in vec2 fragCoord)");
    expect(FLOWING_LINES_SHADER_SOURCE).toContain("ribbonCenter");
    expect(FLOWING_LINES_SHADER_SOURCE).toContain("ribbonWidth");
    expect(FLOWING_LINES_SHADER_SOURCE).toContain("fiberY");
    expect(FLOWING_LINES_SHADER_SOURCE).toContain("const int LINE_COUNT = 64");
    expect(FLOWING_LINES_SHADER_SOURCE).toContain("distancePx");
    expect(FLOWING_LINES_SHADER_SOURCE).toContain("1.0 - exp(-ink)");
  });
});
