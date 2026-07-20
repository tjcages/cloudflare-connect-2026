export const ENGINE_PACKAGE = "@necatikcl/stripes-engine";
export { createStripesEngine, createStripesEngineShared } from "./engine";
export type {
  StripesEngine,
  EngineOptions,
  CellGridReadback,
  SharedStripesEngine,
  SharedEngineOptions,
} from "./engine";
export type { EngineContext } from "./gl/context";
export { bandIndexForValue } from "./field/cellBand";
export { applyImageColorDensity, effectiveStripes } from "./field/imageColorDensity";
export type { PerfSnapshot } from "./perf/perfCollector";
export { createRealClock, createManualClock } from "./core/clock";
export type { Clock, ManualClock } from "./core/clock";
export { createSeededRng } from "./core/rng";
export type { EngineConfig, Stripe, Fit, RenderMode } from "./config/types";
export { normalizeEngineConfig, DEFAULT_ENGINE_CONFIG } from "./config/normalize";
export { serializeEngineConfig, parseEngineConfig } from "./config/serialize";
export type { EngineSource } from "./source/sourceTexture";
export { migrateLegacyConfig } from "./legacy/migrateLegacyConfig";
export type { Adjustments, Grid, Transform, Background } from "./config/types";
