import type { Clock } from "../core/clock";

export type RevealClock = {
  /**
   * Reveal time consumed so far. Advances only while the reveal gate is open,
   * and never runs backwards for a given trigger — a paused reveal resumes
   * where it stopped instead of replaying.
   */
  elapsedMs(): number;
  /** True while a triggered reveal is still progressing, i.e. worth uncapping the frame rate for. */
  animating(durationMs: number): boolean;
  /** Start a reveal. The clock re-anchors on the next `elapsedMs()` read. */
  trigger(): void;
  /** Open or close the reveal gate. Closing banks the progress made so far. */
  setGate(open: boolean): void;
  readonly gateOpen: boolean;
};

/**
 * Owns the reveal timeline, separately from the render loop that draws it.
 *
 * Progress is anchored to the first frame rendered after a trigger, not to the
 * trigger itself: frame-cap gating and first-frame source work can delay that
 * frame, and a clock-based start would skip the reveal's head.
 *
 * Closing the gate banks the elapsed time and freezes it; reopening re-anchors
 * to "now" and keeps counting from the banked total. Only `trigger()` ever
 * resets the banked total, so scrolling a revealed instance away and back can
 * never replay its reveal.
 */
export function createRevealClock(clock: Clock): RevealClock {
  let token = 0;
  let anchoredToken = -1;
  let anchorMs = 0;
  let bankedMs = 0;
  let gateOpen = true;

  function read(): number {
    return gateOpen ? bankedMs + (clock.now() - anchorMs) : bankedMs;
  }

  return {
    elapsedMs() {
      if (anchoredToken !== token) {
        anchoredToken = token;
        anchorMs = clock.now();
        bankedMs = 0;
      }
      return read();
    },
    animating(durationMs) {
      if (!gateOpen) return false;
      if (anchoredToken !== token) return true;
      return read() < durationMs;
    },
    trigger() {
      token++;
    },
    setGate(open) {
      if (open === gateOpen) return;
      if (open) anchorMs = clock.now();
      else if (anchoredToken === token) bankedMs += clock.now() - anchorMs;
      gateOpen = open;
    },
    get gateOpen() {
      return gateOpen;
    },
  };
}
