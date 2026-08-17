import { buildConnector } from "@/components/_animations/shared/snake-pulse/build-connector";
import { createBullet } from "@/components/_animations/shared/snake-pulse/bullet";
import {
  createPulseThrow,
  type PulseThrow,
  throwArriveTime,
} from "@/components/_animations/shared/snake-pulse/pulse-throw";
import type {
  SnakeFactory,
  ThrowableSnake,
} from "@/components/_animations/shared/snake-pulse/snake";
import { rnd } from "@/utils/random";
import {
  type ChipCenter,
  measureChips,
  sideAnchors,
} from "@/components/_animations/shared/chips/measure-chips";
import { createTimerQueue } from "./timer-queue";

const DEEP = 14;
const DESIGN_WIDTH = 481;
const GRID_CELL = 80;
const WAIT_MIN = 0.12;
const WAIT_MAX = 0.35;
const HOLD_ALL = 0.1;

export type Role = "outC" | "outR" | "retC" | "retL";
type Hop = {
  from: string;
  to: string;
  role: Role;
  seq?: number;
  wait?: number;
};

type ShuttleTiming = {
  duration: number;
  ease: (t: number) => number;
  exitDuration: number;
  entryWait: number;
  firstWait: number;
  wait: number;
};
type Conn = {
  snake: ThrowableSnake;
  throw: PulseThrow;
  arriveT: number;
  dwell: number;
};
type Shot = { conn: Conn; startT: number };
export type Chain = {
  slot: number;
  left: string;
  right: string;
  hops: Hop[];
  idx: number;
  nextLaunchAt: number;
  shots: Shot[];
  seqDone: boolean;
  done: boolean;
};

export type ChoreographyCtx = {
  clock: number;
  makeChain: (
    slot: number,
    left: string,
    right: string,
    startDelay: number,
    rightVisits?: number
  ) => Chain;
};

type Choreography = {
  update: (t: number) => void;
  rebuild: () => void;
  destroy: () => void;
};

