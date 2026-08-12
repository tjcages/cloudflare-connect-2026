import { describe, expect, it } from "vitest";
import { PLANE_TERRAIN_SHADER_SOURCE } from "./planeTerrainShaderSource";

describe("planeTerrainShaderSource", () => {
  it("exports a ShaderToy mainImage that spans full-bleed UV", () => {
    expect(PLANE_TERRAIN_SHADER_SOURCE).toContain("void mainImage(out vec4 fragColor, in vec2 fragCoord)");
    expect(PLANE_TERRAIN_SHADER_SOURCE).toContain("fragCoord / iResolution.xy");
    expect(PLANE_TERRAIN_SHADER_SOURCE).toContain("terrainHeight");
    expect(PLANE_TERRAIN_SHADER_SOURCE).toContain("LINE_COUNT");
  });
});
