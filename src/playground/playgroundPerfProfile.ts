export type PlaygroundPerfSample = {
  sampleFrameMs: number;
  pointerCompositeMs: number;
  buildGridMs: number;
  blockTextureMs: number;
  renderMs: number;
  tickTotalMs: number;
  partialGrid: boolean;
  fps?: number;
  fpsSmoothed?: number;
  frameBudgetUsagePct?: number;
  frameHeadroomMs?: number;
  perfHealth?: "good" | "ok" | "slow";
  workerGridInFlight?: boolean;
  workerGridApplied?: boolean;
  workerGridQueueDepth?: number;
  workerGridCoalesced?: number;
  workerGridDroppedQueued?: number;
  workerGridLatencyMs?: number;
};

let lastSample: PlaygroundPerfSample | null = null;
let frameCount = 0;
let lastSampleAtMs: number | null = null;
let fpsSmoothed: number | null = null;
const TARGET_FPS = 60;
const TARGET_FRAME_BUDGET_MS = 1000 / TARGET_FPS;

export function isPlaygroundPerfProfilingEnabled(): boolean {
  if (typeof globalThis === "undefined") {
    return false;
  }
  const override = (globalThis as { __PLAYGROUND_PERF__?: boolean }).__PLAYGROUND_PERF__;
  if (override === true) {
    return true;
  }
  if (override === false) {
    return false;
  }
  return import.meta.env.DEV;
}

export function recordPlaygroundPerfSample(sample: PlaygroundPerfSample): void {
  if (!isPlaygroundPerfProfilingEnabled()) {
    return;
  }
  const now = performance.now();
  let fps: number | undefined;
  if (lastSampleAtMs !== null) {
    const deltaMs = now - lastSampleAtMs;
    if (Number.isFinite(deltaMs) && deltaMs > 0) {
      fps = 1000 / deltaMs;
      fpsSmoothed = fpsSmoothed === null ? fps : fpsSmoothed * 0.85 + fps * 0.15;
    }
  }
  lastSampleAtMs = now;

  const frameBudgetUsagePct = (sample.tickTotalMs / TARGET_FRAME_BUDGET_MS) * 100;
  const frameHeadroomMs = TARGET_FRAME_BUDGET_MS - sample.tickTotalMs;
  const resolvedFps = fpsSmoothed ?? fps;
  let perfHealth: PlaygroundPerfSample["perfHealth"] = "ok";
  if (resolvedFps !== undefined && resolvedFps >= 55 && frameBudgetUsagePct <= 85) {
    perfHealth = "good";
  } else if (resolvedFps !== undefined && resolvedFps < 45) {
    perfHealth = "slow";
  } else if (frameBudgetUsagePct > 100) {
    perfHealth = "slow";
  }

  lastSample = {
    ...sample,
    fps,
    fpsSmoothed: fpsSmoothed ?? undefined,
    frameBudgetUsagePct,
    frameHeadroomMs,
    perfHealth,
  };
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
