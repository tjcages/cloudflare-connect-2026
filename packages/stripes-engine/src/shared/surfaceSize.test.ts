import { describe, expect, it } from "vitest";
import { createSurfaceSizeState, nextSurfaceSize, SHRINK_HOLD_TICKS } from "./surfaceSize";

function settle(current: { width: number; height: number }, required: { width: number; height: number }) {
  const state = createSurfaceSizeState();
  let size = current;
  for (let i = 0; i <= SHRINK_HOLD_TICKS; i++) size = nextSurfaceSize(state, size, required);
  return size;
}

describe("nextSurfaceSize", () => {
  it("grows to a larger requirement on the tick it appears", () => {
    const state = createSurfaceSizeState();
    expect(nextSurfaceSize(state, { width: 64, height: 64 }, { width: 1120, height: 640 })).toEqual({
      width: 1152,
      height: 640,
    });
  });

  it("grows each dimension independently, never shrinking the other", () => {
    const state = createSurfaceSizeState();
    expect(nextSurfaceSize(state, { width: 3360, height: 1440 }, { width: 1120, height: 3840 })).toEqual({
      width: 3360,
      height: 3840,
    });
  });

  it("holds an oversized buffer until the smaller requirement has settled", () => {
    const state = createSurfaceSizeState();
    const current = { width: 3392, height: 3840 };
    for (let i = 0; i < SHRINK_HOLD_TICKS - 1; i++) {
      expect(nextSurfaceSize(state, current, { width: 1120, height: 640 })).toEqual(current);
    }
    expect(nextSurfaceSize(state, current, { width: 1120, height: 640 })).toEqual({ width: 1152, height: 640 });
  });

  it("shrinks to the largest requirement seen across the hold window", () => {
    const state = createSurfaceSizeState();
    const current = { width: 3392, height: 3840 };
    let size = current;
    for (let i = 0; i < SHRINK_HOLD_TICKS; i++) {
      size = nextSurfaceSize(state, current, i === 3 ? { width: 1120, height: 1280 } : { width: 1120, height: 640 });
    }
    expect(size).toEqual({ width: 1152, height: 1280 });
  });

  it("never shrinks below the requirement of the tick that triggers it", () => {
    const size = settle({ width: 3392, height: 3840 }, { width: 1121, height: 641 });
    expect(size.width).toBeGreaterThanOrEqual(1121);
    expect(size.height).toBeGreaterThanOrEqual(641);
  });

  it("leaves a buffer alone when the requirement only frees a sliver", () => {
    const current = { width: 1152, height: 3840 };
    expect(settle(current, { width: 1120, height: 3700 })).toEqual(current);
  });

  it("stays put once it has shrunk", () => {
    const state = createSurfaceSizeState();
    let size: { width: number; height: number } = { width: 3392, height: 3840 };
    for (let i = 0; i < SHRINK_HOLD_TICKS * 3; i++) size = nextSurfaceSize(state, size, { width: 1120, height: 640 });
    expect(size).toEqual({ width: 1152, height: 640 });
  });

  it("never resizes when the requirement alternates between two sizes", () => {
    const state = createSurfaceSizeState();
    let size: { width: number; height: number } = { width: 64, height: 64 };
    const sizes = new Set<string>();
    for (let i = 0; i < 400; i++) {
      size = nextSurfaceSize(state, size, i % 2 === 0 ? { width: 1120, height: 3840 } : { width: 1120, height: 640 });
      sizes.add(`${size.width}x${size.height}`);
    }
    expect(sizes).toEqual(new Set(["1152x3840"]));
  });

  it("quantizes so single-pixel jitter never resizes the buffer", () => {
    const state = createSurfaceSizeState();
    let size: { width: number; height: number } = { width: 64, height: 64 };
    const sizes = new Set<string>();
    for (let i = 0; i < 400; i++) {
      size = nextSurfaceSize(state, size, { width: 1100 + (i % 3), height: 3800 + (i % 3) });
      sizes.add(`${size.width}x${size.height}`);
    }
    expect(sizes).toEqual(new Set(["1152x3840"]));
  });
});
