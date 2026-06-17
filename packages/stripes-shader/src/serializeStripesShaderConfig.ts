import type { StripesShaderConfig } from "./StripesShaderConfig";

/**
 * Serialize a StripesShaderConfig to a pretty-printed JSON string.
 *
 * The output is valid JSON that round-trips through normalizeStripesShaderConfig,
 * suitable for pasting directly into <StripesShader config={…} />.
 */
export function serializeStripesShaderConfig(config: StripesShaderConfig): string {
  return JSON.stringify(config, null, 2);
}
