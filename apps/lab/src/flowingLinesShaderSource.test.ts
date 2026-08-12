import { describe, expect, it } from "vitest";
import { FLOWING_LINES_SHADER_SOURCE } from "./flowingLinesShaderSource";

describe("flowingLinesShaderSource", () => {
  it("contains the reference sine-pack equation and anti-aliased isolines", () => {
    expect(FLOWING_LINES_SHADER_SOURCE).toContain("void mainImage(out vec4 fragColor, in vec2 fragCoord)");
    expect(FLOWING_LINES_SHADER_SOURCE).toContain("sin(phase + 11.0 * uv.x) - 4.0 * uv.x * cos(0.5 * phase)");
    expect(FLOWING_LINES_SHADER_SOURCE).toContain("const int LINE_COUNT = 40");
    expect(FLOWING_LINES_SHADER_SOURCE).toContain("distanceToLine");
    expect(FLOWING_LINES_SHADER_SOURCE).toContain("1.0 - exp(-ink)");
  });
});
