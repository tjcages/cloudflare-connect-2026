import { createSubstepAccumulator, MAX_STEP_SECONDS } from "../core/simSteps";
import { serpentinePoint } from "./revealMath";

/**
 * Fixed-timestep scheduling for the water reveal sweep.
 *
 * The reveal overrides the frame cap, so its heightfield ran at whatever the
 * display refreshed at: a fixed 15 sub-steps per rendered frame is 900/s on a
 * 60Hz panel and 1800/s on a 120Hz one, and the soak that finishes the image
 * was added once per frame with no regard for how long that frame was. Both are
 * now derived from elapsed wall clock against a 60fps reference — the rate the
 * look was tuned at — so the sweep, the ring-down and the soak run at one speed
 * on every display.
 */

/** Frame rate the reveal look is keyed to. 60fps reproduces it sub-step for sub-step. */
export const REVEAL_REFERENCE_FPS = 60;

/** Sub-steps one reference frame is worth; the count the sim used to run per rendered frame. */
export const REVEAL_SUBSTEPS_PER_REFERENCE_FRAME = 15;

/** Seconds in one reference frame. Per-frame quantities are expressed against this. */
export const REVEAL_REFERENCE_FRAME_SECONDS = 1 / REVEAL_REFERENCE_FPS;

/** The rate every frame rate now reproduces: 900 sub-steps per second. */
export const REVEAL_SUBSTEPS_PER_SECOND = REVEAL_REFERENCE_FPS * REVEAL_SUBSTEPS_PER_REFERENCE_FRAME;

export type WaterRevealPlan = {
  /** Sub-steps to dispatch this frame. 0 when the frame is too short to owe one. */
  substeps: number;
  /** Segment of sweep travel consumed by those sub-steps, in 0..1 sim UV with a GL-style origin. */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Splat intensity while the sweep is live, 0 through the settle ring-down. */
  amp: number;
  /** This frame's share of a reference frame. Per-frame cover gains scale by it. */
  soakScale: number;
};

export type WaterRevealStroke = {
  /**
   * Plan one frame of the sweep. Travel is only consumed on a frame that owes
   * sub-steps, so a frame short enough to owe none defers its segment to the
   * next one instead of dropping it.
   */
  advance(elapsedMs: number, sweepT: number, rows: number, wobble: number, intensity: number): WaterRevealPlan;
  /** Drop all carried state, for a reveal that restarts or is released. */
  reset(): void;
};

export function createWaterRevealStroke(): WaterRevealStroke {
  let accumulator = createSubstepAccumulator(REVEAL_SUBSTEPS_PER_SECOND);
  let lastElapsedMs = -1;
  let hasPoint = false;
  let prevX = 0;
  let prevY = 0;

  return {
    reset() {
      accumulator = createSubstepAccumulator(REVEAL_SUBSTEPS_PER_SECOND);
      lastElapsedMs = -1;
      hasPoint = false;
      prevX = 0;
      prevY = 0;
    },
    advance(elapsedMs, sweepT, rows, wobble, intensity) {
      // The first frame is credited one reference frame rather than zero, so the
      // opening burst the sweep has always laid down survives, identically at
      // every frame rate.
      const dtSeconds =
        lastElapsedMs < 0
          ? REVEAL_REFERENCE_FRAME_SECONDS
          : Math.max(0, Math.min(MAX_STEP_SECONDS, (elapsedMs - lastElapsedMs) / 1000));
      lastElapsedMs = elapsedMs;
      const substeps = accumulator.take(dtSeconds);

      let x = prevX;
      let y = prevY;
      let amp = 0;
      if (sweepT < 1) {
        const pt = serpentinePoint(sweepT, rows, wobble);
        x = pt.x;
        y = 1 - pt.y;
        amp = intensity;
      }
      if (!hasPoint) {
        prevX = x;
        prevY = y;
        hasPoint = true;
      }

      const plan: WaterRevealPlan = {
        substeps,
        ax: prevX,
        ay: prevY,
        bx: x,
        by: y,
        amp,
        soakScale: dtSeconds / REVEAL_REFERENCE_FRAME_SECONDS,
      };
      if (substeps > 0) {
        prevX = x;
        prevY = y;
      }
      return plan;
    },
  };
}
