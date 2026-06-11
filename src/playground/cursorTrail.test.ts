import { describe, expect, it } from "vitest";
import { createCursorTrailState, setCursorTrailTarget, updateCursorTrail } from "./cursorTrail";
import { DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG } from "./playgroundCursorTrailConfig";

describe("updateCursorTrail", () => {
  it("emits fading samples while the pointer moves", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 0, y: 0 });
    updateCursorTrail(state, 16);
    setCursorTrailTarget(state, { x: 40, y: 0 });
    const active = updateCursorTrail(state, 16);

    expect(active.samples.length).toBeGreaterThan(0);
    expect(active.changed).toBe(true);
  });

  it("keeps rebuilding briefly after the last particle expires", () => {
    const shortLifeConfig = {
      ...DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
      particleLifeMs: 20,
      particleLifeJitterMs: 0,
    };
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 0, y: 0 });
    updateCursorTrail(state, 16, shortLifeConfig);
    setCursorTrailTarget(state, null);

    let clearingFrames = 0;
    for (let i = 0; i < 20; i++) {
      const result = updateCursorTrail(state, 16, shortLifeConfig);
      if (result.changed && result.samples.length === 0) {
        clearingFrames++;
      }
    }

    expect(clearingFrames).toBeGreaterThan(0);
  });
});
