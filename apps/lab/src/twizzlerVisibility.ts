import { isTwizzlerMapShaderPreset } from "./shaderLibrary";

export function shouldShowTwizzlerOverlay(
  textureSourceMode: "texture" | "shader",
  shaderPresetId: string,
  enabled: boolean,
  stripesEnabled: boolean,
): boolean {
  return textureSourceMode === "shader" && isTwizzlerMapShaderPreset(shaderPresetId) && enabled && !stripesEnabled;
}
