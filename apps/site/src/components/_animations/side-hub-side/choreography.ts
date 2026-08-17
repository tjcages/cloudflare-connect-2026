import { cubicBezier } from "motion";
import {
  createChoreographyEngine,
  type Role,
} from "@/components/_animations/shared/choreography/choreography-engine";
import { RING_DECEL_TIME } from "@/components/_animations/shared/choreography/ring";
import type { SnakeFactory } from "@/components/_animations/shared/snake-pulse/snake";

export type ChipId = "L" | "C" | "R";

export function createSideHubSideChoreography(
  makeSnake: SnakeFactory,
  opts: {
    root: HTMLElement;
    colors: Record<ChipId, string>;
    rightVisits: number;
    centerHold: number;
    shuttleAll: boolean;
    onHit: (id: string, role: Role) => void;
    onApproachCenter: (role: Role) => void;
    onCycleEnd: () => void;
  }
) {
  const { colors } = opts;

  return createChoreographyEngine(makeSnake, {
    root: opts.root,
    directed: [
      ["L", "C"],
      ["C", "R"],
      ["R", "C"],
      ["C", "L"],
    ],
    slots: 1,
    color: colors.C,
    snakeColors: (from, to) => [colors[from as ChipId], colors[to as ChipId]],
    centerId: "C",
    allChipIds: ["L", "C", "R"],
    activatableIds: [],
    spinLead: RING_DECEL_TIME,
    centerHold: opts.centerHold,
    shuttleAll: opts.shuttleAll,
    restTime: 0.9,
    shuttle: {
      duration: 0.3,
      ease: cubicBezier(0.5, 0.4, 0.75, 1),
      exitDuration: 0.3,
      entryWait: 0.3,
      firstWait: 0.05,
      wait: 0.1,
    },
    onHit: opts.onHit,
    onApproachCenter: opts.onApproachCenter,
    onCycleEnd: opts.onCycleEnd,
    buildCycle: ({ makeChain }) => [
      makeChain(0, "L", "R", 0, opts.rightVisits),
    ],
  });
}
