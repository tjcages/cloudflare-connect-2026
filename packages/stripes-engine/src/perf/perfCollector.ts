import { percentile } from "./percentiles";

export type PerfSnapshot = {
  fps: number;
  frameMs: { p50: number; p95: number; p99: number };
  passMs: Record<string, number>;
  sampleCount: number;
};

export function createPerfCollector(capacity = 240) {
  const frames: number[] = [];
  let passes: Record<string, number> = {};
  return {
    recordFrame(ms: number) {
      frames.push(ms);
      if (frames.length > capacity) frames.shift();
    },
    recordPasses(map: Record<string, number>) {
      passes = map;
    },
    reset() {
      frames.length = 0;
      passes = {};
    },
    snapshot(): PerfSnapshot {
      const p50 = percentile(frames, 0.5);
      return {
        fps: p50 > 0 ? 1000 / p50 : 0,
        frameMs: { p50, p95: percentile(frames, 0.95), p99: percentile(frames, 0.99) },
        passMs: { ...passes },
        sampleCount: frames.length,
      };
    },
  };
}
