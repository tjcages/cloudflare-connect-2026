import { chipEl, hitChip } from "@/components/_animations/shared/chips/dom";
import {
  type ChipCenter,
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
import { rnd } from "@/utils/random";

const CENTER_ID = "C";
const SIDE_IDS = ["L", "R"] as const;
// Held on the side chip on top of the throw's own dwell, so the arrival reads
// as a stop before the snake turns around.
const SIDE_HOLD = [0.3, 0.45] as const;
// Beat between one side finishing and the next side being drawn.
const REST = [0.9, 1.6] as const;
const START = [0.2, 0.6] as const;

type SideId = (typeof SIDE_IDS)[number];
type Connection = { snake: ThrowableSnake; pulse: PulseThrow; dwell: number };
type Shot = { connection: Connection; startedAt: number };
type Phase = "rest" | "out" | "hold" | "back";

export function createLibrariesCycle(
  root: HTMLElement,
  makeSnake: SnakeFactory
) {
  let connections: Record<
    SideId,
    { outbound: Connection; inbound: Connection }
  > | null = null;
  let shots: Shot[] = [];
  let phase: Phase = "rest";
  let side: SideId = "L";
  let nextAt = 0;
  let clock = 0;

  const connect = (fromChip: ChipCenter, toChip: ChipCenter): Connection => {
    const { from, to } = sideAnchors(fromChip, toChip);
    const bullet = createBullet(
      makeSnake,
      buildConnector(from, to, { deep: 14, root }),
      "orange"
    );
    return { snake: bullet.snake, pulse: bullet.throw, dwell: bullet.dwell };
  };

  const clearSides = () => {
    for (const id of SIDE_IDS) {
      chipEl(root, id)?.removeAttribute("data-active");
    }
  };

  const destroyConnections = () => {
    if (connections) {
      for (const id of SIDE_IDS) {
        connections[id].outbound.snake.destroy();
        connections[id].inbound.snake.destroy();
      }
    }
    connections = null;
    shots = [];
  };

  const build = () => {
    const chips = measureChips(root, [CENTER_ID, ...SIDE_IDS]);
    if (!chips) return null;

    connections = {
      L: {
        outbound: connect(chips[CENTER_ID], chips.L),
        inbound: connect(chips.L, chips[CENTER_ID]),
      },
      R: {
        outbound: connect(chips[CENTER_ID], chips.R),
        inbound: connect(chips.R, chips[CENTER_ID]),
      },
    };
    return connections;
  };

  const launch = (connection: Connection, onArrive: () => void) => {
    shots.push({ connection, startedAt: clock });
    connection.pulse.play({ onArrive });
  };

  const arriveAtSide = (dwell: number) => {
    const el = chipEl(root, side);
    if (el) {
      el.setAttribute("data-active", "true");
      hitChip(el);
    }
    phase = "hold";
    nextAt = clock + dwell + rnd(SIDE_HOLD[0], SIDE_HOLD[1]);
  };

  const arriveAtCenter = (dwell: number) => {
    const center = chipEl(root, CENTER_ID);
    if (center) hitChip(center);
    chipEl(root, side)?.removeAttribute("data-active");
    phase = "rest";
    nextAt = clock + dwell + rnd(REST[0], REST[1]);
  };

  const startCycle = (
    built: Record<SideId, { outbound: Connection; inbound: Connection }>
  ) => {
    // The side is drawn fresh each cycle, so the card never settles into an
    // alternating pattern.
    side = SIDE_IDS[Math.floor(Math.random() * SIDE_IDS.length)];
    phase = "out";
    const { outbound } = built[side];
    launch(outbound, () => arriveAtSide(outbound.dwell));
  };

  return {
    rebuild() {
      destroyConnections();
      clearSides();
      phase = "rest";
      nextAt = clock + rnd(START[0], START[1]);
    },
    destroy() {
      destroyConnections();
      clearSides();
    },
    tick(elapsed: number) {
      clock = elapsed;
      const built = connections ?? build();
      if (!built) return;

      for (const shot of shots) {
        shot.connection.pulse.update(clock - shot.startedAt);
      }
      shots = shots.filter((shot) => !shot.connection.pulse.done);

      if (clock < nextAt) return;

      if (phase === "rest") {
        startCycle(built);
        return;
      }

      if (phase === "hold") {
        phase = "back";
        const { inbound } = built[side];
        launch(inbound, () => arriveAtCenter(inbound.dwell));
      }
    },
  };
}
