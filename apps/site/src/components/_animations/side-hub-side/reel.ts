import { animate } from "motion";
import {
  CENTER_ROW,
  type ReelDir,
  reelCenterIndex,
  reelRow,
} from "./reel-rows";

const ROW_PERCENT = 50;

export function createReel(root: HTMLElement, id: string) {
  const track = root.querySelector<HTMLElement>(`[data-reel="${id}"]`);
  if (!track) return null;

  const badge = track.querySelector<HTMLElement>("[data-reel-badge]");
  const cells = Array.from(
    track.querySelectorAll<HTMLElement>("[data-reel-cell]")
  );
  const chips = cells.map((cell) =>
    cell.querySelector<HTMLElement>("[data-chip]")
  );
  const count = cells.length;
  const dir: ReelDir = track.dataset.reelDir === "down" ? "down" : "up";
  const travel = dir === "up" ? -ROW_PERCENT : ROW_PERCENT;

  let step = 0;
  let slide: ReturnType<typeof animate> | null = null;

  const commit = () => {
    slide = null;
    for (let index = 0; index < count; index++) {
      const row = reelRow(index, step, count, dir);
      cells[index].style.top = `${row * ROW_PERCENT}%`;
    }
    track.style.transform = "none";
    if (badge) badge.style.top = `${CENTER_ROW * ROW_PERCENT}%`;

    const center = reelCenterIndex(step, count, dir);
    for (const chip of chips) chip?.removeAttribute("data-chip-id");
    chips[center]?.setAttribute("data-chip-id", id);
  };

  const settle = () => {
    if (!slide) return;
    slide.stop();
    commit();
  };

  return {
    advance() {
      settle();
      step += 1;
      if (badge) badge.style.top = `${CENTER_ROW * ROW_PERCENT - travel}%`;

      const center = reelCenterIndex(step, count, dir);
      chips.forEach((chip, index) =>
        chip?.toggleAttribute("data-active", index === center)
      );

      slide = animate(0, travel, {
        duration: 0.45,
        ease: [0.6, 0.6, 0, 1],
        onUpdate: (value) => {
          track.style.transform = `translateY(${value}%)`;
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
