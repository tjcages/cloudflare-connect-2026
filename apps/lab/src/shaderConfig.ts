import { isCometLogoShaderPreset, isSpiralShaderPreset, isTwizzlerMapShaderPreset } from "./shaderLibrary";
import type { LabTextureSourceMode } from "./persistence";

export type ShaderConfigKind = "spiral" | "twizzler-map" | "comet-logo";

export function resolveShaderConfigKind(
  textureSourceMode: LabTextureSourceMode,
  shaderPresetId: string,
): ShaderConfigKind | null {
  if (textureSourceMode !== "shader") return null;
  if (isSpiralShaderPreset(shaderPresetId)) return "spiral";
  if (isTwizzlerMapShaderPreset(shaderPresetId)) return "twizzler-map";
  if (isCometLogoShaderPreset(shaderPresetId)) return "comet-logo";
  return null;
}
