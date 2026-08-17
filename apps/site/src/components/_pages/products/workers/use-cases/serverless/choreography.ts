import type { SnakeFactory } from "@/components/_animations/shared/snake-pulse/snake";
import {
  createChoreographyEngine,
  type Role,
} from "@/components/_animations/shared/choreography/choreography-engine";
import { RING_DECEL_TIME } from "@/components/_animations/shared/choreography/ring";

const COLOR = "purple";
const SLOTS = 1;
const SPIN_LEAD = RING_DECEL_TIME;

export type ChipId = "L" | "C" | "R";

export function createChoreography(
  makeSnake: SnakeFactory,
  opts: {
    root: HTMLElement;
    onHit: (id: ChipId, role: Role) => void;
    onApproachCenter: (role: Role) => void;
    onCycleEnd?: () => void;
  }
) {
  const directed: Array<[ChipId, ChipId]> = [
    ["L", "C"],
    ["C", "R"],
    ["R", "C"],
    ["C", "L"],
  ];

  return createChoreographyEngine(makeSnake, {
    root: opts.root,
    directed,
    slots: SLOTS,
    color: COLOR,
    snakeColors: (from, to) => {
      if (from === "L") return ["orange", "purple"];
      if (to === "L") return ["purple", "orange"];
      return [COLOR, COLOR];
    },
    centerId: "C",
    allChipIds: ["L", "C", "R"],
    activatableIds: [],
    spinLead: SPIN_LEAD,
    centerHold: 0.5,
    onHit: (id, role) => opts.onHit(id as ChipId, role),
    onApproachCenter: opts.onApproachCenter,
    onCycleEnd: opts.onCycleEnd,
    buildCycle: ({ makeChain }) => [makeChain(0, "L", "R", 0)],
  });
}
