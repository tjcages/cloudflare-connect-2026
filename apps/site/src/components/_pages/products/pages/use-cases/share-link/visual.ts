import { animate } from "motion";
import { createFloat } from "@/components/_animations/shared/float/create-float";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import type { Visual } from "@/components/_animations/section-visuals";
import { SWAP_EVENT } from "./link";
import { exitDistance, POOLS, SLOT_SETS, slotOffset, type Slot } from "./slots";

const DWELL = 1.65;
const PRESS = 0.03;
const DEPART = 0.08;
const SETTLE = 0.95;

const DEPART_DURATION = 0.62;
const DEPART_STAGGER = 0.05;
const EMERGE_DURATION = 0.55;
const EMERGE_STAGGER = 0.07;

type Phase = "dwell" | "press" | "depart" | "settle";

export function createShareVisual({ root }: SnakeVisualContext): Visual {
  const pill = root.querySelector<HTMLElement>("[data-share-pill]");
  const flash = root.querySelector<HTMLElement>("[data-share-flash]");
  const float = createFloat(root);

  const pools = POOLS.map((pool) =>
    Array.from(
      root.querySelectorAll<HTMLElement>(
        `[data-share-chip][data-share-pool="${pool}"]`
      )
    )
  );

  let live = 0;
  let setIndex = 0;
  let phase: Phase = "dwell";
  let phaseUntil = DWELL;
  let clock = 0;

  const enter = (next: Phase, hold: number) => {
    phase = next;
    phaseUntil = clock + hold;
  };

  const hide = (el: HTMLElement) => {
    el.style.opacity = "0";
  };

  // Nearest chips leave first, so the field empties outward from the pill.
  const byDistance = (slots: readonly Slot[]) =>
    slots
      .map((slot, index) => ({ slot, index }))
      .sort((a, b) => {
        const oa = slotOffset(a.slot);
        const ob = slotOffset(b.slot);
        return Math.hypot(oa.x, oa.y) - Math.hypot(ob.x, ob.y);
      });

  const depart = (chips: HTMLElement[], slots: readonly Slot[]) => {
    byDistance(slots).forEach(({ slot, index }, order) => {
      const el = chips[index];
      if (!el) return;
      const { x, y } = slotOffset(slot);
      const length = Math.hypot(x, y) || 1;
      const travel = exitDistance(x, y);
      animate(
        el,
        {
          x: [x, x + (x / length) * travel],
          y: [y, y + (y / length) * travel],
          scale: [1, 0.72],
        },
        {
          duration: DEPART_DURATION,
          delay: order * DEPART_STAGGER,
          ease: [0.6, 0.6, 0, 1],
        }
      );
    });
  };

  const emerge = (chips: HTMLElement[], slots: readonly Slot[]) => {
    chips.forEach((el, index) => {
      const slot = slots[index];
      if (!slot) {
        hide(el);
        return;
      }
      const { x, y } = slotOffset(slot);
      animate(
        el,
        { x: [0, x], y: [0, y], scale: [0.5, 1], opacity: [0, 1] },
        {
          duration: EMERGE_DURATION,
          delay: index * EMERGE_STAGGER,
          ease: [0.6, 0.6, 0, 1],
        }
      );
    });
  };

  const rebuild = () => {
    live = 0;
    setIndex = 0;
    pools.forEach((chips, poolIndex) => {
      chips.forEach((el, index) => {
        const slot = poolIndex === 0 ? SLOT_SETS[0][index] : undefined;
        if (!slot) {
          hide(el);
          return;
        }
        const { x, y } = slotOffset(slot);
        el.style.opacity = "1";
        el.style.transform = `translate(${x}px, ${y}px) scale(1)`;
      });
    });
    phase = "dwell";
    phaseUntil = clock + DWELL;
  };

  return {
    rebuild,
    tick: (elapsed) => {
      clock = elapsed;
      float.tick(elapsed);

      if (clock < phaseUntil) return;

      switch (phase) {
        case "dwell":
          if (pill) {
            animate(
              pill,
              { scale: [1, 0.993, 1.002, 1] },
              { duration: 0.38, ease: [0.165, 0.84, 0.44, 1] }
            );
          }
          if (flash) {
            animate(
              flash,
              { opacity: [0, 1, 0] },
              {
                duration: 0.9,
                times: [0, 0.16, 1],
                ease: [0.6, 0.6, 0, 1],
              }
            );
          }
          enter("press", PRESS);
          return;
        case "press":
          depart(pools[live], SLOT_SETS[setIndex]);
          // The island mints the new name and animates it; the ticker only says
          // when. Firing as the old users leave puts the letters mid-swap by
          // the time the new ones arrive, instead of trailing behind them.
          window.dispatchEvent(new Event(SWAP_EVENT));
          if (pill) {
            // A small lift across the letter swap, so the pill reacts to the
            // link it just minted rather than sitting still through it.
            animate(
              pill,
              { y: [0, -1.5, 0.5, 0] },
              { duration: 0.4, ease: [0.165, 0.84, 0.44, 1] }
            );
          }
          enter("depart", DEPART);
          return;
        case "depart":
          emerge(pools[1 - live], SLOT_SETS[(setIndex + 1) % SLOT_SETS.length]);
          enter("settle", SETTLE);
          return;
        case "settle":
          live = 1 - live;
          setIndex = (setIndex + 1) % SLOT_SETS.length;
          enter("dwell", DWELL);
          return;
        default:
          return;
      }
    },
  };
}
