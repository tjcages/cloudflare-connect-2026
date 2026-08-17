import { createSpinnerBridge } from "@/components/_animations/shared/choreography/spinner-bridge";
import { dispatchIllustrationEvent } from "@/components/_animations/shared/illustration-event";
import type { Role } from "@/components/_animations/shared/choreography/choreography-engine";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import type { Visual } from "@/components/_animations/section-visuals";
import { type ChipId, createSideHubSideChoreography } from "./choreography";
import { createReel } from "./reel";

const SWAP_AT = 120;
// A single-visit card has no shuttle rhythm, so the hub beat is explicit.
const CENTER_HOLD = 0.5;
const SIDES = ["L", "R"] as const;

export function createSideHubSideVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const host = root.querySelector<HTMLElement>("[data-illustration-root]");
  if (!host) {
    throw new Error(
      "createSideHubSideVisual: missing [data-illustration-root]"
    );
  }

  const colors: Record<ChipId, string> = {
    L: host.dataset.leftColor ?? "orange",
    C: host.dataset.hubColor ?? "orange",
    R: host.dataset.rightColor ?? "orange",
  };

  const counts = {
    L: Number(host.dataset.leftCount ?? 1),
    R: Number(host.dataset.rightCount ?? 1),
  };
  const badge = Number(host.dataset.rightBadge ?? 0);
  let pending = badge;
  const indices = { L: 0, R: 0 };
  const reels = { L: createReel(root, "L"), R: createReel(root, "R") };
  let swapTimeout: ReturnType<typeof setTimeout> | null = null;

  const spinner = createSpinnerBridge(root, {
    ring: root.querySelector<HTMLElement>("[data-orbit-ring]"),
    centerId: "C",
  });

  const setPending = (count: number) => {
    pending = count;
    dispatchIllustrationEvent(host, "side-badge:R", { count });
  };

  const onHit = (id: string, role: Role) => {
    spinner.onHit(id, role);
    if (id !== "R" || pending === 0) return;
    setPending(pending - 1);
  };

  const onCycleEnd = () => {
    const advancing = SIDES.filter((side) => side !== "R" || pending === 0);

    for (const side of advancing) {
      if (counts[side] > 1) indices[side] = (indices[side] + 1) % counts[side];
    }

    if (swapTimeout) clearTimeout(swapTimeout);
    swapTimeout = setTimeout(() => {
      for (const side of advancing) {
        if (side === "R" && badge > 0) setPending(badge);
        if (counts[side] <= 1) continue;
        reels[side]?.advance();
        dispatchIllustrationEvent(host, `side-item:${side}`, {
          index: indices[side],
        });
      }
    }, SWAP_AT);
  };

  const choreo = createSideHubSideChoreography(makeSnake, {
    root,
    colors,
    rightVisits: Math.max(badge, 1),
    shuttleAll: badge > 1,
    centerHold: badge > 1 ? 0 : CENTER_HOLD,
    onHit,
    onApproachCenter: spinner.onApproachCenter,
    onCycleEnd,
  });

  cleanup(() => {
    if (swapTimeout) clearTimeout(swapTimeout);
    for (const side of SIDES) reels[side]?.destroy();
    choreo.destroy();
  });

  return {
    tick: (elapsed, dt) => {
      choreo.update(elapsed);
      spinner.tick(dt);
    },
    rebuild: () => {
      if (swapTimeout) clearTimeout(swapTimeout);
      for (const side of SIDES) reels[side]?.settle();
      if (badge > 0) setPending(badge);
      choreo.rebuild();
    },
  };
}
