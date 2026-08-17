import { animate } from "motion";
import { hopChip } from "@/components/_animations/shared/chips/dom";

export const REEL_SLIDE_TIME = 0.45;

// The hop distance is relative to the pill it moves, against the 40px pill the
// values were tuned on. The duration is not: shrinking both in proportion holds
// the velocity constant, so a smaller pill covered less ground just as fast and
// still read sharp. Holding the time is what makes the shorter hop softer.
const HOP_REFERENCE_HEIGHT = 40;
const HOP_AMPLITUDE = 2;
const HOP_DURATION = 0.26;

export type PillReel = {
  /** The plate and its content are siblings on the track, so anything that
   *  moves one has to move the other in the same frame. */
  content: HTMLElement;
  centerCell: () => HTMLElement;
  setActive: (on: boolean) => void;
  /** `direction` is a sign, not a distance: the reel scales the hop to the
   *  pill it is moving. */
  hop: (direction: number, axis?: "x" | "y") => void;
  advance: () => void;
  settle: () => void;
  destroy: () => void;
};

export function createPillReel(scope: HTMLElement): PillReel | null {
  const track = scope.querySelector<HTMLElement>("[data-pill-track]");
  const content = scope.querySelector<HTMLElement>("[data-pill-content]");
  if (!track || !content) return null;

  const cells = Array.from(track.querySelectorAll<HTMLElement>("[data-pill]"));
  const count = cells.length;
  if (count < 2) return null;

  // The markup owns the row geometry, so it is read back rather than restated:
  // `top` is the cell's own offset inside the track, which zoom never scales.
  // Deriving the rows from the same query that writes them back also makes
  // document order and row order impossible to diverge.
  const rows = cells.map((cell) => cell.offsetTop);
  const pitch = rows[1] - rows[0];
  const center = rows.indexOf(content.offsetTop);
  if (pitch <= 0 || center < 0) return null;

  let step = 0;
  let slide: ReturnType<typeof animate> | null = null;

  const wrap = (value: number) => ((value % count) + count) % count;
  const centerCell = () => cells[wrap(center + step)];

  const commit = () => {
    slide = null;
    for (let index = 0; index < count; index++) {
      cells[index].style.top = `${rows[wrap(index - step)]}px`;
    }
    track.style.transform = "none";
  };

  const settle = () => {
    if (!slide) return;
    slide.stop();
    commit();
  };

  return {
    content,
    centerCell,
    setActive(on) {
      centerCell().toggleAttribute("data-active", on);
      content.toggleAttribute("data-active", on);
    },
    hop(direction, axis) {
      const ratio = cells[0].offsetHeight / HOP_REFERENCE_HEIGHT;
      for (const el of [centerCell(), content]) {
        hopChip(el, {
          amp: direction * HOP_AMPLITUDE * ratio,
          axis,
          duration: HOP_DURATION,
        });
      }
    },
    advance() {
      settle();
      step += 1;
      // The content is not moved here: it sits on the track, so the track's own
      // translate carries it out with the pill it belongs to, and clearing that
      // translate in `commit` puts it back on the centre row once it has faded.
      slide = animate(0, -pitch, {
        duration: REEL_SLIDE_TIME,
        ease: [0.6, 0.6, 0, 1],
        onUpdate: (value) => {
          track.style.transform = `translateY(${value}px)`;
        },
        onComplete: commit,
      });
    },
    settle,
    destroy() {
      slide?.stop();
      slide = null;
    },
  };
}
