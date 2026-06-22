export const ENGINE_PACKAGE = "@necatikcl/stripes-engine";
export { createStripesEngine } from "./engine";
export type { StripesEngine, EngineOptions } from "./engine";
export type { PerfSnapshot } from "./perf/perfCollector";
export { createRealClock, createManualClock } from "./core/clock";
export type { Clock, ManualClock } from "./core/clock";
export { createSeededRng } from "./core/rng";
