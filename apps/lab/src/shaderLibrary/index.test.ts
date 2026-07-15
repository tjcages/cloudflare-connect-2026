import { describe, expect, it } from "vitest";
import {
  CONNECT_SHADER_PRESET_ID,
  CUSTOM_SHADER_PRESET_ID,
  DEFAULT_SHADER_PRESET_ID,
  findShaderLibraryEntry,
  findShaderPresetIdBySource,
  isConnectShaderPreset,
  NEBULA_SHADER_PRESET_ID,
  SHADER_LIBRARY,
} from "./index";
import { DEFAULT_SHADER_TEXTURE_SOURCE } from "../defaultShaderTextureSource";

describe("shader library", () => {
  it("puts Connect first as the default preset", () => {
    expect(DEFAULT_SHADER_PRESET_ID).toBe(CONNECT_SHADER_PRESET_ID);
    expect(SHADER_LIBRARY[0]?.id).toBe(CONNECT_SHADER_PRESET_ID);
    expect(SHADER_LIBRARY[0]?.label).toBe("Connect");
    expect(isConnectShaderPreset(CONNECT_SHADER_PRESET_ID)).toBe(true);
  });

  it("keeps Nebula as a built-in preset", () => {
    expect(SHADER_LIBRARY[1]?.id).toBe(NEBULA_SHADER_PRESET_ID);
    expect(SHADER_LIBRARY[1]?.source).toBe(DEFAULT_SHADER_TEXTURE_SOURCE);
  });

  it("includes the copied saved shaders", () => {
    expect(SHADER_LIBRARY.length).toBeGreaterThan(10);
    expect(findShaderLibraryEntry("061d653b-18f2-40b3-b92f-86a4459b6b5a")?.label).toBe("Planets");
  });

  it("detects presets by source", () => {
    expect(findShaderPresetIdBySource(DEFAULT_SHADER_TEXTURE_SOURCE)).toBe(NEBULA_SHADER_PRESET_ID);
    expect(findShaderPresetIdBySource("", CONNECT_SHADER_PRESET_ID)).toBe(CONNECT_SHADER_PRESET_ID);
    expect(findShaderPresetIdBySource("// custom equation\nvoid mainImage(out vec4 c, in vec2 f){c=vec4(1.);}")).toBe(
      CUSTOM_SHADER_PRESET_ID,
    );
  });
});
