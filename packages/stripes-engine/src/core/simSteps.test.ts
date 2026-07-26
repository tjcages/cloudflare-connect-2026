import { describe, expect, it } from "vitest";
import {
  createSubstepAccumulator,
  MAX_STEP_SECONDS,
  MAX_SUBSTEPS_PER_FRAME,
  SUBSTEPS_PER_REFERENCE_FRAME,
  SUBSTEPS_PER_SECOND,
} from "./simSteps";

describe("substep accumulator", () => {
  it("hands a reference frame exactly the legacy sub-step count", () => {
    const acc = createSubstepAccumulator();
    for (let i = 0; i < 30; i++) {
      expect(acc.take(1 / 30)).toBe(SUBSTEPS_PER_REFERENCE_FRAME);
    }
  });

  it("holds one sub-step rate across frame rates", () => {
    for (const fps of [24, 30, 48, 60, 75, 90, 120, 144, 165, 240]) {
      const acc = createSubstepAccumulator();
      let steps = 0;
      for (let i = 0; i < fps; i++) steps += acc.take(1 / fps);
      // One second of wall clock, minus at most the sub-step still in carry.
      expect(steps).toBeGreaterThanOrEqual(SUBSTEPS_PER_SECOND - 1);
      expect(steps).toBeLessThanOrEqual(SUBSTEPS_PER_SECOND);
    }
  });

  it("carries the fraction instead of dropping it", () => {
    const acc = createSubstepAccumulator();
    // 1/60s owes 7.5 sub-steps, so consecutive frames must alternate 7 and 8.
    const runs = [acc.take(1 / 60), acc.take(1 / 60), acc.take(1 / 60), acc.take(1 / 60)];
    expect(runs).toEqual([7, 8, 7, 8]);
  });

  it("ignores non-advancing time", () => {
    const acc = createSubstepAccumulator();
    expect(acc.take(0)).toBe(0);
    expect(acc.take(-1)).toBe(0);
    expect(acc.take(Number.NaN)).toBe(0);
  });

  it("caps a stall instead of bursting a catch-up spiral", () => {
    const acc = createSubstepAccumulator();
    expect(acc.take(5)).toBe(MAX_SUBSTEPS_PER_FRAME);
    expect(MAX_SUBSTEPS_PER_FRAME).toBe(Math.round(MAX_STEP_SECONDS * SUBSTEPS_PER_SECOND));
    // The stall is not re-paid on the next frame.
    expect(acc.take(1 / 60)).toBe(7);
  });
});
