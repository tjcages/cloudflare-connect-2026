// The curated public API of @necatikcl/stripes-shader (the lib-build/publish entry).
// src/index.ts stays broad for the workspace studio; this file is what consumers get.
export { StripesShader, type StripesShaderProps } from "./StripesShader";
export {
  type StripesShaderConfig,
  DEFAULT_STRIPES_SHADER_CONFIG,
  normalizeStripesShaderConfig,
} from "./StripesShaderConfig";
export { serializeStripesShaderConfig } from "./serializeStripesShaderConfig";
export {
  createStripesShaderScene,
  type StripesSceneConfig,
  type StripesShaderSceneOptions,
  type PlaygroundTextureSource,
  type PlaygroundDisplaySize,
} from "./setupTextureShaderScene";
export { resolveStripesSceneConfig } from "./buildSceneConfig";
// Config sub-types a consumer needs to type/build a config literal:
export type { Stripe } from "./stripeColors";
export type { TextureLuminanceMode } from "./colorWhiteness";
export type { PlaygroundGridConfig } from "./playgroundGridConfig";
export type { PlaygroundTextureAdjustments } from "./playgroundTextureAdjustments";
export type { PlaygroundSourceTransform } from "./playgroundSourceTransform";
export type { PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
export type {
  PlaygroundAssemblyRevealConfig,
  PlaygroundAssemblyRevealOrder,
  PlaygroundRevealConfig,
  PlaygroundRevealType,
} from "./playgroundRevealConfig";
export type { PlaygroundCursorTrailConfig } from "./playgroundCursorTrailConfig";
export type { PlaygroundClickWaveConfig } from "./playgroundClickWaveConfig";
