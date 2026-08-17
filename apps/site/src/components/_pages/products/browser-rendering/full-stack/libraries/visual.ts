import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import type { Visual } from "@/components/_animations/section-visuals";
import { createLibrariesCycle } from "./create-cycle";

export function createLibrariesVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const cycle = createLibrariesCycle(root, makeSnake);

  cleanup(cycle.destroy);

  return { tick: cycle.tick, rebuild: cycle.rebuild };
}
