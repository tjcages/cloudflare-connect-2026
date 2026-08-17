import { chipEl, hopChip } from "@/components/_animations/shared/chips/dom";
import { dispatchIllustrationEvent } from "@/components/_animations/shared/illustration-event";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import type { Visual } from "@/components/_animations/section-visuals";
import { createRunSequencer } from "./sequencer";
import { boxDelay, type RunRowState } from "./sets";

export function createRunVisual({
  makeSnake,
  root,
}: SnakeVisualContext): Visual {
  const setRowState = (row: 1 | 2 | 3, state: RunRowState) => {
    root
      .querySelector<HTMLElement>(`[data-run-row="${row}"]`)
      ?.setAttribute("data-state", state);
    const chip = chipEl(root, `S${row}`);
    if (state === "active") {
      chip?.setAttribute("data-active", "");
      const pill = root.querySelector<HTMLElement>(
        `[data-run-row="${row}"] [data-run-pill]`
      );
      if (chip) hopChip(chip, { amp: -4 });
      if (pill) hopChip(pill, { amp: -4, delay: 0.08 });
    } else {
      chip?.removeAttribute("data-active");
    }
    dispatchIllustrationEvent(root, "run-state", { row, state });
  };

  const applySet = (index: number) => {
    dispatchIllustrationEvent(root, "run-set", { index });
    for (const row of [1, 2, 3] as const) {
      const chip = chipEl(root, `S${row}`);
      const pill = root.querySelector<HTMLElement>(
        `[data-run-row="${row}"] [data-run-pill]`
      );
      if (chip)
        hopChip(chip, {
          amp: -3,
          delay: boxDelay(row, "chip"),
          duration: 0.225,
        });
      if (pill)
        hopChip(pill, {
          amp: -3,
          delay: boxDelay(row, "pill"),
          duration: 0.225,
        });
    }
  };

  const onArrive = (row: 1 | 2 | 3) => {
    const el = chipEl(root, `S${row}`);
    if (!el) return;
    hopChip(el, { amp: 2 });
  };

  const choreo = createRunSequencer(makeSnake, {
    root,
    setRowState,
    applySet,
    onArrive,
  });

  return {
    tick: (elapsed) => choreo.update(elapsed),
    rebuild: () => choreo.rebuild(),
  };
}
