import { describe, expect, it } from "vitest";
import {
  normalizeTwizzlerColor,
  normalizeTwizzlerSettings,
  twizzlerAnimationTime,
  twizzlerBendOffset,
  twizzlerDepthScale,
  twizzlerEdgeHeights,
  twizzlerLerpColor,
  twizzlerNearness,
  twizzlerNoise,
  twizzlerPathBend,
  twizzlerPointX,
} from "./twizzler";

describe("Twizzler", () => {
  it("produces deterministic noise in the p5-style 0–1 range", () => {
    const first = twizzlerNoise(0.21, 0.42, 0.63);
    expect(first).toBe(twizzlerNoise(0.21, 0.42, 0.63));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(1);
  });

  it("normalizes its expanded user controls", () => {
    expect(normalizeTwizzlerColor("#FF0000")).toBe("#ff0000");
    expect(
      normalizeTwizzlerSettings({
        scale: 8,
        lineCount: 0,
        wrinkles: 99,
        bendPosition: 2,
        bendAmount: -3,
        leftHeight: 4,
        rightHeight: -4,
      }),
    ).toMatchObject({
      scale: 3,
      lineCount: 1,
      wrinkles: 24,
      bendPosition: 1,
      bendAmount: -1,
      leftHeight: 2,
      rightHeight: -1,
    });
  });

  it("places the full bend at the selected horizontal position", () => {
    expect(twizzlerBendOffset(0.6, 0.6, 0.25)).toBe(0.25);
    expect(Math.abs(twizzlerBendOffset(0.1, 0.6, 0.25))).toBeLessThan(0.002);
    expect(twizzlerBendOffset(0.6, 0.6, -0.25)).toBe(-0.25);
  });

  it("sums multiple bend lobes for the path", () => {
    const settings = {
      bendPosition: 0.2,
      bendAmount: 0.2,
      bend2Position: 0.8,
      bend2Amount: -0.15,
      bend3Position: 0.5,
      bend3Amount: 0,
    };
    expect(twizzlerPathBend(0.2, settings)).toBeCloseTo(0.2, 2);
    expect(twizzlerPathBend(0.8, settings)).toBeCloseTo(-0.15, 2);
  });

  it("scales depth toward the camera peak", () => {
    const settings = {
      depthPosition: 0.6,
      depthAmount: 1,
      depthWidth: 0.2,
      depth2Position: 0.2,
      depth2Amount: 0,
      depth2Width: 0.2,
    };
    expect(twizzlerDepthScale(0.6, settings)).toBeCloseTo(2, 5);
    expect(twizzlerDepthScale(0, settings)).toBeLessThan(1.05);
    expect(twizzlerDepthScale(0.6, { ...settings, depthAmount: 0 })).toBe(1);
  });

  it("lerps peach-to-coral by nearness", () => {
    expect(twizzlerLerpColor("#ffd2b5", "#e8481c", 0)).toBe("#ffd2b5");
    expect(twizzlerLerpColor("#ffd2b5", "#e8481c", 1)).toBe("#e8481c");
    expect(twizzlerNearness(1, { depthAmount: 1, depth2Amount: 0 })).toBe(0);
    expect(twizzlerNearness(2, { depthAmount: 1, depth2Amount: 0 })).toBe(1);
  });

  it("always spans from the exact left edge to the exact right edge", () => {
    expect(twizzlerPointX(0, 64, 1280)).toBe(0);
    expect(twizzlerPointX(64, 64, 1280)).toBe(1280);
  });

  it("animates the left and right edge heights independently", () => {
    const settings = { leftHeight: 0.3, rightHeight: 0.7, edgeFluctuation: 0.2, edgeSpeed: 1 };
    const start = twizzlerEdgeHeights(0, 0, settings);
    const later = twizzlerEdgeHeights(0.5, 0, settings);
    expect(start.left).not.toBe(start.right);
    expect(later.left).not.toBe(start.left);
    expect(later.right).not.toBe(start.right);
  });

  it("freezes every animation source when master speed is zero", () => {
    expect(twizzlerAnimationTime(12.5, 0)).toBe(0);
    expect(twizzlerAnimationTime(12.5, 0.8)).toBe(10);
  });
});
