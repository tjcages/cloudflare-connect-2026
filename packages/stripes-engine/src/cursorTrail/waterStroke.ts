import { createSubstepAccumulator, REFERENCE_FRAME_SECONDS } from "../core/simSteps";

/**
 * Cursor travel (display px per reference frame) -> splat amplitude. Keyed to a
 * reference frame rather than to the real frame, so a stroke at a given speed
 * lays down the same crest — and saturates the clamp at the same speed — on
 * every display.
 */
const SPEED_TO_AMP = 0.12;
/** After the cursor leaves, one last release pulse decaying over this window. */
const EXIT_RELEASE_MS = 400;
const EXIT_RELEASE_AMP = 0.45;

export type WaterStrokeCursor = { x: number; y: number } | null;

export type WaterStrokePlan = {
  /** Sub-steps to dispatch this frame. 0 when the frame is too short to owe one. */
  substeps: number;
  /** Segment of cursor travel, display px, consumed by those sub-steps. */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  amp: number;
};

export type WaterStroke = {
  /**
   * Plan one frame of splatting. Travel is only consumed on a frame that owes
   * sub-steps, so a frame short enough to owe none defers its segment to the
   * next one instead of dropping it.
   */
  advance(nowMs: number, dtSeconds: number, cursor: WaterStrokeCursor): WaterStrokePlan;
};

export function createWaterStroke(): WaterStroke {
  const accumulator = createSubstepAccumulator();
  let hadCursor = false;
  let prevX = 0;
  let prevY = 0;
  let pendingSeconds = 0;
  let exitMs = -Infinity;
  let exitX = 0;
  let exitY = 0;

  return {
    advance(nowMs, dtSeconds, cursor) {
      const substeps = accumulator.take(dtSeconds);
      let amp = 0;
      let ax = 0;
      let ay = 0;
      let bx = 0;
      let by = 0;

      if (cursor) {
        bx = cursor.x;
        by = cursor.y;
        if (!hadCursor) {
          prevX = bx;
          prevY = by;
          pendingSeconds = 0;
          hadCursor = true;
        }
        ax = prevX;
        ay = prevY;
        pendingSeconds += dtSeconds;
        const travelPerReferenceFrame =
          pendingSeconds > 0 ? (Math.hypot(bx - ax, by - ay) / pendingSeconds) * REFERENCE_FRAME_SECONDS : 0;
        amp = Math.min(1, travelPerReferenceFrame * SPEED_TO_AMP);
        if (substeps > 0) {
          prevX = bx;
          prevY = by;
          pendingSeconds = 0;
        }
      } else {
        if (hadCursor) {
          exitMs = nowMs;
          exitX = prevX;
          exitY = prevY;
        }
        hadCursor = false;
        pendingSeconds = 0;
        const t = (nowMs - exitMs) / EXIT_RELEASE_MS;
        if (t >= 0 && t < 1) {
          const e = 1 - t;
          amp = EXIT_RELEASE_AMP * e * e;
          ax = bx = exitX;
          ay = by = exitY;
        }
      }

      return { substeps, ax, ay, bx, by, amp };
    },
  };
}
