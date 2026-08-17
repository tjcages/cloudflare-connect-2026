import { cubicBezier } from "motion";
import { clamp } from "@/components/_animations/shared/snake-pulse/math";

const DURATION = 0.6;
const FROM_X = 28;
const TO_X = 124;
const PULSE_EASE = cubicBezier(0.76, 0, 0.24, 1);

export function createViewPulse(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-view-pulse]");

  return {
    tick(t: number, swapAt: number) {
      if (!el) return;
      const p = PULSE_EASE(clamp((t - (swapAt - DURATION)) / DURATION, 0, 1));
      el.style.transform = `translateX(${FROM_X + p * (TO_X - FROM_X)}px)`;
    },
  };
}
