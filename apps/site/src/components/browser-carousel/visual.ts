import { cubicBezier } from "motion";
import { createFloat } from "@/components/_animations/shared/float/create-float";
import { createGlobe } from "@/components/_animations/shared/globe/create-globe";
import type { CanvasVisualContext } from "@/components/_animations/canvas-visuals";
import type { Visual } from "@/components/_animations/section-visuals";

const STEP = 232;
const SLIDE = 0.45;
const DEFAULT_DWELL = 2.75;
// Every dwell after a slide spends its first ~0.95s playing the incoming
// window's reveal (logo transition, 450ms on a 500ms delay), so only the rest
// of it reads as a pause. The first window ships already revealed, so a full
// dwell there would sit still for twice as long as the ones that follow.
const REVEAL = 0.95;
const GLOBE_CENTER_DROP = 336;
const SLIDE_EASE = cubicBezier(0.6, 0.6, 0, 1);

export function createBrowserCarouselVisual({
  layer,
  root,
  cleanup,
}: CanvasVisualContext): Visual {
  const globe = createGlobe(root.clientWidth, root.clientHeight, {
    traffic: "ambient",
    centerDrop: GLOBE_CENTER_DROP,
    stroke: "var(--color-border-default)",
  });
  layer.addChild(globe.container);
  cleanup(globe.destroy);

  const row = root.querySelector<HTMLElement>("[data-browser-carousel-row]");
  const float = createFloat(root);
  const dwell = Number(root.dataset.browserCarouselDwell) || DEFAULT_DWELL;

  const windowAt = (slot: number) =>
    row?.children[slot]?.firstElementChild ?? null;

  let slideAt = Math.max(dwell - REVEAL, 0);
  let sliding = false;

  return {
    tick: (elapsed, dt) => {
      globe.tick(elapsed, dt);
      float.tick(elapsed);

      if (!row) return;

      if (!sliding) {
        if (elapsed < slideAt) return;
        sliding = true;
        windowAt(2)?.removeAttribute("data-active");
      }

      const progress = Math.min((elapsed - slideAt) / SLIDE, 1);

      if (progress < 1) {
        const eased = SLIDE_EASE(progress);
        row.style.transform = `translateX(${-STEP * eased}px)`;
        return;
      }

      const first = row.firstElementChild as HTMLElement | null;
      if (first) row.appendChild(first);
      row.style.transform = "";
      windowAt(2)?.setAttribute("data-active", "true");
      sliding = false;
      slideAt = elapsed + dwell;
    },
    rebuild: () => {
      globe.resize(root.clientWidth, root.clientHeight);
    },
  };
}
