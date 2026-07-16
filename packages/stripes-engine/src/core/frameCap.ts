export type FrameCapState = { lastRenderMs: number };

export function createFrameCapState(): FrameCapState {
  return { lastRenderMs: 0 };
}

// Wall-clock frame limiter shared by the standalone rAF loop and the shared
// worker's per-instance render gate. `maxFps <= 0` means uncapped: always true,
// state untouched, so an uncapped texture behaves byte-identically to no cap.
// Animation timing is read from the clock at render time, so skipping a render
// only lowers the paint rate — it never changes animation speed.
export function shouldRenderFrame(state: FrameCapState, maxFps: number, now: number): boolean {
  if (!(maxFps > 0)) return true;
  const interval = 1000 / maxFps;
  if (now - state.lastRenderMs < interval - 1) return false;
  // Advance the deadline by exactly one interval so the long-run rate stays at
  // maxFps without drift, then clamp to `now`: after a long stall (offscreen
  // tile, backgrounded tab) the deadline is stale, so snap it forward instead
  // of queuing a burst of catch-up frames when ticks resume.
  state.lastRenderMs += interval;
  if (now - state.lastRenderMs >= interval) state.lastRenderMs = now;
  return true;
}
