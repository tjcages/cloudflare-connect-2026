/**
 * Fixed-timestep scheduling for the water heightfield sim.
 *
 * The heightfield pass advances the wave by exactly one sub-step per dispatch,
 * so wave speed is set by sub-steps per *second*. Dispatching a fixed count per
 * rendered frame ties that to the display: the same stroke propagates twice as
 * far at 60Hz as at 30Hz, four times as far at 120Hz. Deriving the count from
 * elapsed wall-clock time instead holds the wave to one speed everywhere, and
 * restores the invariant the frame cap already documents — skipping a render
 * lowers the paint rate, never the animation speed.
 */

/** Frame rate the cursor wave was tuned at, back when configs capped at 30fps. */
const REFERENCE_FPS = 30;

/** Sub-steps one reference frame is worth; the count the sim used to run per rendered frame. */
export const SUBSTEPS_PER_REFERENCE_FRAME = 15;

/** Seconds in one reference frame. Per-frame quantities are expressed against this. */
export const REFERENCE_FRAME_SECONDS = 1 / REFERENCE_FPS;

/** The rate every frame rate now reproduces: 450 sub-steps per second. */
export const SUBSTEPS_PER_SECOND = REFERENCE_FPS * SUBSTEPS_PER_REFERENCE_FRAME;

/** Longest wall-clock gap one frame may simulate. A longer stall resyncs instead of catching up. */
export const MAX_STEP_SECONDS = 0.1;

/** Ceiling on a single frame's burst, so a stall can never spiral into an ever-growing catch-up. */
export const MAX_SUBSTEPS_PER_FRAME = Math.round(MAX_STEP_SECONDS * SUBSTEPS_PER_SECOND);

export type SubstepAccumulator = {
  /**
   * Sub-steps owed for `dtSeconds` of wall clock. The fractional remainder is
   * carried into the next frame, so the long-run rate stays exact even when a
   * frame is not a whole number of sub-steps.
   */
  take(dtSeconds: number): number;
};

export function createSubstepAccumulator(): SubstepAccumulator {
  let carry = 0;
  return {
    take(dtSeconds) {
      if (!(dtSeconds > 0)) return 0;
      carry += Math.min(dtSeconds, MAX_STEP_SECONDS) * SUBSTEPS_PER_SECOND;
      // A frame that lands one float ulp under a whole sub-step still owes it.
      const steps = Math.min(Math.floor(carry + 1e-6), MAX_SUBSTEPS_PER_FRAME);
      if (steps <= 0) return 0;
      carry = Math.max(0, carry - steps);
      return steps;
    },
  };
}
