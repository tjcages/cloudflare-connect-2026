import { pick } from "@/utils/random";
import type { SnakeFactory } from "@/components/_animations/shared/snake-pulse/snake";
import {
  type Chain,
  createChoreographyEngine,
  type Role,
} from "@/components/_animations/shared/choreography/choreography-engine";
import { RING_DECEL_TIME } from "@/components/_animations/shared/choreography/ring";

export type ChipId = "L1" | "L3" | "C" | "R1" | "R3";

export const LEFT_CHIPS: ChipId[] = ["L1", "L3"];
export const RIGHT_CHIPS: ChipId[] = ["R1", "R3"];
export const ALL_CHIPS: ChipId[] = ["L1", "L3", "C", "R1", "R3"];

const COLOR = "orange";
const STAGGER = 0.09;
const SLOTS = 2;
const RIGHT_LEAD = 0.6;
const SPIN_LEAD = RING_DECEL_TIME;

export function createChoreography(
  makeSnake: SnakeFactory,
  opts: {
    root: HTMLElement;
    onActivate: (id: ChipId, on: boolean) => void;
    onHit: (id: ChipId, role: Role) => void;
    onApproachCenter: (role: Role) => void;
  }
) {
  const directed: Array<[ChipId, ChipId]> = [
    ["L1", "C"],
    ["C", "L1"],
    ["L3", "C"],
    ["C", "L3"],
    ["C", "R1"],
    ["R1", "C"],
    ["C", "R3"],
    ["R3", "C"],
  ];

  return createChoreographyEngine(makeSnake, {
    root: opts.root,
    directed,
    slots: SLOTS,
    color: COLOR,
    centerId: "C",
    allChipIds: ALL_CHIPS,
    activatableIds: [...LEFT_CHIPS, ...RIGHT_CHIPS],
    rightLead: RIGHT_LEAD,
    spinLead: SPIN_LEAD,
    onActivate: opts.onActivate as (id: string, on: boolean) => void,
    onHit: (id, role) => opts.onHit(id as ChipId, role),
    onApproachCenter: opts.onApproachCenter,
    buildCycle: ({ makeChain }) => {
      const chains: Chain[] = [];
      const nLeft = Math.random() < 0.5 ? 1 : 2;
      if (nLeft === 1) {
        chains.push(makeChain(0, pick(LEFT_CHIPS), pick(RIGHT_CHIPS), 0));
      } else {
        const ls = Math.random() < 0.5 ? LEFT_CHIPS : [...LEFT_CHIPS].reverse();
        if (Math.random() < 0.5) {
          const r = pick(RIGHT_CHIPS);
          chains.push(makeChain(0, ls[0], r, 0));
          chains.push(makeChain(1, ls[1], r, STAGGER));
        } else {
          chains.push(makeChain(0, ls[0], "R1", 0));
          chains.push(makeChain(1, ls[1], "R3", STAGGER));
        }
      }
      return chains;
    },
  });
}
