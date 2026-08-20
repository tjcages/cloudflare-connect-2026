import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { BADGE_TUNE_DEFAULTS } from "./badge-tune";
import {
  BADGE_CHAIN_BONES,
  BADGE_ROPE_POINTS,
  preventStrapCatch,
  ropeIsAsleep,
  type RopeState,
  stepRope,
  updateStretch,
} from "./badge-rope";

function restRope(): RopeState {
  const rest = 0.03;
  const restPoints = Array.from(
    { length: BADGE_ROPE_POINTS },
    (_, index) => new Vector3(0, index * rest, 0)
  );
  return {
    now: restPoints.map((point) => point.clone()),
    prev: restPoints.map((point) => point.clone()),
    restPoints,
    rest,
    pin: restPoints[restPoints.length - 1]!.clone(),
    stretch: 1,
  };
}

describe("badge rope", () => {
  it("uses four bones so the strap cannot accordion on itself", () => {
    expect(BADGE_CHAIN_BONES).toBe(4);
    expect(BADGE_ROPE_POINTS).toBe(5);
  });

  it("does not treat a vertically bunched strap as asleep", () => {
    const rope = restRope();
    rope.now[0]!.y = 0.04;
    rope.prev[0]!.y = 0.04;
    expect(ropeIsAsleep(rope)).toBe(false);
  });

  it("lets the badge rise past rest instead of slamming the tip down", () => {
    const rope = restRope();
    const restY = rope.restPoints[0]!.y;
    rope.now[0]!.y = restY + 0.03;
    preventStrapCatch(rope, BADGE_TUNE_DEFAULTS);
    expect(rope.now[0]!.y).toBeGreaterThan(restY);
  });

  it("unfolds a strap that has collapsed onto the card", () => {
    const rope = restRope();
    rope.now[1]!.set(0.01, rope.now[0]!.y - 0.002, 0);
    preventStrapCatch(rope, BADGE_TUNE_DEFAULTS);
    expect(rope.now[1]!.y).toBeGreaterThan(rope.now[0]!.y);
    expect(Math.abs(rope.now[1]!.x - rope.now[0]!.x)).toBeGreaterThan(
      BADGE_TUNE_DEFAULTS.cardWidth * 0.4
    );
  });

  it("lengthens for a far sideways pull instead of keeping rest length", () => {
    const rope = restRope();
    rope.now[0]!.x = 0.28;
    updateStretch(rope, new Vector3(0.28, 0, 0), 0.047);
    expect(rope.stretch).toBeGreaterThan(1.2);
  });

  it("shortens when the badge lifts so the strap cannot buckle", () => {
    const rope = restRope();
    rope.now[0]!.y = 0.07;
    updateStretch(rope, null, 0.047);
    expect(rope.stretch).toBeLessThan(1);
  });

  it("keeps midpoints above the tip after a far drag", () => {
    const rope = restRope();
    const drag = new Vector3(0.28, 0.04, -0.056);
    for (let i = 0; i < 24; i += 1) {
      stepRope(rope, drag, 1 / 60, false, BADGE_TUNE_DEFAULTS);
    }
    const tip = rope.now[0]!;
    for (let index = 1; index < rope.now.length; index += 1) {
      expect(rope.now[index]!.y).toBeGreaterThan(tip.y);
    }
  });
});
