import { describe, expect, it } from "vitest";
import {
  COMET_LOGO_FORMATION_DURATION_SEC,
  COMET_LOGO_REJOIN_DURATION_SEC,
  cometLogoRejoinWindowSec,
  advanceCometLogoAnimation,
  createCometLogoAnimationState,
} from "./animation";
import {
  COMET_LOGO_BACKGROUND_POINT_COUNT,
  COMET_LOGO_EVENT_GROUP_COUNT,
  COMET_LOGO_EVENT_SPARK_POINT_COUNT,
  COMET_LOGO_NEEDLE_SPARK_POINT_COUNT,
  COMET_LOGO_SPARK_ANCHOR_INDICES,
  COMET_LOGO_SPARK_POINT_COUNT,
  COMET_LOGO_TRAIL_SEGMENT_COUNT,
} from "./points";
import { COMET_LOGO_DEFAULT_SHAPE, cometLogoPointCounts } from "./shape";

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
    const counts = cometLogoPointCounts(COMET_LOGO_DEFAULT_SHAPE);
    expect(counts.logo).toBe(128);
    expect(COMET_LOGO_BACKGROUND_POINT_COUNT).toBe(160);
    expect(counts.render).toBe(288);
    expect(COMET_LOGO_SPARK_ANCHOR_INDICES).toHaveLength(81);
    expect(COMET_LOGO_DEFAULT_SHAPE.sparkAnchorIndices).toHaveLength(81);
    expect(COMET_LOGO_NEEDLE_SPARK_POINT_COUNT).toBe(48);
    expect(COMET_LOGO_EVENT_SPARK_POINT_COUNT).toBe(48);
    expect(COMET_LOGO_EVENT_GROUP_COUNT).toBe(8);
    expect(COMET_LOGO_SPARK_POINT_COUNT).toBe(96);
    expect(counts.activeRender).toBe(384);
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

  it("keeps the default rejoin window bit-identical to before this task", () => {
    expect(cometLogoRejoinWindowSec(COMET_LOGO_REJOIN_DURATION_SEC)).toBeCloseTo(1.748, 5);
  });

  it("computes the CTA's rejoin window with the margin zeroed out", () => {
    expect(cometLogoRejoinWindowSec(1.08, 0.85, 0)).toBeCloseTo(0.918, 5);
  });

  it("lets the deform finish when interrupt is 2", () => {
    let s = createCometLogoAnimationState(0);
    s = advanceCometLogoAnimation(s, 0, true, 1.55, 1.08, 0.85, 2, 0);
    for (let t = 0.1; t <= 2.0; t += 0.1) s = advanceCometLogoAnimation(s, t, true, 1.55, 1.08, 0.85, 2, 0);
    expect(s.mode).toBe("logo");

    s = advanceCometLogoAnimation(s, 2.1, false, 1.55, 1.08, 0.85, 2, 0);
    expect(s.mode).toBe("rejoining");
    // re-hover immediately: the rejoin must continue rather than cut back
    s = advanceCometLogoAnimation(s, 2.2, true, 1.55, 1.08, 0.85, 2, 0);
    expect(s.mode).toBe("rejoining");
  });

  it("reports a formation that restarts from zero", () => {
    let s = createCometLogoAnimationState(0);
    s = advanceCometLogoAnimation(s, 0, true, 1.55, 1.08, 0.85, 2, 0);
    for (let t = 0.1; t <= 2.0; t += 0.1) s = advanceCometLogoAnimation(s, t, true, 1.55, 1.08, 0.85, 2, 0);
    s = advanceCometLogoAnimation(s, 2.1, false, 1.55, 1.08, 0.85, 2, 0);
    for (let t = 2.2; t <= 3.4 && s.mode !== "forming"; t += 0.1) {
      s = advanceCometLogoAnimation(s, t, true, 1.55, 1.08, 0.85, 2, 0);
    }
    expect(s.mode).toBe("forming");
    expect(s.formation).toBeLessThanOrEqual(0.001);
  });

  it("cuts over immediately when interrupt is 0", () => {
    let s = createCometLogoAnimationState(0);
    s = advanceCometLogoAnimation(s, 0, true, 1.55, 1.08, 0.85, 2, 0);
    for (let t = 0.1; t <= 2.0; t += 0.1) s = advanceCometLogoAnimation(s, t, true, 1.55, 1.08, 0.85, 2, 0);
    expect(s.mode).toBe("logo");

    s = advanceCometLogoAnimation(s, 2.1, false, 1.55, 1.08, 0.85, 2, 0);
    s = advanceCometLogoAnimation(s, 2.2, false, 1.55, 1.08, 0.85, 2, 0);
    expect(s.mode).toBe("rejoining");
    expect(s.rejoinProgress).toBeCloseTo(0.10893246187363843, 5);

    s = advanceCometLogoAnimation(s, 2.3, true, 1.55, 1.08, 0.85, 0, 0);
    expect(s.mode).toBe("forming");
    expect(s.formation).toBe(0);
    expect(s.formationVelocity).toBe(0);
    expect(s.rejoinProgress).toBe(0);
  });

  it("rewinds mid-rejoin when interrupt is 1", () => {
    let s = createCometLogoAnimationState(0);
    s = advanceCometLogoAnimation(s, 0, true, 1.55, 1.08, 0.85, 2, 0);
    for (let t = 0.1; t <= 2.0; t += 0.1) s = advanceCometLogoAnimation(s, t, true, 1.55, 1.08, 0.85, 2, 0);
    expect(s.mode).toBe("logo");

    s = advanceCometLogoAnimation(s, 2.1, false, 1.55, 1.08, 0.85, 2, 0);
    s = advanceCometLogoAnimation(s, 2.2, false, 1.55, 1.08, 0.85, 2, 0);
    s = advanceCometLogoAnimation(s, 2.3, false, 1.55, 1.08, 0.85, 2, 0);
    s = advanceCometLogoAnimation(s, 2.4, false, 1.55, 1.08, 0.85, 2, 0);
    s = advanceCometLogoAnimation(s, 2.5, false, 1.55, 1.08, 0.85, 2, 0);
    s = advanceCometLogoAnimation(s, 2.6, false, 1.55, 1.08, 0.85, 2, 0);
    s = advanceCometLogoAnimation(s, 2.7, false, 1.55, 1.08, 0.85, 2, 0);
    expect(s.mode).toBe("rejoining");
    expect(s.rejoinProgress).toBeCloseTo(0.6535947712418302, 5);

    s = advanceCometLogoAnimation(s, 2.8, true, 1.55, 1.08, 0.85, 1, 0);
    expect(s.mode).toBe("rejoining");
    expect(s.rejoinProgress).toBeCloseTo(0.2178649237472783, 5);
    expect(s.rejoinStartFieldTimeSec).toBeCloseTo(2.6, 5);

    s = advanceCometLogoAnimation(s, 2.9, true, 1.55, 1.08, 0.85, 1, 0);
    expect(s.mode).toBe("forming");
    expect(s.formation).toBe(1);
    expect(s.rejoinProgress).toBe(0);
  });
});
