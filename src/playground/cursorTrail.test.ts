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

  it("repels source pixels away from the trail before whitening them", () => {
    const pixels = new Uint8ClampedArray(7 * 1 * 4);
    for (let x = 0; x < 7; x++) {
      const idx = x * 4;
      pixels[idx] = x * 40;
      pixels[idx + 1] = x * 40;
      pixels[idx + 2] = x * 40;
      pixels[idx + 3] = 255;
    }

    applyCursorTrailToPixels(pixels, 7, 1, [{ x: 3, y: 0, alpha: 0.2, radius: 3 }]);

    const pushedRight = 5 * 4;
    expect(pixels[pushedRight]).toBeLessThan(190);
    expect(pixels[pushedRight + 1]).toBeLessThan(190);
    expect(pixels[pushedRight + 2]).toBeLessThan(190);
    expect(pixels[pushedRight + 3]).toBe(255);
  });
});

describe("updateCursorTrail", () => {
  it("tracks the pointer directly without spring lag", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 0, y: 0 });
    updateCursorTrail(state, 16);

    setCursorTrailTarget(state, { x: 80, y: 0 });
    const active = updateCursorTrail(state, 48);

    expect(state.current).toEqual({ x: 80, y: 0 });
    expect(active.changed).toBe(true);
    expect(active.samples.length).toBeGreaterThan(1);
  });

  it("emits a dense trail and lets particles drift slowly after pointer movement", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 0, y: 0 });
    updateCursorTrail(state, 16);

    setCursorTrailTarget(state, { x: 80, y: 0 });
    const active = updateCursorTrail(state, 48);
    const next = updateCursorTrail(state, 48);

    expect(active.changed).toBe(true);
    expect(active.samples.length).toBeGreaterThanOrEqual(24);
    expect(
      next.samples.some(
        (sample, index) => sample.x !== active.samples[index]?.x || sample.y !== active.samples[index]?.y,
      ),
    ).toBe(true);
    const maxDrift = Math.max(
      ...next.samples.map((sample, index) => {
        const previous = active.samples[index] ?? sample;
        return Math.hypot(sample.x - previous.x, sample.y - previous.y);
      }),
    );
    expect(maxDrift).toBeLessThan(18);
  });

  it("reports clear rebuild frames after visible drops expire", () => {
    const state = createCursorTrailState();
    setCursorTrailTarget(state, { x: 2, y: 2 });

    const active = updateCursorTrail(state, 16);
    expect(active.changed).toBe(true);
    expect(active.samples.length).toBeGreaterThan(0);

    setCursorTrailTarget(state, null);
    let clearing = updateCursorTrail(state, 48);
    for (let i = 0; i < 30 && clearing.samples.length > 0; i++) {
      clearing = updateCursorTrail(state, 48);
    }

    expect(clearing.changed).toBe(true);
    expect(clearing.samples).toEqual([]);
  });
});

describe("buildCursorTrailVisuals", () => {
  it("does not draw a direct overlay because stripes should visualize the trail", () => {
    const visuals = buildCursorTrailVisuals([{ x: 2, y: 2, alpha: 0.5, radius: 10 }]);

    expect(visuals).toEqual([]);
  });
});