export function createChoreographyEngine(
  makeSnake: SnakeFactory,
  opts: {
    root: HTMLElement;
    directed: Array<[string, string]>;
    slots: number;
    color: string;
    snakeColors?: (from: string, to: string) => [string, string];
    centerId: string;
    allChipIds: readonly string[];
    activatableIds: readonly string[];
    buildCycle: (ctx: ChoreographyCtx) => Chain[];
    onHit: (id: string, role: Role) => void;
    onActivate?: (id: string, on: boolean) => void;
    onApproachCenter?: (role: Role) => void;
    rightLead?: number;
    spinLead?: number;
    centerHold?: number;
    shuttleAll?: boolean;
    restTime?: number;
    shuttle?: ShuttleTiming;
    onCycleEnd?: () => void;
  }
): Choreography {
  const {
    root,
    directed,
    slots: SLOTS,
    color: COLOR,
    snakeColors,
    centerId,
    allChipIds,
    activatableIds,
    buildCycle: buildCycleOpt,
    onHit,
    onActivate,
    onApproachCenter,
    rightLead = 0,
    spinLead = 0,
    centerHold = 0,
    shuttleAll = false,
    restTime = 2,
    shuttle,
    onCycleEnd,
  } = opts;

  const conns = new Map<string, Conn>();
  const key = (slot: number, a: string, b: string, seq?: number) =>
    `${slot}:${a}->${b}${seq === undefined ? "" : `#${seq}`}`;
  const shuttleArriveT = shuttle
    ? throwArriveTime(shuttle.duration, shuttle.ease)
    : 0;

  let chains: Chain[] = [];
  let clock = 0;
  let phase: "running" | "holding" | "resting" = "running";
  let phaseUntil = 0;
  const timerQueue = createTimerQueue();

  function destroyConns() {
    for (const c of conns.values()) {
      c.snake.destroy();
    }
    conns.clear();
  }

  function deactivateAll() {
    for (const id of activatableIds) onActivate?.(id, false);
  }

  function reset() {
    chains = [];
    timerQueue.reset();
    phase = "running";
    deactivateAll();
  }

  let anchors: Record<string, ChipCenter> | null = null;
  let cellWidth = 0;

  function build(slot: number, a: string, b: string, seq?: number) {
    if (!anchors) return;
    const { from, to } = sideAnchors(anchors[a], anchors[b]);
    const other = a === centerId ? b : a;
    const centerX = anchors[centerId].cx;
    const bendX = other.startsWith("R")
      ? centerX + cellWidth
      : centerX - cellWidth;
    const layout = buildConnector(from, to, { deep: DEEP, bendX, root });
    const [src, tgt] = snakeColors?.(a, b) ?? [COLOR, COLOR];
    const connKey = key(slot, a, b, seq);

    if (shuttle && (shuttleAll || seq !== undefined)) {
      const snake = makeSnake(layout, src, tgt, {
        taper: false,
        emergeMask: false,
        blunt: true,
      });
      conns.set(connKey, {
        snake,
        throw: createPulseThrow(snake, layout.endFraction, {
          duration: shuttle.duration,
          ease: shuttle.ease,
          exitDuration: shuttle.exitDuration,
        }),
        arriveT: shuttleArriveT,
        dwell: 0,
      });
      return;
    }

    conns.set(connKey, createBullet(makeSnake, layout, src, tgt));
  }

  function rebuild() {
    destroyConns();
    reset();
    const centers = measureChips(root, allChipIds);
    anchors = centers;
    if (!centers) return;
    cellWidth = (root.clientWidth / DESIGN_WIDTH) * GRID_CELL;

    for (let slot = 0; slot < SLOTS; slot++) {
      for (const [a, b] of directed) build(slot, a, b);
    }
  }

  function makeChain(
    slot: number,
    left: string,
    right: string,
    startDelay: number,
    rightVisits = 1
  ): Chain {
    const hops: Hop[] = [{ from: left, to: centerId, role: "outC" }];
    for (let visit = 0; visit < rightVisits; visit++) {
      hops.push({ from: centerId, to: right, role: "outR" });
      hops.push({ from: right, to: centerId, role: "retC" });
    }
    hops.push({ from: centerId, to: left, role: "retL" });

    if (rightVisits > 1) {
      if (shuttle) hops[0].wait = shuttle.entryWait;
      const uses = new Map<string, number>();
      for (let index = 1; index < hops.length - 1; index++) {
        const hop = hops[index];
        const pair = `${hop.from}->${hop.to}`;
        const seq = uses.get(pair) ?? 0;
        uses.set(pair, seq + 1);
        hop.seq = seq;
        if (shuttle) {
          hop.wait = index === 1 ? shuttle.firstWait : shuttle.wait;
        }
      }
    }

    return {
      slot,
      left,
      right,
      hops,
      idx: 0,
      nextLaunchAt: clock + startDelay,
      shots: [],
      seqDone: false,
      done: false,
    };
  }

  function activate(id: string) {
    onActivate?.(id, true);
  }

  function buildCycle() {
    phase = "running";
    chains = buildCycleOpt({ clock, makeChain });
    for (const ch of chains) activate(ch.left);
  }

  function onArriveHop(hop: Hop, ch: Chain, dwell: number) {
    const { role } = hop;
    if (role === "outC") {
      onHit(centerId, role);
      ch.nextLaunchAt = clock + dwell + centerHold + (hop.wait ?? 0);
    } else if (role === "outR") {
      onHit(ch.right, role);
      ch.nextLaunchAt = clock + dwell + (hop.wait ?? rnd(WAIT_MIN, WAIT_MAX));
    } else if (role === "retC") {
      onHit(centerId, role);
      ch.nextLaunchAt = clock + dwell + centerHold + (hop.wait ?? 0);
    } else {
      onHit(ch.left, role);
      ch.seqDone = true;
    }
  }

  function launchHop(ch: Chain) {
    const hop = ch.hops[ch.idx];
    ch.nextLaunchAt = Number.POSITIVE_INFINITY;
    ch.idx++;
    const connKey = key(ch.slot, hop.from, hop.to, hop.seq);
    let conn = conns.get(connKey);
    if (!conn && hop.seq !== undefined) {
      build(ch.slot, hop.from, hop.to, hop.seq);
      conn = conns.get(connKey);
    }
    if (!conn) return;
    const { arriveT } = conn;
    if (hop.role === "outR") {
      timerQueue.push({
        at: clock + arriveT - rightLead,
        fn: () => activate(ch.right),
      });
    }
    if (hop.to === centerId && onApproachCenter) {
      timerQueue.push({
        at: clock + arriveT - spinLead,
        fn: () => onApproachCenter(hop.role),
      });
    }
    const { dwell } = conn;
    ch.shots.push({ conn, startT: clock });
    conn.throw.play({ onArrive: () => onArriveHop(hop, ch, dwell) });
  }

  function update(t: number) {
    clock = t;

    if (conns.size === 0) {
      rebuild();
      if (conns.size === 0) return;
    }

    if (phase === "holding") {
      if (clock >= phaseUntil) {
        deactivateAll();
        phase = "resting";
        phaseUntil = clock + restTime;
        onCycleEnd?.();
      }
      return;
    }

    if (phase === "resting") {
      if (clock >= phaseUntil) buildCycle();
      return;
    }

    if (chains.length === 0) buildCycle();

    timerQueue.run(clock);

    let allDone = chains.length > 0;
    for (const ch of chains) {
      if (ch.done) continue;
      if (ch.idx < ch.hops.length && clock >= ch.nextLaunchAt) launchHop(ch);
      for (const shot of ch.shots) shot.conn.throw.update(clock - shot.startT);
      ch.shots = ch.shots.filter((s) => !s.conn.throw.done);
      if (ch.seqDone && ch.idx >= ch.hops.length && ch.shots.length === 0) {
        ch.done = true;
      }
      if (!ch.done) allDone = false;
    }

    if (allDone) {
      phase = "holding";
      phaseUntil = clock + HOLD_ALL;
    }
  }

  rebuild();
  buildCycle();
  return { update, rebuild, destroy: destroyConns };
}
