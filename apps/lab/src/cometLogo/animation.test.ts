import { describe, expect, it } from "vitest";
import {
  COMET_LOGO_CAPTURE_END,
  COMET_LOGO_CYCLE_DURATION_SEC,
  COMET_LOGO_LAYER_COUNT,
  COMET_LOGO_RELEASE_START,
  advanceCometLogoAnimation,
  cometLogoCaptureEnvelope,
  cometLogoLayerLifecycle,
  cometLogoLayerProgress,
  createCometLogoAnimationState,
} from "./animation";
import {
  COMET_LOGO_BACKGROUND_POINT_COUNT,
  COMET_LOGO_CONTOUR_SPLIT_INDEX,
  COMET_LOGO_POINTS,
  COMET_LOGO_POINT_COUNT,
  COMET_LOGO_RENDER_POINT_COUNT,
  COMET_LOGO_TRAIL_SEGMENT_COUNT,
} from "./points";

describe("comet logo animation", () => {
  it("renders five nested logos plus the surrounding comet field", () => {
    expect(COMET_LOGO_POINT_COUNT).toBe(128);
    expect(COMET_LOGO_LAYER_COUNT).toBe(5);
    expect(COMET_LOGO_CYCLE_DURATION_SEC).toBe(9.2);
    expect(COMET_LOGO_BACKGROUND_POINT_COUNT).toBe(160);
    expect(COMET_LOGO_RENDER_POINT_COUNT).toBe(800);
    expect(COMET_LOGO_TRAIL_SEGMENT_COUNT).toBe(3);
  });

  it("keeps both rotating logo contours closed without a cross-logo jump", () => {
    const distance = (from: readonly [number, number], to: readonly [number, number]) =>
      Math.hypot(to[0] - from[0], to[1] - from[1]);

    expect(distance(COMET_LOGO_POINTS[COMET_LOGO_CONTOUR_SPLIT_INDEX - 1], COMET_LOGO_POINTS[0])).toBeLessThan(0.1);
    expect(distance(COMET_LOGO_POINTS.at(-1)!, COMET_LOGO_POINTS[COMET_LOGO_CONTOUR_SPLIT_INDEX])).toBeLessThan(0.1);
  });

  it("spaces every logo generation evenly through one cycle", () => {
    const progress = Array.from({ length: COMET_LOGO_LAYER_COUNT }, (_, index) => cometLogoLayerProgress(0, index));

    progress.forEach((value, index) => {
      expect(value).toBeCloseTo(index / COMET_LOGO_LAYER_COUNT, 10);
    });
  });

  it("releases the oldest logo without fading while a new one emerges", () => {
    const newest = cometLogoLayerLifecycle(COMET_LOGO_CYCLE_DURATION_SEC * 0.04, 0);
    const oldest = cometLogoLayerLifecycle(COMET_LOGO_CYCLE_DURATION_SEC * 0.04, COMET_LOGO_LAYER_COUNT - 1);

    expect(newest.emergence).toBeGreaterThan(0);
    expect(newest.release).toBe(0);
    expect(oldest.progress).toBeGreaterThan(COMET_LOGO_RELEASE_START);
    expect(oldest.release).toBeGreaterThan(0);
    expect(oldest.opacity).toBe(1);
  });

  it("finishes the center-particle morph before the next logo generation wraps", () => {
    const generationInterval = 1 / COMET_LOGO_LAYER_COUNT;

    expect(cometLogoCaptureEnvelope(0)).toBe(0);
    expect(cometLogoCaptureEnvelope(0.06)).toBeGreaterThan(0.9);
    expect(cometLogoCaptureEnvelope(COMET_LOGO_CAPTURE_END)).toBe(0);
    expect(cometLogoCaptureEnvelope(generationInterval - 0.0001)).toBe(0);
  });

  it("wraps without resetting the global animation clock", () => {
    const beforeWrap = createCometLogoAnimationState(COMET_LOGO_CYCLE_DURATION_SEC - 0.01);
    const afterWrap = advanceCometLogoAnimation(beforeWrap, COMET_LOGO_CYCLE_DURATION_SEC + 0.01);

    expect(afterWrap.timeSec).toBeGreaterThan(beforeWrap.timeSec);
    expect(afterWrap.cycleProgress).toBeCloseTo(0.01 / COMET_LOGO_CYCLE_DURATION_SEC, 6);
  });

  it("stays deterministic when the authoring timeline scrubs backwards", () => {
    const state = advanceCometLogoAnimation(createCometLogoAnimationState(4), 1.25);

    expect(state).toEqual(createCometLogoAnimationState(1.25));
  });
});
