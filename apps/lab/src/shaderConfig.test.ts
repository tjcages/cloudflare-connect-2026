import { describe, expect, it } from "vitest";
import {
  COMET_LOGO_SHADER_PRESET_ID,
  CONNECT_SHADER_PRESET_ID,
  SPIRAL_SHADER_PRESET_ID,
  TWIZZLER_MAP_SHADER_PRESET_ID,
} from "./shaderLibrary";
import { resolveShaderConfigKind } from "./shaderConfig";

describe("resolveShaderConfigKind", () => {
  it("selects the config owned by the active shader", () => {
    expect(resolveShaderConfigKind("shader", SPIRAL_SHADER_PRESET_ID)).toBe("spiral");
    expect(resolveShaderConfigKind("shader", TWIZZLER_MAP_SHADER_PRESET_ID)).toBe("twizzler-map");
    expect(resolveShaderConfigKind("shader", COMET_LOGO_SHADER_PRESET_ID)).toBe("comet-logo");
  });

  it("hides shader config for presets without custom controls", () => {
    expect(resolveShaderConfigKind("shader", CONNECT_SHADER_PRESET_ID)).toBeNull();
  });

  it("hides shader config outside shader source mode", () => {
    expect(resolveShaderConfigKind("texture", SPIRAL_SHADER_PRESET_ID)).toBeNull();
    expect(resolveShaderConfigKind("texture", TWIZZLER_MAP_SHADER_PRESET_ID)).toBeNull();
    expect(resolveShaderConfigKind("texture", COMET_LOGO_SHADER_PRESET_ID)).toBeNull();
  });
});
