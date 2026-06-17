// Render core public surface (2a: relocated as-is; 2b/2c refine into config/ + <StripesShader>).
export * from "./setupTextureShaderScene";
// Explicit re-export of the 2c getter-based API for curation (already covered by export * above).
export {
  createStripesShaderScene,
  type StripesSceneConfig,
  type StripesShaderSceneOptions,
} from "./setupTextureShaderScene";
export * from "./samplePlaygroundFrame";
export * from "./computeBlockGrid";
export * from "./resampleBlockGrid";
export * from "./stabilizeBlockGrid";
export * from "./playgroundGridDirty";
export * from "./blockGridTexture";
export * from "./stripeDuotoneFilter";
export * from "./stripeFilterShaders";
export * from "./sourceTextureFilter";
export * from "./stripeIndexLutTexture";
export * from "./stripePaletteTexture";
export * from "./stripeLetterLayer";
export * from "./stripeLetterFont";
export * from "./stripeLetterPlacements";
export * from "./playgroundLetterShuffle";
export * from "./stripeLetterConstants";
export * from "./stripeColors";
export * from "./colorWhiteness";
export * from "./playgroundVibrantColors";
export * from "./playgroundGridConfig";
export * from "./playgroundSourceTransform";
export * from "./playgroundTextureAdjustments";
export * from "./playgroundSparkle";
export * from "./playgroundWidthShuffle";
export * from "./playgroundFlames";
export * from "./playgroundFlamesConfig";
export * from "./playgroundFlameComposite";
export * from "./playgroundRevealConfig";
export * from "./playgroundReveal";
export * from "./playgroundCursorTrailConfig";
export * from "./playgroundClickWaveConfig";
export * from "./cursorTrail";
export * from "./clickWave";
export * from "./cursorTrailOverlay";
export * from "./stripeGridConstants";
export * from "./playgroundPerfProfile";
export * from "./colorSpace";
export * from "./codeSnippet";
export * from "./prng";
export { default as Pixi } from "./pixiMount";
export * from "./pixiMount";
export * from "./pixiUtils";
export {
  type StripesShaderConfig,
  DEFAULT_STRIPES_SHADER_CONFIG,
  normalizeStripesShaderConfig,
} from "./StripesShaderConfig";
