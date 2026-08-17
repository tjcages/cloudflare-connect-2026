import { chipEl, hitChip } from "@/components/_animations/shared/chips/dom";
import { createSpinnerBridge } from "@/components/_animations/shared/choreography/spinner-bridge";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import type { Visual } from "@/components/_animations/section-visuals";
import { type ChipId, createChoreography } from "./choreography";

export function createApiVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const onActivate = (id: ChipId, on: boolean) => {
    const el = chipEl(root, id);
    if (!el) return;
    if (!on) {
      el.removeAttribute("data-active");
      return;
    }
    if (el.hasAttribute("data-active")) return;
    el.setAttribute("data-active", "");
    hitChip(el);
  };

  const spinner = createSpinnerBridge(root, {
    ring: root.querySelector<HTMLElement>("[data-orbit-ring]"),
    centerId: "C",
  });

  const choreo = createChoreography(makeSnake, {
    root,
    onActivate,
    onHit: spinner.onHit,
    onApproachCenter: spinner.onApproachCenter,
  });

  cleanup(choreo.destroy);

  return {
    tick: (elapsed, dt) => {
      choreo.update(elapsed);
      spinner.tick(dt);
    },
    rebuild: () => choreo.rebuild(),
  };
}
