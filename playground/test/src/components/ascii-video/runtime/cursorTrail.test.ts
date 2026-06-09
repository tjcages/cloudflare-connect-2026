import { describe, expect, it } from "vitest";
import {
  applyCursorTrailToPixels,
  buildCursorTrailVisuals,
  createCursorTrailState,
  setCursorTrailTarget,
  updateCursorTrail,
} from "./cursorTrail";

describe("applyCursorTrailToPixels", () => {
  it("blends translucent white samples into the sampled frame", () => {
    const pixels = new Uint8ClampedArray(5 * 5 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i + 3] = 255;
    }

    applyCursorTrailToPixels(pixels, 5, 5, [{ x: 2, y: 2, alpha: 0.5, radius: 1 }]);

    const center = (2 * 5 + 2) * 4;
    const corner = 0;

    expect(pixels[center]).toBe(128);
    expect(pixels[center + 1]).toBe(128);
    expect(pixels[center + 2]).toBe(128);
    expect(pixels[center + 3]).toBe(255);
    expect(pixels[corner]).toBe(0);
    expect(pixels[corner + 1]).toBe(0);
    expect(pixels[corner + 2]).toBe(0);
    expect(pixels[corner + 3]).toBe(255);
  });
});

describe("updateCursorTrail", () => {
  it("reports clear rebuild frames after visible drops expire", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 2, y: 2 });

    const active = updateCursorTrail(state, 16);
    expect(active.changed).toBe(true);
    expect(active.samples.length).toBeGreaterThan(0);

    setCursorTrailTarget(state, null);
    let clearing = updateCursorTrail(state, 48);
    for (let i = 0; i < 9; i++) {
      clearing = updateCursorTrail(state, 48);
    }

    expect(clearing.changed).toBe(true);
    expect(clearing.samples).toEqual([]);
  });
});

describe("buildCursorTrailVisuals", () => {
  it("adds a soft neutral halo so white samples remain visible on a white canvas", () => {
    const visuals = buildCursorTrailVisuals([{ x: 2, y: 2, alpha: 0.5, radius: 10 }]);

    expect(visuals).toEqual([
      { x: 2, y: 2, radius: 14, alpha: 0.15, color: 0x111111 },
      { x: 2, y: 2, radius: 10, alpha: 0.35, color: 0xffffff },
    ]);
  });
});
