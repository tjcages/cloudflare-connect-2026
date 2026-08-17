import { animate } from "motion";

export const NUDGE_DURATION = 0.35;

export function nudgeHit(
  el: HTMLElement,
  { axis, amount }: { axis: "x" | "y"; amount: number }
) {
  const keyframes = [0, amount, -amount / 3, 0];

  animate(el, axis === "x" ? { x: keyframes } : { y: keyframes }, {
    duration: NUDGE_DURATION,
    ease: [0.165, 0.84, 0.44, 1],
  });
}
