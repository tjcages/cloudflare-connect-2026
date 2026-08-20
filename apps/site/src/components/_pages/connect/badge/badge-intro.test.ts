import { describe, expect, it } from "vitest";
import { introDragTip, introHeldTwist } from "./badge-intro";
import { BADGE_TUNE_DEFAULTS } from "./badge-tune";

describe("badge intro pose", () => {
  it("matches a full drag to the right, then a release", () => {
    const tip = introDragTip(
      BADGE_TUNE_DEFAULTS.dragLimitX,
      BADGE_TUNE_DEFAULTS.inwardZ
    );
    expect(tip.x).toBe(BADGE_TUNE_DEFAULTS.dragLimitX);
    expect(tip.z).toBeCloseTo(
      -BADGE_TUNE_DEFAULTS.dragLimitX * BADGE_TUNE_DEFAULTS.inwardZ
    );
    const held = introHeldTwist(tip.x, BADGE_TUNE_DEFAULTS);
    expect(held.y).toBeCloseTo(-BADGE_TUNE_DEFAULTS.twistMax);
    expect(held.z).toBeGreaterThan(0);
    expect(held.z).toBeLessThanOrEqual(BADGE_TUNE_DEFAULTS.rollMax);
  });
});
