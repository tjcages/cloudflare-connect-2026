import { createBullet } from "@/components/_animations/shared/snake-pulse/bullet";
import type { PulseThrow } from "@/components/_animations/shared/snake-pulse/pulse-throw";
import {
  lerpPoint,
  SAMPLES,
} from "@/components/_animations/shared/snake-pulse/sample-path";
import type {
  SnakeFactory,
  SnakeLayout,
  ThrowableSnake,
} from "@/components/_animations/shared/snake-pulse/snake";
import { rnd } from "@/utils/random";
import {
  type ChipCenter,
  measureChips,
} from "@/components/_animations/shared/chips/measure-chips";
import { createTimerQueue } from "@/components/_animations/shared/choreography/timer-queue";
import { RUN_SETS, type RunRowState } from "./sets";

const COLOR = "purple";
const CHIP_IDS = ["S1", "S2", "S3"] as const;
const RUN_MIN = 1.2;
const RUN_MAX = 1.8;
const COMPLETE_HOLD = 0.8;
const END_HOLD = 0.9;
const REST = 0.9;
const START_DELAY = 1.5;

type Row = 1 | 2 | 3;
type Conn = {
  snake: ThrowableSnake;
  throw: PulseThrow;
  dwell: number;
  startT: number;
  live: boolean;
};

type RunSequencer = {
  update: (t: number) => void;
  rebuild: () => void;
};

function buildVerticalLayout(a: ChipCenter, b: ChipCenter): SnakeLayout {
  const from = { x: a.cx, y: a.cy, side: "left" as const };
  const to = { x: b.cx, y: b.cy, side: "left" as const };
  const points = Array.from({ length: SAMPLES + 1 }, (_, i) =>
    lerpPoint(from, to, i / SAMPLES)
  );
  const len = Math.hypot(b.cx - a.cx, b.cy - a.cy);
  return { points, from, to, endFraction: (len - b.r) / len };
}

export function createRunSequencer(
  makeSnake: SnakeFactory,
  opts: {
    root: HTMLElement;
    setRowState: (row: Row, state: RunRowState) => void;
    applySet: (index: number) => void;
    onArrive: (row: Row) => void;
  }
): RunSequencer {
  let conns: Conn[] = [];
  let clock = 0;
  let setIndex = 0;
  const timerQueue = createTimerQueue();

  const at = (delay: number, fn: () => void) => {
    timerQueue.push({ at: clock + delay, fn });
  };

  function startRow(row: Row) {
    opts.setRowState(row, "running");
    at(rnd(RUN_MIN, RUN_MAX), () => completeRow(row));
  }

  function completeRow(row: Row) {
    opts.setRowState(row, "active");

    if (row === 3) {
      at(END_HOLD, () => {
        opts.setRowState(3, "done");
        at(REST, resetCycle);
      });
      return;
    }

    at(COMPLETE_HOLD, () => {
      at(0.4, () => opts.setRowState(row, "done"));
      const conn = conns[row - 1];
      const next = (row + 1) as Row;
      conn.live = true;
      conn.startT = clock;
      conn.throw.play({
        onArrive: () => {
          opts.onArrive(next);
          at(conn.dwell, () => startRow(next));
        },
      });
    });
  }

  function resetCycle() {
    let next = Math.floor(Math.random() * RUN_SETS.length);
    if (next === setIndex) next = (next + 1) % RUN_SETS.length;
    setIndex = next;
    for (const row of [1, 2, 3] as const) opts.setRowState(row, "pending");
    opts.applySet(setIndex);
    at(START_DELAY, () => startRow(1));
  }

  function rebuild() {
    for (const conn of conns) {
      conn.snake.destroy();
    }
    conns = [];
    timerQueue.reset();

    const centers = measureChips(opts.root, CHIP_IDS);
    if (!centers) return;

    for (const [a, b] of [
      [centers.S1, centers.S2],
      [centers.S2, centers.S3],
    ] as const) {
      const bullet = createBullet(
        makeSnake,
        buildVerticalLayout(a, b),
        COLOR,
        COLOR
      );
      conns.push({ ...bullet, startT: 0, live: false });
    }

    for (const row of [1, 2, 3] as const) opts.setRowState(row, "pending");
    at(START_DELAY, () => startRow(1));
  }

  function update(t: number) {
    clock = t;

    if (conns.length === 0) {
      rebuild();
      if (conns.length === 0) return;
    }

    timerQueue.run(clock);

    for (const conn of conns) {
      if (!conn.live) continue;
      conn.throw.update(clock - conn.startT);
      if (conn.throw.done) conn.live = false;
    }
  }

  rebuild();
  return { update, rebuild };
}
