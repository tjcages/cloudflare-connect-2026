import { describe, expect, it } from "vitest";
import {
  COMET_LOGO_FORMATION_DURATION_SEC,
  COMET_LOGO_REJOIN_DURATION_SEC,
  cometLogoRejoinWindowSec,
  advanceCometLogoAnimation,
  createCometLogoAnimationState,
} from "./animation";
import {
  COMET_LOGO_ACTIVE_RENDER_POINT_COUNT,
  COMET_LOGO_BACKGROUND_POINT_COUNT,
  COMET_LOGO_EVENT_GROUP_COUNT,
  COMET_LOGO_EVENT_SPARK_POINT_COUNT,
  COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT,
  COMET_LOGO_IDLE_RENDER_POINT_COUNT,
  COMET_LOGO_NEEDLE_SPARK_POINT_COUNT,
  COMET_LOGO_POINT_COUNT,
  COMET_LOGO_RENDER_POINT_COUNT,
  COMET_LOGO_SPARK_ANCHOR_POINTS,
  COMET_LOGO_SPARK_POINT_COUNT,
  COMET_LOGO_TRAIL_SEGMENT_COUNT,
} from "./points";

describe("comet logo animation", () => {
  function advanceFor(initial: ReturnType<typeof createCometLogoAnimationState>, seconds: number, hovered: boolean) {
    let state = initial;
    const start = state.lastTimeSec ?? 0;
    let time = start + 0.1;
    for (; time <= start + seconds + 0.0001; time += 0.1) {
      state = advanceCometLogoAnimation(state, time, hovered);
    }
    if ((state.lastTimeSec ?? start) < start + seconds - 0.0001) {
      state = advanceCometLogoAnimation(state, start + seconds, hovered);
    }
    return state;
  }

  it("keeps one comet for each existing logo point", () => {
    expect(COMET_LOGO_POINT_COUNT).toBe(128);
    expect(COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT).toBe(160);
    expect(COMET_LOGO_BACKGROUND_POINT_COUNT).toBe(160);
    expect(COMET_LOGO_IDLE_RENDER_POINT_COUNT).toBe(288);
    expect(COMET_LOGO_RENDER_POINT_COUNT).toBe(288);
    expect(COMET_LOGO_SPARK_ANCHOR_POINTS).toHaveLength(81);
    expect(COMET_LOGO_NEEDLE_SPARK_POINT_COUNT).toBe(48);
    expect(COMET_LOGO_EVENT_SPARK_POINT_COUNT).toBe(48);
    expect(COMET_LOGO_EVENT_GROUP_COUNT).toBe(8);
    expect(COMET_LOGO_SPARK_POINT_COUNT).toBe(96);
    expect(COMET_LOGO_ACTIVE_RENDER_POINT_COUNT).toBe(384);
    expect(COMET_LOGO_TRAIL_SEGMENT_COUNT).toBe(8);
  });

  it("keeps field time moving while existing comets steer into the logo", () => {
    let state = advanceCometLogoAnimation(createCometLogoAnimationState(), 1, false);
    state = advanceCometLogoAnimation(state, 1.1, false);
    const movingFieldTime = state.fieldTimeSec;
    state = advanceCometLogoAnimation(state, 1.2, true);
    const steeringFieldTime = state.fieldTimeSec;
    state = advanceCometLogoAnimation(state, 1.3, true);

    expect(steeringFieldTime).toBeGreaterThan(movingFieldTime);
    expect(state.fieldTimeSec).toBeGreaterThan(steeringFieldTime);
    expect(state.formation).toBeGreaterThan(0);
    expect(state.formationVelocity).toBeGreaterThan(0);
    expect(state.mode).toBe("forming");
  });

  it("rejoins a later field trajectory on a dedicated forward-moving path", () => {
    let state = advanceCometLogoAnimation(createCometLogoAnimationState(), 0, false);
    state = advanceFor(state, COMET_LOGO_FORMATION_DURATION_SEC, true);
    const formedFieldTime = state.fieldTimeSec;
    state = advanceCometLogoAnimation(state, COMET_LOGO_FORMATION_DURATION_SEC + 0.1, false);

    expect(state.formation).toBe(1);
    expect(state.fieldTimeSec).toBeGreaterThan(formedFieldTime);
    expect(state.formationVelocity).toBe(0);
    expect(state.mode).toBe("rejoining");
    expect(state.rejoinProgress).toBe(0);

    const window = cometLogoRejoinWindowSec(COMET_LOGO_REJOIN_DURATION_SEC);
    state = advanceFor(state, window / 2, false);
    expect(state.mode).toBe("rejoining");
    expect(state.rejoinProgress).toBeCloseTo(0.5, 1);

    state = advanceFor(state, window / 2 + 0.2, false);
    expect(state.formation).toBe(0);
    expect(state.fieldTimeSec).toBeGreaterThan(formedFieldTime);
    expect(state.mode).toBe("field");
  });

  it("preserves the current steering velocity when a partial formation rejoins", () => {
    let state = advanceCometLogoAnimation(createCometLogoAnimationState(), 0, false);
    state = advanceFor(state, COMET_LOGO_FORMATION_DURATION_SEC / 2, true);
    const formation = state.formation;
    const formationVelocity = state.formationVelocity;
    state = advanceCometLogoAnimation(state, (state.lastTimeSec ?? 0) + 0.1, false);

    expect(state.mode).toBe("rejoining");
    expect(state.rejoinStartFormation).toBe(formation);
    expect(state.rejoinStartFormationVelocity).toBe(formationVelocity);
  });

  it("cancels micro-hover formation without entering the rejoin path", () => {
    const microHoverSec = COMET_LOGO_FORMATION_DURATION_SEC * 0.05;
    let state = advanceCometLogoAnimation(createCometLogoAnimationState(), 0, false);
    state = advanceCometLogoAnimation(state, microHoverSec, true);

    expect(state.formation).toBeGreaterThan(0);
    expect(state.formation).toBeLessThanOrEqual(0.1);

    state = advanceCometLogoAnimation(state, microHoverSec + 0.01, false);

    expect(state.mode).toBe("field");
    expect(state.formation).toBe(0);
    expect(state.formationVelocity).toBe(0);
    expect(state.rejoinProgress).toBe(0);
  });
});
