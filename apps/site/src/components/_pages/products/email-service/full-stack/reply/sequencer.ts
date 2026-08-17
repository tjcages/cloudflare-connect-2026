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
import type { ReplyPhase } from "./actions";
import {
  createPillReel,
  REEL_SLIDE_TIME,
} from "@/components/_animations/shared/pill-reel/create-pill-reel";

const COLOR = "purple";
const CHIP_IDS = ["C", "R"] as const;
const DEEP = 14;

const WORKING = 1.4;
const RESOLVED = 1.2;
const REST = 1;

type Phase = "rest" | "deliver" | "working" | "resolved";

export function createReplySequencer(
  makeSnake: SnakeFactory,
  opts: {
    root: HTMLElement;
    onPill: (phase: ReplyPhase, index: number) => void;
  }
) {
  const reel = createPillReel(opts.root);

  let leg: { snake: ThrowableSnake; throw: PulseThrow; dwell: number } | null =
    null;
  let running = false;
  let startedAt = 0;
  let phase: Phase = "rest";
  let phaseUntil = REST;
  let clock = 0;
  let index = 0;
  let active: HTMLElement | null = null;

  const build = () => {
    const chips = measureChips(opts.root, CHIP_IDS);
    if (!chips) return null;

    const anchors = sideAnchors(chips.C, chips.R);
    leg = createBullet(
      makeSnake,
      buildConnector(anchors.from, anchors.to, { deep: DEEP, root: opts.root }),
      COLOR,
      COLOR,
      { exitDuration: 0.3 }
    );
    return leg;
  };

  const destroyLeg = () => {
    leg?.snake.destroy();
    leg = null;
    running = false;
  };

  const shovePill = () => reel?.hop(1, "x");
  const hopPill = () => reel?.hop(-1);

  const arrive = (dwell: number) => {
    active = reel?.centerCell() ?? null;
    if (active) active.setAttribute("data-active", "");
    shovePill();
    opts.onPill("working", index);
    phase = "working";
    phaseUntil = clock + dwell + WORKING;
  };

  const update = (t: number) => {
    clock = t;

    const built = leg ?? build();
    if (!built) return;

    if (running) {
      built.throw.update(clock - startedAt);
      if (built.throw.done) running = false;
    }

    if (clock < phaseUntil) return;

    switch (phase) {
      case "rest": {
        phase = "deliver";
        phaseUntil = Number.POSITIVE_INFINITY;
        running = true;
        startedAt = clock;
        built.throw.play({ onArrive: () => arrive(built.dwell) });
        return;
      }
      case "working": {
        phase = "resolved";
        phaseUntil = clock + RESOLVED;
        opts.onPill("resolved", index);
        hopPill();
        return;
      }
      case "resolved": {
        phase = "rest";
        phaseUntil = clock + REEL_SLIDE_TIME + REST;
        opts.onPill("idle", index);
        active?.removeAttribute("data-active");
        active = null;
        index += 1;
        reel?.advance();
        return;
      }
      default:
        return;
    }
  };

  const rebuild = () => {
    destroyLeg();
    reel?.settle();
    active?.removeAttribute("data-active");
    active = null;
    opts.onPill("idle", index);
    phase = "rest";
    phaseUntil = clock + REST;
  };

  const destroy = () => {
    destroyLeg();
    active?.removeAttribute("data-active");
    active = null;
    reel?.destroy();
  };

  return { update, rebuild, destroy };
}
