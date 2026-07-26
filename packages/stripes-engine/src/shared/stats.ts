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
  /** Blits per second summed across all instances — observed, not configured. */
  blitsPerSecond: number;
  /** Length of the window these rates were measured over. */
  sampleMs: number;
  instances: StripesInstanceStats[];
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

/** True only while something is listening; every collection path checks this. */
export function statsEnabled(): boolean {
  return listeners.size > 0;
}

export function setStatsCollector(next: StatsCollector | null): void {
  collector = next;
  if (next && listeners.size > 0) next.start(intervalMs);
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
  if (first) collector?.start(intervalMs);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) collector?.stop();
  };
}
