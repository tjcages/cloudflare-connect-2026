export const ENGINE_PACKAGE = "@necatikcl/stripes-engine";
export { createStripesEngine, createStripesEngineShared } from "./engine";
export type {
  StripesEngine,
  EngineOptions,
  CellGridReadback,
  SharedStripesEngine,
  SharedEngineOptions,
  EngineHooks,
  EngineHookContext,
  FieldHookFrame,
  FieldHookPass,
  PostHookFrame,
  PostHookPass,
  CustomRevealFrame,
  CustomRevealPass,
} from "./engine";
export { compileProgram, createFullscreenQuad } from "./gl/program";
export type { FullscreenQuad } from "./gl/program";
export { bindRenderTarget, createRenderTarget, disposeRenderTarget, resizeRenderTarget } from "./gl/renderTarget";
export type { RenderTarget } from "./gl/renderTarget";
export { createPingPong } from "./gl/pingPong";
export type { PingPong } from "./gl/pingPong";
export { createDataTexture, updateDataTexture } from "./gl/dataTexture";
export { FULLSCREEN_VERT } from "./shaders/fullscreen.vert";
export type { RtPool } from "./pipeline/rtPool";
export type { Size } from "./gl/resolution";
export type { CursorTrailPoint } from "./cursorTrail/cursorTrailSim";
export type { EngineContext } from "./gl/context";
export { bandIndexForValue } from "./field/cellBand";
export { stripeDotBandEligibility } from "./field/stripeLut";
export { applyImageColorDensity, effectiveStripes } from "./field/imageColorDensity";
export type { PerfSnapshot } from "./perf/perfCollector";
export { subscribeStripesStats } from "./shared/stats";
export type { StripesStats, StripesInstanceStats, StripesStatsListener } from "./shared/stats";
export { createRealClock, createManualClock } from "./core/clock";
export type { Clock, ManualClock } from "./core/clock";
export { createSeededRng } from "./core/rng";
export type {
  EngineConfig,
  Stripe,
  Fit,
  RenderMode,
  CursorTrailType,
  CursorTrailConfig,
  ConstellationTrailConfig,
  CometTrailConfig,
  StripeDotsConfig,
  StripeBorderConfig,
  GridLinesConfig,
  FramesConfig,
} from "./config/types";
export { CURSOR_TRAIL_TYPES } from "./config/types";
export { normalizeEngineConfig, DEFAULT_ENGINE_CONFIG } from "./config/normalize";
export { DEFAULT_STRIPE_DOTS, normalizeStripeDots } from "./config/normalize";
export {
  DEFAULT_STRIPE_BORDER,
  DEFAULT_GRID_LINES,
  DEFAULT_FRAMES,
  normalizeStripeBorder,
  normalizeGridLines,
  normalizeFrames,
} from "./config/normalize";
export { serializeEngineConfig, parseEngineConfig } from "./config/serialize";
export { createProductionConfig, serializeProductionConfig } from "./config/production";
export type { ProductionEngineConfig, ProductionThemedEngineConfig } from "./config/production";
export { resolveThemedConfig, diffEngineConfig, sanitizeThemedConfig } from "./config/theme";
export type { ThemeName, ThemedEngineConfig, DeepPartial } from "./config/theme";
export type { EngineSource } from "./source/sourceTexture";
export { migrateLegacyConfig } from "./legacy/migrateLegacyConfig";
export type { Adjustments, Grid, Transform, Background, BackgroundMeteors } from "./config/types";
export { DEFAULT_BACKGROUND_METEORS, normalizeBackgroundMeteors } from "./config/normalize";
export { meteorsCaps } from "./meteors/meteorsSim";
export { DEFAULT_COMET_TRAIL, normalizeCometTrail } from "./config/normalize";
export { cometCaps } from "./cursorTrail/cometSim";
export type { ClickWaveType, ClickWaveConfig, DetonationClickConfig } from "./config/types";
export { CLICK_WAVE_TYPES } from "./config/types";
export { DEFAULT_CLICK_WAVE, DEFAULT_DETONATION_CLICK, normalizeDetonationClick } from "./config/normalize";
export { detonationCaps } from "./detonation/detonationSim";
