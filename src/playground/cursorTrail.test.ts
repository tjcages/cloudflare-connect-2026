import { describe, expect, it } from "vitest";
import {
  createCursorTrailState,
  downsamplePixelsNearest,
  resolveCursorTrailRebuildBounds,
  upscalePixelsNearest,
  upscalePixelsNearestRegion,
  setCursorTrailTarget,
  updateCursorTrail,
} from "./cursorTrail";
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

describe("downsamplePixelsNearest", () => {
  it("maps display pixels into a smaller effect buffer", () => {
    const source = new Uint8ClampedArray(4 * 4 * 4);
    source.fill(0);
    source[2 * 4] = 200;
    const target = new Uint8ClampedArray(2 * 2 * 4);
    downsamplePixelsNearest(source, 4, 4, target, 2, 2);
    const redChannels = Array.from({ length: target.length / 4 }, (_, pixel) => target[pixel * 4] ?? 0);
    expect(redChannels.some((value) => value === 200)).toBe(true);
  });
});

describe("upscalePixelsNearestRegion", () => {
  it("matches full upscale inside the dirty bounds", () => {
    const source = new Uint8ClampedArray(16);
    for (let i = 0; i < 16; i += 4) {
      source[i] = 100;
      source[i + 3] = 255;
    }
    const full = new Uint8ClampedArray(64);
    const partial = new Uint8ClampedArray(64);
    upscalePixelsNearest(source, 2, 2, full, 4, 4);
    upscalePixelsNearestRegion(source, 2, 2, partial, 4, 4, {
      dirtyMinX: 1,
      dirtyMinY: 1,
      dirtyMaxX: 3,
      dirtyMaxY: 3,
    });

    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        const idx = (y * 4 + x) * 4;
        expect(partial[idx]).toBe(full[idx]);
      }
    }
    expect(partial[0]).toBe(0);
  });
});

describe("resolveCursorTrailRebuildBounds", () => {
  it("merges current and previous bounds for dissolve cleanup", () => {
    const current = { dirtyMinX: 10, dirtyMinY: 10, dirtyMaxX: 20, dirtyMaxY: 20 };
    const previous = { dirtyMinX: 0, dirtyMinY: 0, dirtyMaxX: 15, dirtyMaxY: 15 };
    expect(resolveCursorTrailRebuildBounds(current, previous)).toEqual({
      dirtyMinX: 0,
      dirtyMinY: 0,
      dirtyMaxX: 20,
      dirtyMaxY: 20,
    });
  });
});
