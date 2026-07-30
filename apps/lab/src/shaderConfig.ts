import { isSpiralShaderPreset, isTwizzlerMapShaderPreset } from "./shaderLibrary";
import type { LabTextureSourceMode } from "./persistence";

export type ShaderConfigKind = "spiral" | "twizzler-map";

export function resolveShaderConfigKind(
  textureSourceMode: LabTextureSourceMode,
  shaderPresetId: string,
): ShaderConfigKind | null {
  if (textureSourceMode !== "shader") return null;
  if (isSpiralShaderPreset(shaderPresetId)) return "spiral";
  if (isTwizzlerMapShaderPreset(shaderPresetId)) return "twizzler-map";
  return null;
}
