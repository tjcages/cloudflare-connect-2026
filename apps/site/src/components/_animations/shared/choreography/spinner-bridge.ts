import type { Role } from "./choreography-engine";
import { chipEl, hitChip } from "@/components/_animations/shared/chips/dom";
import { createRingSpinner } from "./ring";

export function createSpinnerBridge(
  root: HTMLElement,
  opts: { ring: HTMLElement | null; centerId: string }
) {
  const spinner = createRingSpinner(opts.ring);

  const onHit = (id: string, role: Role) => {
    const el = chipEl(root, id);
    if (el) hitChip(el);
    if (id === opts.centerId) spinner.boost(role === "outC" ? 1 : -1);
  };

  const onApproachCenter = (role: Role) => {
    if (role === "outC" || role === "retC") spinner.decelToStop();
  };

  return {
    onHit,
    onApproachCenter,
    tick: (dt: number) => spinner.tick(dt),
  };
}
