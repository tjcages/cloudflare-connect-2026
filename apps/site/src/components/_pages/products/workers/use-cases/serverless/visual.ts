import { chipEl, hopChip } from "@/components/_animations/shared/chips/dom";
import { createSpinnerBridge } from "@/components/_animations/shared/choreography/spinner-bridge";
import { dispatchIllustrationEvent } from "@/components/_animations/shared/illustration-event";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import type { Visual } from "@/components/_animations/section-visuals";
import { CATEGORIES } from "./categories";
import { createChoreography } from "./choreography";

const CATEGORY_SWAP_AT = 200;

export function createServerlessVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const spinner = createSpinnerBridge(root, {
    ring: root.querySelector<HTMLElement>("[data-orbit-ring]"),
    centerId: "C",
  });

  let categoryIndex = 0;
  let categoryTimeout: ReturnType<typeof setTimeout> | null = null;

  const onCycleEnd = () => {
    categoryIndex = (categoryIndex + 1) % CATEGORIES.length;

    if (categoryTimeout) clearTimeout(categoryTimeout);
    categoryTimeout = setTimeout(() => {
      const chip = chipEl(root, "R");
      if (chip) hopChip(chip, { amp: -3 });
      dispatchIllustrationEvent(root, "serverless-category", {
        index: categoryIndex,
      });
    }, CATEGORY_SWAP_AT);
  };

  const choreo = createChoreography(makeSnake, {
    root,
    onHit: spinner.onHit,
    onApproachCenter: spinner.onApproachCenter,
    onCycleEnd,
  });

  cleanup(() => {
    if (categoryTimeout) clearTimeout(categoryTimeout);
    choreo.destroy();
  });

  return {
    tick: (elapsed, dt) => {
      choreo.update(elapsed);
      spinner.tick(dt);
    },
    rebuild: () => choreo.rebuild(),
  };
}
