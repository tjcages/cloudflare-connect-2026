import { cubicBezier } from "motion";
import { createFloat } from "@/components/_animations/shared/float/create-float";
import { createWireGlobe } from "@/components/_animations/shared/globe/create-wire-globe";
import { nudgeHit } from "@/components/_animations/shared/nudge/nudge-hit";
import type { CanvasVisualContext } from "@/components/_animations/canvas-visuals";
import type { Visual } from "@/components/_animations/section-visuals";
import { createBrowserContent } from "@/components/browser/archetypes";
import { createUserTraffic } from "./user-traffic";

// The Figma globe is a 600x600 vector at y=96, so its centre lands at y=396 on
// a 240-tall stage and its radius is createWireGlobe's own RADIUS.
const GLOBE_CENTER_DROP = 276;
// The user batch is locked to this, so a longer dwell is also a longer batch —
// which is what gives each chip room to throw several stripes instead of one.
const DWELL = 9;
const NUDGE = -2;
const SWAP = 0.35;
const BLUR = 2;
// Hoisted unlike component style code: this runs inside the rAF loop, where
// cubicBezier() would build a fresh solver every frame.
const SWAP_EASE = cubicBezier(0.165, 0.84, 0.44, 1);

export function createLatencyVisual({
  layer,
  root,
  cleanup,
}: CanvasVisualContext): Visual {
  const globe = createWireGlobe(root.clientWidth, root.clientHeight, {
    centerDrop: GLOBE_CENTER_DROP,
    stroke: "var(--color-border-default)",
  });
  layer.addChild(globe.container);
  cleanup(globe.destroy);

  const traffic = createUserTraffic(globe, root, root.clientWidth);
  layer.addChild(traffic.container);
  cleanup(traffic.destroy);

  const float = createFloat(root);
  const browser = root.querySelector<HTMLElement>("[data-latency-browser]");
  const nudge = root.querySelector<HTMLElement>("[data-latency-nudge]");
  const content = browser ? createBrowserContent(browser) : null;

  let swapAt = DWELL;
  let fading: HTMLElement | null = null;
  let fadeStart = 0;
  // Mirrors elapsed so rebuild, which takes no arguments, can reschedule the
  // next swap relative to now instead of firing one on the very next frame.
  let clock = 0;

  return {
    tick: (elapsed, dt) => {
      clock = elapsed;
      globe.advance(dt);
      traffic.tick(elapsed);
      float.tick(elapsed);

      if (fading) {
        const progress = Math.min((elapsed - fadeStart) / SWAP, 1);
        const eased = SWAP_EASE(progress);
        fading.style.opacity = eased.toFixed(3);
        fading.style.filter = `blur(${(BLUR * (1 - eased)).toFixed(2)}px)`;
        if (progress >= 1) {
          content?.settle();
          fading = null;
          swapAt = elapsed + DWELL;
        }
        return;
      }

      if (elapsed < swapAt) return;

      // The outgoing panel stays fully painted underneath until settle(), so
      // the incoming one fades in over it rather than over a bare frame.
      const next = content?.begin() ?? null;
      if (!next) {
        swapAt = elapsed + DWELL;
        return;
      }
      next.style.opacity = "0";
      next.style.filter = `blur(${BLUR}px)`;
      fading = next;
      fadeStart = elapsed;
      if (nudge) nudgeHit(nudge, { axis: "y", amount: NUDGE });
      traffic.cycle(elapsed);
    },
    rebuild: () => {
      globe.resize(root.clientWidth, root.clientHeight);
      traffic.resize(root.clientWidth);
      content?.settle();
      fading = null;
      swapAt = clock + DWELL;
    },
  };
}
