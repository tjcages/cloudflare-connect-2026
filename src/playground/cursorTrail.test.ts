import { describe, expect, it } from "vitest";
import {
  applyCursorTrailToEffectPixels,
  buildDisplayFrameWithCursorTrail,
  createCursorTrailState,
  downsamplePixelsNearest,
  resolveCursorTrailRebuildBounds,
  setCursorTrailTarget,
  updateCursorTrail,
} from "./cursorTrail";
import {
  DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  resolveCursorTrailEffectSize,
} from "./playgroundCursorTrailConfig";

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

describe("applyCursorTrailToEffectPixels", () => {
  it("brightens the center and pushes neighboring pixels on a low-res buffer", () => {
    const displayWidth = 40;
    const displayHeight = 20;
    const effect = resolveCursorTrailEffectSize(displayWidth, displayHeight, DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG, 8, 8);
    const pixels = new Uint8ClampedArray(effect.width * effect.height * 4);
    for (let y = 0; y < effect.height; y++) {
      for (let x = 0; x < effect.width; x++) {
        const idx = (y * effect.width + x) * 4;
        const value = 60 + x * 8 + y * 4;
        pixels[idx] = value;
        pixels[idx + 1] = value;
        pixels[idx + 2] = value;
        pixels[idx + 3] = 255;
      }
    }

    const bounds = applyCursorTrailToEffectPixels(
      pixels,
      effect.width,
      effect.height,
      displayWidth,
      displayHeight,
      [{ x: 20, y: 10, pushX: 20, pushY: 10, alpha: 1, radius: 6 }],
      {
        ...DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
        pushRadiusScale: 3,
        pushStrengthPx: 6,
      },
    );

    const centerX = Math.round((20 * effect.width) / displayWidth);
    const centerY = Math.round((10 * effect.height) / displayHeight);
    const centerIdx = (centerY * effect.width + centerX) * 4;
    const centerValue = 60 + centerX * 8 + centerY * 4;
    expect(bounds).not.toBeNull();
    expect(pixels[centerIdx]).toBeGreaterThan(centerValue);
  });
});

describe("buildDisplayFrameWithCursorTrail", () => {
  it("upscales the composited low-res buffer to display size", () => {
    const displayWidth = 16;
    const displayHeight = 8;
    const effect = { width: 4, height: 2 };
    const base = new Uint8ClampedArray(effect.width * effect.height * 4);
    base.fill(0);
    for (let i = 3; i < base.length; i += 4) {
      base[i] = 255;
    }

    const { data } = buildDisplayFrameWithCursorTrail(
      base,
      effect.width,
      effect.height,
      displayWidth,
      displayHeight,
      [{ x: 8, y: 4, pushX: 8, pushY: 4, alpha: 1, radius: 4 }],
      DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
    );

    expect(data.length).toBe(displayWidth * displayHeight * 4);
    expect(data[3]).toBe(255);
  });
});

describe("downsamplePixelsNearest", () => {
  it("maps display pixels into a smaller effect buffer", () => {
    const source = new Uint8ClampedArray(4 * 4 * 4);
    source.fill(0);
    source[(0 * 4 + 2) * 4] = 200;
    const target = new Uint8ClampedArray(2 * 2 * 4);
    downsamplePixelsNearest(source, 4, 4, target, 2, 2);
    expect(target.some((value, index) => index % 4 === 0 && value === 200)).toBe(true);
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
