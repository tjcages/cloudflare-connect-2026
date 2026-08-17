import { cubicBezier } from "motion";
import { clamp } from "./math";

export const DURATION = 3;
const SPLIT = 0.6;
const COLOR_TRIGGER = 0.3;
const START_BACK = 0;
const EXIT_SPEED = 2.5;
const THROW_EASE = cubicBezier(0.76, 0, 0.24, 1);

type ThrowSnake = {
  placeHead: (headFrac: number, transitionTime?: number) => void;
  body: number;
};

type ThrowHandlers = {
  onArrive: () => void;
  /** Fires `handoff` seconds before onArrive, to launch the next hop early. */
  onHandoff?: () => void;
  /** Fires once as the head reaches the halfway point of the connector. */
  onPass?: () => void;
  onThrow?: () => void;
  onWave?: (wave: number) => void;
};

// THROW_EASE starts very late, so the head of a fresh hop barely moves for its
// first fraction of a second. Solving for when the head lands lets a caller
// start the next hop that much early and hide the ramp.
function timeAtProgress(ease: (t: number) => number, target: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function throwArriveTime(duration: number, ease: (t: number) => number) {
  return duration * timeAtProgress(ease, SPLIT);
}

export type PulseThrow = {
  play: (h: ThrowHandlers) => void;
  update: (t: number) => void;
  readonly done: boolean;
  readonly busy: boolean;
};

export function createPulseThrow(
  snake: ThrowSnake,
  endFraction: number,
  {
    duration = DURATION,
    ease = THROW_EASE,
    exitDuration,
    handoff = 0,
  }: {
    duration?: number;
    ease?: (t: number) => number;
    exitDuration?: number;
    handoff?: number;
  } = {}
): PulseThrow {
  // Capped at `duration`: past that the throw is already over, so onHandoff
  // would never fire and every chain would stop after its first hop.
  const handoffAt = clamp(
    throwArriveTime(duration, ease) - handoff,
    0,
    duration
  );

  let state: "idle" | "playing" | "done" = "idle";
  let animStartT = -1;
  let colorTriggerT = -1;
  let arrivedAt = -1;
  let arrived = false;
  let handedOff = false;
  let passed = false;
  let thrown = false;
  let handlers: ThrowHandlers | null = null;

  return {
    get done() {
      return state === "done";
    },
    get busy() {
      return state === "playing";
    },
    play(h) {
      state = "playing";
      animStartT = -1;
      colorTriggerT = -1;
      arrivedAt = -1;
      arrived = false;
      handedOff = false;
      passed = false;
      thrown = false;
      handlers = h;
    },
    update(t) {
      if (state !== "playing") return;
      if (animStartT < 0) animStartT = t;

      const progress = ease(clamp((t - animStartT) / duration, 0, 1));
      const wave = Math.max(progress - SPLIT, 0) / (1 - SPLIT);

      if (!handedOff && t - animStartT >= handoffAt) {
        handedOff = true;
        handlers?.onHandoff?.();
      }

      // head = (progress / SPLIT) * endFraction, so half the throw is half the path.
      if (!passed && progress >= SPLIT / 2) {
        passed = true;
        handlers?.onPass?.();
      }

      if (colorTriggerT < 0 && progress / SPLIT >= COLOR_TRIGGER)
        colorTriggerT = t;
      const transitionTime = colorTriggerT < 0 ? -1 : t - colorTriggerT;

      if (wave <= 0) {
        const p = progress / SPLIT;
        const head = p * endFraction - (1 - p) * snake.body * START_BACK;
        if (!thrown && head >= 0) {
          thrown = true;
          handlers?.onThrow?.();
        }
        snake.placeHead(head, transitionTime);
        handlers?.onWave?.(0);
        return;
      }

      if (!arrived) {
        arrived = true;
        arrivedAt = t;
        handlers?.onArrive();
      }
      const exitWave =
        exitDuration === undefined
          ? wave
          : clamp((t - arrivedAt) / exitDuration, 0, 1);
      handlers?.onWave?.(exitWave);
      snake.placeHead(
        endFraction + exitWave * snake.body * EXIT_SPEED,
        transitionTime
      );
      if (exitWave >= 1) state = "done";
    },
  };
}
