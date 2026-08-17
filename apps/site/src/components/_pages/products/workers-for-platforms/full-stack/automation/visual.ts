import {
  measureChips,
  sideAnchors,
} from "@/components/_animations/shared/chips/measure-chips";
import { createSpinnerBridge } from "@/components/_animations/shared/choreography/spinner-bridge";
import { createTimerQueue } from "@/components/_animations/shared/choreography/timer-queue";
import { dispatchIllustrationEvent } from "@/components/_animations/shared/illustration-event";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import { buildConnector } from "@/components/_animations/shared/snake-pulse/build-connector";
import { createBullet } from "@/components/_animations/shared/snake-pulse/bullet";
import type { PulseThrow } from "@/components/_animations/shared/snake-pulse/pulse-throw";
import type {
  SnakeFactory,
  ThrowableSnake,
} from "@/components/_animations/shared/snake-pulse/snake";
import type { Visual } from "@/components/_animations/section-visuals";
import {
  createPillReel,
  REEL_SLIDE_TIME,
} from "@/components/_animations/shared/pill-reel/create-pill-reel";
import type { AutomationPillDetail } from "./AutomationPill";
import { AUTOMATION_EVENTS } from "./events";

const COLOR = "purple";
const DEEP = 14;
const BURY = 24;
const TRIGGER_HOLD = 0.9;
const HUB_WAIT = 1;
const RESULT_HOLD = 1.2;

type Leg = {
  snake: ThrowableSnake;
  throw: PulseThrow;
  dwell: number;
  startT: number;
};
type Legs = { send: Leg; reply: Leg };

function buildLegs(host: HTMLElement, makeSnake: SnakeFactory): Legs | null {
  const centers = measureChips(host, ["C", "R"] as const);
  if (!centers) return null;

  const leg = (from: "C" | "R", to: "C" | "R"): Leg => {
    const anchors = sideAnchors(centers[from], centers[to]);
    const start = {
      ...anchors.from,
      x: anchors.from.x + (anchors.to.x >= anchors.from.x ? -BURY : BURY),
    };
    const bullet = createBullet(
      makeSnake,
      buildConnector(start, anchors.to, { deep: DEEP, root: host }),
      COLOR
    );
    return { ...bullet, startT: 0 };
  };

  return { send: leg("R", "C"), reply: leg("C", "R") };
}

export function createAutomationVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const host = root.querySelector<HTMLElement>("[data-illustration-root]");
  if (!host) {
    throw new Error("createAutomationVisual: missing [data-illustration-root]");
  }

  const reel = createPillReel(host);
  const spinner = createSpinnerBridge(host, {
    ring: host.querySelector<HTMLElement>("[data-orbit-ring]"),
    centerId: "C",
  });
  const timers = createTimerQueue();

  let legs: Legs | null = null;
  let clock = 0;
  let index = 0;

  const onPill = (phase: AutomationPillDetail["phase"]) =>
    dispatchIllustrationEvent<AutomationPillDetail>(host, "automation-pill", {
      phase,
      index,
    });

  const launch = (leg: Leg, handlers: Parameters<Leg["throw"]["play"]>[0]) => {
    leg.startT = clock;
    leg.throw.play(handlers);
  };

  const advance = () => {
    onPill("idle");
    reel?.setActive(false);
    index = (index + 1) % AUTOMATION_EVENTS.length;
    reel?.advance();
    timers.push({ at: clock + REEL_SLIDE_TIME, fn: startCycle });
  };

  const throwReply = () => {
    if (!legs) return;
    const { dwell } = legs.reply;
    launch(legs.reply, {
      onArrive: () => {
        reel?.hop(1, "x");
        onPill("result");
        timers.push({ at: clock + dwell + RESULT_HOLD, fn: advance });
      },
    });
  };

  const throwSend = () => {
    if (!legs) return;
    const { dwell } = legs.send;
    launch(legs.send, {
      onArrive: () => {
        spinner.onHit("C", "retC");
        timers.push({ at: clock + dwell + HUB_WAIT, fn: throwReply });
      },
    });
  };

  function startCycle() {
    reel?.setActive(true);
    reel?.hop(-1);
    onPill("trigger");
    timers.push({ at: clock + TRIGGER_HOLD, fn: throwSend });
  }

  const teardown = () => {
    legs?.send.snake.destroy();
    legs?.reply.snake.destroy();
    legs = null;
    timers.reset();
  };

  cleanup(() => {
    teardown();
    reel?.destroy();
  });

  return {
    tick: (elapsed, dt) => {
      clock = elapsed;

      if (!legs) {
        legs = buildLegs(host, makeSnake);
        if (!legs) return;
        startCycle();
      }

      timers.run(clock);
      legs.send.throw.update(clock - legs.send.startT);
      legs.reply.throw.update(clock - legs.reply.startT);
      spinner.tick(dt);
    },
    rebuild: () => {
      teardown();
      reel?.settle();
      reel?.setActive(false);
      onPill("idle");
    },
  };
}
