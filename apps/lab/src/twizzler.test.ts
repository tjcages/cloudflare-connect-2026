import { describe, expect, it } from "vitest";
import {
  buildTwizzlerLines,
  normalizeTwizzlerColor,
  normalizeTwizzlerSettings,
  twizzlerAnimationTime,
  twizzlerBendOffset,
  twizzlerDepthScale,
  twizzlerEdgeHeights,
  twizzlerLerpColor,
  twizzlerFaceAmount,
  twizzlerFiberNearness,
  twizzlerFogAmount,
  twizzlerFogColor,
  twizzlerDepthYBias,
  twizzlerGapWarpedAcross,
  twizzlerStrokeWidthScale,
  twizzlerUnevenAcross,
  twizzlerMarketingCenterY,
  twizzlerMarketingTwist,
  twizzlerMarketingWidth,
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

  it("builds a marketing ribbon that pinches then fans toward the right", () => {
    const settings = normalizeTwizzlerSettings({
      amplitude: 0.55,
      depthSpread: 0.85,
      twist: 1.35,
      leftHeight: 0.7,
      rightHeight: 0.28,
      scale: 1,
      centerY: 0.52,
    });
    const leftW = twizzlerMarketingWidth(0.1, settings);
    const fanW = twizzlerMarketingWidth(0.9, settings);
    expect(fanW).toBeGreaterThan(leftW);

    // Pinch comes from twist (edge-on), fan from face-on + width growth.
    const valleyFace = twizzlerFaceAmount(twizzlerMarketingTwist(0.4, settings, 0));
    const fanFace = twizzlerFaceAmount(twizzlerMarketingTwist(0.9, settings, 0));
    expect(fanFace).toBeGreaterThan(valleyFace);

    const leftY = twizzlerMarketingCenterY(0.05, settings, 0);
    const rightY = twizzlerMarketingCenterY(0.95, settings, 0);
    expect(rightY).toBeLessThan(leftY); // rises toward top of canvas

    const { lines } = buildTwizzlerLines(1600, 320, 0, { ...settings, lineCount: 40, pointSpacing: 4, speed: 0 });
    expect(lines).toHaveLength(40);
    expect(lines[0]?.points.length).toBeGreaterThan(10);
    expect(lines[0]?.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(lines[0]?.nearness).toBeGreaterThanOrEqual(0);
    expect(lines[0]?.nearness).toBeLessThanOrEqual(1);
    expect(lines[0]?.strokeWidth).toBeGreaterThan(0);
  });

  it("fogs far fibers toward white and drops far fibers lowest on the right", () => {
    expect(twizzlerFogColor("#e8481c", 0)).toBe("#e8481c");
    expect(twizzlerFogColor("#e8481c", 1)).toBe("#ffffff");
    expect(twizzlerFogAmount(1)).toBe(0);
    expect(twizzlerFogAmount(0)).toBe(1);
    expect(twizzlerFogAmount(0.2)).toBeGreaterThan(0.7);
    expect(twizzlerStrokeWidthScale(1)).toBeGreaterThan(twizzlerStrokeWidthScale(0) * 5);
    // Right edge: far (nearness 0) must sit lower on screen than near (nearness 1).
    expect(twizzlerDepthYBias(0, 320, 0.85, 0.95, 1.5, 0)).toBeGreaterThan(
      twizzlerDepthYBias(1, 320, 0.85, 0.95, 1.5, 0),
    );
    expect(twizzlerDepthYBias(0, 320, 0.9, 0.95, 1.8, 1)).toBeGreaterThan(
      twizzlerDepthYBias(1, 320, 0.9, 0.95, 1.8, 1),
    );
    expect(twizzlerDepthYBias(0, 320, 1, 0.95, 2, 2)).toBeGreaterThan(twizzlerDepthYBias(1, 320, 1, 0.95, 2, 2));

    const slots = twizzlerUnevenAcross(12, 0.6);
    expect(slots).toHaveLength(12);
    expect(slots[0]).toBeLessThan(slots[slots.length - 1]);
    const evenGaps = Array.from({ length: 11 }, (_, i) => slots[i + 1]! - slots[i]!);
    const gapSpread = Math.max(...evenGaps) - Math.min(...evenGaps);
    expect(gapSpread).toBeGreaterThan(0.02);

    // Along-X gap warp must change packing a lot from left to right.
    const leftGap = twizzlerGapWarpedAcross(0.6, 0.15, 4, 1.2);
    const midGap = twizzlerGapWarpedAcross(0.6, 0.5, 4, 1.2);
    const rightGap = twizzlerGapWarpedAcross(0.6, 0.88, 4, 1.2);
    expect(Math.abs(leftGap - rightGap)).toBeGreaterThan(0.08);
    expect(Math.abs(leftGap - midGap) + Math.abs(midGap - rightGap)).toBeGreaterThan(0.12);

    const settings = normalizeTwizzlerSettings({
      depthAmount: 1.15,
      depthPosition: 0.86,
      depthWidth: 0.36,
      twist: 1.15,
    });
    // Across stack dominates nearness (do not wash out Z on the right).
    const farRight = twizzlerFiberNearness(-1, 0.95, settings, 0);
    const nearRight = twizzlerFiberNearness(1, 0.95, settings, 0);
    expect(nearRight).toBeGreaterThan(farRight + 0.35);
    const left = twizzlerFiberNearness(0, 0.1, settings, 0);
    const right = twizzlerFiberNearness(0, 0.95, settings, 0);
    expect(right).toBeGreaterThan(left);
  });
});
