import {
  measureChips,
  sideAnchors,
} from "@/components/_animations/shared/chips/measure-chips";
import { buildConnector } from "@/components/_animations/shared/snake-pulse/build-connector";
import { createBullet } from "@/components/_animations/shared/snake-pulse/bullet";
import type { PulseThrow } from "@/components/_animations/shared/snake-pulse/pulse-throw";
import type {
  SnakeFactory,
  ThrowableSnake,
} from "@/components/_animations/shared/snake-pulse/snake";

const DEEP = 14;
// The path starts this far INSIDE the source, so the snake is born under the
// pill or the hub and slides out from beneath it. Without it the head appears
// in open space at the source edge, already a segment long. The run stage gets
// this for free by anchoring chip centre to chip centre.
const BURY = 24;

const IDS = ["L", "C", "R"] as const;
type LegId = (typeof IDS)[number];

export type Leg = {
  snake: ThrowableSnake;
  throw: PulseThrow;
  dwell: number;
  startT: number;
};
export type Legs = { intake: Leg; delivery: Leg };

export function buildLegs(
  root: HTMLElement,
  makeSnake: SnakeFactory,
  colors: { mail: string; hub: string }
): Legs | null {
  const centers = measureChips(root, IDS);
  if (!centers) return null;

  const leg = (
    from: LegId,
    to: LegId,
    [source, target]: [string, string]
  ): Leg => {
    const anchors = sideAnchors(centers[from], centers[to]);
    const start = {
      ...anchors.from,
      x: anchors.from.x + (anchors.to.x >= anchors.from.x ? -BURY : BURY),
    };
    const bullet = createBullet(
      makeSnake,
      buildConnector(start, anchors.to, { deep: DEEP, root }),
      source,
      target
    );
    return { ...bullet, startT: 0 };
  };

  return {
    intake: leg("L", "C", [colors.mail, colors.hub]),
    // The delivery leg keeps the hub's colour at both ends. The mock draws that
    // stripe purple the whole way, and green belongs to the checkmark.
    delivery: leg("C", "R", [colors.hub, colors.hub]),
  };
}
