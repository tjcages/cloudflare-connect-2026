export type PlaygroundPerfSample = {
  sampleFrameMs: number;
  pointerCompositeMs: number;
  buildGridMs: number;
  blockTextureMs: number;
  renderMs: number;
  tickTotalMs: number;
  partialGrid: boolean;
};

let lastSample: PlaygroundPerfSample | null = null;
let frameCount = 0;

export function isPlaygroundPerfProfilingEnabled(): boolean {
  return (
    typeof globalThis !== "undefined" && (globalThis as { __PLAYGROUND_PERF__?: boolean }).__PLAYGROUND_PERF__ === true
  );
}

export function recordPlaygroundPerfSample(sample: PlaygroundPerfSample): void {
  if (!isPlaygroundPerfProfilingEnabled()) {
    return;
  }
  lastSample = sample;
  frameCount += 1;
  if (frameCount % 60 === 0) {
    console.debug("[playground-perf]", lastSample);
  }
}

export function getLastPlaygroundPerfSample(): PlaygroundPerfSample | null {
  return lastSample;
}

export function createPlaygroundPerfTimer(): { elapsedMs: () => number } {
  const start = performance.now();
  return {
    elapsedMs: () => performance.now() - start,
  };
}
