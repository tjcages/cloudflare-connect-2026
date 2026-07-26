import type { InstanceId } from "./protocol";

/** One instance's slice of {@link StripesStats}. */
export type StripesInstanceStats = {
  id: InstanceId;
  /** `label` from registration, else the source file's basename. */
  label: string;
  /** Render gate open: the worker is blitting this instance. */
  rendering: boolean;
  /** Reveal gate open: the reveal animation's clock is allowed to advance. */
  revealGateOpen: boolean;
  cssWidth: number;
  cssHeight: number;
  /** Device pixels actually rendered per frame. */
  outputWidth: number;
  outputHeight: number;
  /** `outputWidth * outputHeight`, in millions of pixels. */
  megapixels: number;
  /** Internal field-chain resolution: `output * fieldScale`, floored. */
  fieldWidth: number;
  fieldHeight: number;
  /** The `fieldScale` the engine actually applied, post-normalization. */
  fieldScale: number;
  /**
   * Summed render-target area of every pass dispatched on the last frame, in
   * millions of pixels. This is the fill-rate number; `megapixels` only counts
   * the final blit.
   */
  shadedMegapixels: number;
  /** Passes dispatched on the last rendered frame, in pipeline order. */
  passes: StripesPassStats[];
  /** Configured frame cap; `0` means uncapped (renders on every tick). */
  maxFps: number;
  /** Blits per second actually observed over the last sampling window. */
  fps: number;
};

/**
 * A snapshot of what the shared stripes renderer is really doing. Gate state
 * and blit counts come from the coordinator; sizes and frame caps come from the
 * worker, which owns the engines.
 */
export type StripesStats = {
  /** Instances registered with the coordinator, rendering or not. */
  total: number;
  /** Instances whose render gate is open — these are the ones burning GPU. */
  rendering: number;
  /** `total - rendering`: registered but gated off. */
  paused: number;
  /** Instances whose reveal clock is allowed to advance. */
  revealOpen: number;
  /** Summed megapixels of every rendering instance: the per-tick GPU load. */
  megapixelsPerFrame: number;
  /**
   * Summed shaded megapixels across every rendering instance — the real
   * per-tick fill-rate load, which counts every dispatched pass rather than
   * just the final blit.
   */
  shadedMegapixelsPerFrame: number;
  /** Blits per second summed across all instances — observed, not configured. */
  blitsPerSecond: number;
  /** Length of the window these rates were measured over. */
  sampleMs: number;
  instances: StripesInstanceStats[];
};

/** One dispatched pass and the render-target area it shaded. */
export type StripesPassStats = {
  name: string;
  /** Render-target dimensions of the pass's last dispatch this frame. */
  width: number;
  height: number;
  /** Target binds during the pass — sub-stepped sims bind once per step. */
  dispatches: number;
  /** Summed render-target area across those dispatches. */
  pixels: number;
  /** True when the pass renders at the instance's output resolution, so
   * `fieldScale` cannot make it cheaper. */
  atOutputResolution: boolean;
};

export type StripesStatsListener = (stats: StripesStats) => void;

/**
 * Installed by the coordinator once it loads. Kept behind this indirection so
 * the public entry point can export {@link subscribeStripesStats} without
 * statically pulling in the coordinator — and with it the inlined worker blob.
 */
export type StatsCollector = {
  start(intervalMs: number): void;
  stop(): void;
};

const listeners = new Set<StripesStatsListener>();
let collector: StatsCollector | null = null;
let intervalMs = 500;
let idleTimer: ReturnType<typeof setInterval> | null = null;

/** True only while something is listening; every collection path checks this. */
export function statsEnabled(): boolean {
  return listeners.size > 0;
}

function emptyStats(): StripesStats {
  return {
    total: 0,
    rendering: 0,
    paused: 0,
    revealOpen: 0,
    megapixelsPerFrame: 0,
    shadedMegapixelsPerFrame: 0,
    blitsPerSecond: 0,
    sampleMs: intervalMs,
    instances: [],
  };
}

/**
 * The coordinator is loaded lazily by the first `<StripesShader>` to mount, so
 * on a page where none has hydrated yet there is no collector to ask. Report
 * zero on the same cadence instead of leaving the subscriber with no sample at
 * all, and hand over the moment a real collector installs itself.
 */
function startIdleReporting(): void {
  if (idleTimer) return;
  idleTimer = setInterval(() => publishStats(emptyStats()), intervalMs);
  publishStats(emptyStats());
}

function stopIdleReporting(): void {
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = null;
}

export function setStatsCollector(next: StatsCollector | null): void {
  collector = next;
  if (next && listeners.size > 0) {
    stopIdleReporting();
    next.start(intervalMs);
  }
}

export function publishStats(stats: StripesStats): void {
  for (const listener of [...listeners]) listener(stats);
}

/**
 * Watch what the shared stripes renderer is doing: how many instances are
 * registered, how many are actually rendering, how many pixels they cost per
 * frame, and the blit rate they achieve.
 *
 * Nothing is collected until the first listener attaches, and collection stops
 * again when the last one detaches, so this costs zero while unused.
 *
 * @returns an unsubscribe function.
 */
export function subscribeStripesStats(listener: StripesStatsListener, options?: { intervalMs?: number }): () => void {
  if (options?.intervalMs) intervalMs = options.intervalMs;
  const first = listeners.size === 0;
  listeners.add(listener);
  if (first) {
    if (collector) collector.start(intervalMs);
    else startIdleReporting();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    collector?.stop();
    stopIdleReporting();
  };
}
