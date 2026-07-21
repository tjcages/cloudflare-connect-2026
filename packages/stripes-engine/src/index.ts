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
export { applyImageColorDensity, effectiveStripes } from "./field/imageColorDensity";
export type { PerfSnapshot } from "./perf/perfCollector";
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
} from "./config/types";
export { CURSOR_TRAIL_TYPES } from "./config/types";
export { normalizeEngineConfig, DEFAULT_ENGINE_CONFIG } from "./config/normalize";
export { serializeEngineConfig, parseEngineConfig } from "./config/serialize";
export type { EngineSource } from "./source/sourceTexture";
export { migrateLegacyConfig } from "./legacy/migrateLegacyConfig";
export type { Adjustments, Grid, Transform, Background } from "./config/types";
