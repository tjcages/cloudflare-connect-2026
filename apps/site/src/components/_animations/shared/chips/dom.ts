import { animate } from "motion";

export function chipEl(root: HTMLElement, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-chip-id="${id}"]`);
}

export function hitChip(el: HTMLElement) {
  animate(
    el,
    { scale: [1, 0.976, 1.014, 0.995, 1] },
    { duration: 0.45, ease: [0.6, 0.6, 0, 1] }
  );
}

export function hopChip(
  el: HTMLElement,
  {
    amp,
    axis = "y",
    delay = 0,
    duration = 0.45,
  }: { amp: number; axis?: "x" | "y"; delay?: number; duration?: number }
) {
  // The counter-bounce is a quarter of the hop, so halving `amp` halves the
  // whole shape instead of leaving an oversized settle behind. At the -4 the
  // workers rows activate on, this is the literal 1 it replaced.
  const keyframes = [0, amp, -amp / 4, 0];

  animate(el, axis === "x" ? { x: keyframes } : { y: keyframes }, {
    duration,
    ease: [0.6, 0.6, 0, 1],
    delay,
  });
}
