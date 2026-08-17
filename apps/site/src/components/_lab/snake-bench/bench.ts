import { buildConnector } from "@/components/_animations/shared/snake-pulse/build-connector";
import { createPulseThrow } from "@/components/_animations/shared/snake-pulse/pulse-throw";
import type {
  SnakeLayout,
  ThrowableSnake,
} from "@/components/_animations/shared/snake-pulse/snake";

const COLS = 7;
const ROWS = 15;
const CELL_W = 210;
const CELL_H = 52;
const SPAN = 150;
const BEND = 28;
const THROW = 1.6;
const STAGGER = 0.037;
const STAGGER_SLOTS = 32;
const WARMUP = 2;

export type BenchSummary = {
  impl: string;
  count: number;
  shape: string;
  seconds: number;
  frames: number;
  fps: number;
  frameP50: number;
  frameP95: number;
  frameP99: number;
  frameMax: number;
  over17: number;
  over33: number;
  tickP50: number;
  tickP95: number;
  tickMean: number;
  tickTotal: number;
};

export function benchLayouts(count: number, bent: boolean): SnakeLayout[] {
  return Array.from({ length: count }, (_, index) => {
    const slot = index % (COLS * ROWS);
    const x = 24 + (slot % COLS) * CELL_W;
    const y = 40 + Math.floor(slot / COLS) * CELL_H;
    return buildConnector(
      { x, y, side: "right" },
      { x: x + SPAN, y: bent ? y + BEND : y, side: "left" },
      { deep: 14 }
    );
  });
}

export function createDriver(
  entries: { snake: ThrowableSnake; layout: SnakeLayout }[]
) {
  const shots = entries.map(({ snake, layout }, index) => ({
    throw: createPulseThrow(snake, layout.endFraction, { duration: THROW }),
    startT: (index % STAGGER_SLOTS) * STAGGER,
    playing: false,
  }));

  return (clock: number) => {
    for (const shot of shots) {
      if (!shot.playing) {
        if (clock < shot.startT) continue;
        shot.throw.play({ onArrive: () => {} });
        shot.playing = true;
      }
      shot.throw.update(clock - shot.startT);
      if (shot.throw.done) {
        shot.startT = clock + 0.1;
        shot.playing = false;
      }
    }
  };
}

const percentile = (sorted: number[], p: number) =>
  sorted.length === 0
    ? 0
    : sorted[
        Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
      ];

const round = (n: number) => Math.round(n * 1000) / 1000;

function createStats() {
  let deltas: number[] = [];
  let ticks: number[] = [];
  let last = 0;
  let startedAt = 0;
  let recording = false;
  let meta = { impl: "none", count: 0, shape: "bent" };

  return {
    describe(next: { impl: string; count: number; shape: string }) {
      meta = next;
    },
    frame(now: number, tickMs: number) {
      if (last && recording && now - startedAt > WARMUP * 1000) {
        deltas.push(now - last);
        ticks.push(tickMs);
      }
      last = now;
    },
    start() {
      deltas = [];
      ticks = [];
      last = 0;
      startedAt = performance.now();
      recording = true;
    },
    stop() {
      recording = false;
    },
    get recording() {
      return recording;
    },
    result(): BenchSummary {
      const frameSorted = [...deltas].sort((a, b) => a - b);
      const tickSorted = [...ticks].sort((a, b) => a - b);
      const seconds = deltas.reduce((sum, d) => sum + d, 0) / 1000;
      const tickTotal = ticks.reduce((sum, t) => sum + t, 0);
      return {
        ...meta,
        seconds: round(seconds),
        frames: deltas.length,
        fps: round(seconds > 0 ? deltas.length / seconds : 0),
        frameP50: round(percentile(frameSorted, 50)),
        frameP95: round(percentile(frameSorted, 95)),
        frameP99: round(percentile(frameSorted, 99)),
        frameMax: round(frameSorted.at(-1) ?? 0),
        over17: deltas.filter((d) => d > 17).length,
        over33: deltas.filter((d) => d > 33).length,
        tickP50: round(percentile(tickSorted, 50)),
        tickP95: round(percentile(tickSorted, 95)),
        tickMean: round(ticks.length ? tickTotal / ticks.length : 0),
        tickTotal: round(tickTotal),
      };
    },
  };
}

export const benchStats = createStats();

declare global {
  interface Window {
    __bench: typeof benchStats;
  }
}

if (typeof window !== "undefined") window.__bench = benchStats;
