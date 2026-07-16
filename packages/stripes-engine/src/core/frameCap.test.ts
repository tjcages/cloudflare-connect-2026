import { describe, it, expect } from "vitest";
import { createFrameCapState, shouldRenderFrame } from "./frameCap";

describe("shouldRenderFrame", () => {
  it("maxFps <= 0 is uncapped: always renders and never touches state", () => {
    const state = createFrameCapState();
    expect(shouldRenderFrame(state, 0, 0)).toBe(true);
    expect(shouldRenderFrame(state, 0, 5)).toBe(true);
    expect(shouldRenderFrame(state, -30, 5)).toBe(true);
    expect(state.lastRenderMs).toBe(0);
  });

  it("caps to ~maxFps: skips renders inside the interval", () => {
    const state = createFrameCapState();
    // 30fps → 33.33ms interval, skip threshold ~32.33ms.
    expect(shouldRenderFrame(state, 30, 1000)).toBe(true); // first frame renders
    expect(shouldRenderFrame(state, 30, 1016)).toBe(false); // +16ms, too soon
    expect(shouldRenderFrame(state, 30, 1033)).toBe(true); // +33ms from first, renders
    expect(shouldRenderFrame(state, 30, 1049)).toBe(false);
    expect(shouldRenderFrame(state, 30, 1066)).toBe(true);
  });

  it("holds the long-run rate at maxFps without drift over ~16ms ticks", () => {
    const state = createFrameCapState();
    let rendered = 0;
    // 30fps cap, one second of 60fps ticks → ~30 renders (not 60, not drifting low).
    for (let t = 0; t <= 1000; t += 1000 / 60) {
      if (shouldRenderFrame(state, 30, t)) rendered++;
    }
    expect(rendered).toBeGreaterThanOrEqual(29);
    expect(rendered).toBeLessThanOrEqual(31);
  });

  it("resyncs after a long stall instead of bursting catch-up frames", () => {
    const state = createFrameCapState();
    expect(shouldRenderFrame(state, 30, 100)).toBe(true);
    // Tab backgrounded ~5s; ticks resume. First tick renders, but the deadline
    // snaps to `now` so the next few ticks are gated (no 5s worth of catch-up).
    expect(shouldRenderFrame(state, 30, 5100)).toBe(true);
    expect(shouldRenderFrame(state, 30, 5116)).toBe(false);
    expect(shouldRenderFrame(state, 30, 5133)).toBe(true);
  });

  it("independent state per registration", () => {
    const a = createFrameCapState();
    const b = createFrameCapState();
    expect(shouldRenderFrame(a, 30, 1000)).toBe(true);
    expect(shouldRenderFrame(a, 30, 1016)).toBe(false);
    // b has its own deadline, unaffected by a.
    expect(shouldRenderFrame(b, 30, 1016)).toBe(true);
  });
});
