import { chipEl } from "@/components/_animations/shared/chips/dom";
import { createSpinnerBridge } from "@/components/_animations/shared/choreography/spinner-bridge";
import { createTimerQueue } from "@/components/_animations/shared/choreography/timer-queue";
import { dispatchIllustrationEvent } from "@/components/_animations/shared/illustration-event";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import type { Visual } from "@/components/_animations/section-visuals";
import { buildLegs, type Leg, type Legs } from "./connectors";
import {
  createPillReel,
  REEL_SLIDE_TIME,
} from "@/components/_animations/shared/pill-reel/create-pill-reel";

const MAIL_FADE_IN = 0.9;
const HUB_WAIT = 0.5;
const RESOLVE_HOLD = 1.2;
const STATUS_LAG = 0.15;
const REST_TIME = 1;

export type StatusPhase = "idle" | "done";

export function createPillHubPillVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const host = root.querySelector<HTMLElement>("[data-illustration-root]");
  if (!host) {
    throw new Error(
      "createPillHubPillVisual: missing [data-illustration-root]"
    );
  }

  const colors = {
    mail: host.dataset.mailColor ?? "orange",
    hub: host.dataset.hubColor ?? "purple",
  };
  const statusCount = Number(host.dataset.statusCount ?? 1);

  const mailColumn = chipEl(host, "L");
  const statusColumn = chipEl(host, "R");
  const mailReel = mailColumn && createPillReel(mailColumn);
  const statusReel = statusColumn && createPillReel(statusColumn);

  // The shared bridge: onHit both nudges the hub chip and boosts the orbit.
  // Its onApproachCenter is deliberately NOT wired here. Every other consumer
  // schedules that decel RING_DECEL_TIME (0.8s) before the arrival so the ring
  // reaches zero exactly on impact, and this hop's whole flight is 0.63s — it
  // cannot fit, and forcing it in leaves the ring sitting frozen instead.
  const spinner = createSpinnerBridge(host, {
    ring: host.querySelector<HTMLElement>("[data-orbit-ring]"),
    centerId: "C",
  });
  const timers = createTimerQueue();

  let legs: Legs | null = null;
  let clock = 0;
  let statusIndex = 0;

  const setStatus = (phase: StatusPhase) => {
    statusReel?.setActive(phase !== "idle");
    dispatchIllustrationEvent(host, "pill:status", {
      phase,
      index: statusIndex,
    });
  };

  const launch = (leg: Leg, handlers: Parameters<Leg["throw"]["play"]>[0]) => {
    leg.startT = clock;
    leg.throw.play(handlers);
  };

  const advanceStatus = () => {
    // Deactivating and sliding on the same beat is what makes the answer read
    // as scrolling away: the word fades over the 60px it travels.
    setStatus("idle");
    if (statusCount > 1) statusIndex = (statusIndex + 1) % statusCount;
    statusReel?.advance();
    timers.push({ at: clock + REEL_SLIDE_TIME + REST_TIME, fn: startCycle });
  };

  const advanceMail = () => {
    mailReel?.setActive(false);
    mailReel?.advance();
    timers.push({ at: clock + STATUS_LAG, fn: advanceStatus });
  };

  const throwDelivery = () => {
    if (!legs) return;
    const { dwell } = legs.delivery;
    launch(legs.delivery, {
      onArrive: () => {
        // The snake shoves the pill along its own direction of travel, the same
        // as every other card. The answer reveals on the same beat.
        statusReel?.hop(1, "x");
        setStatus("done");
        timers.push({ at: clock + dwell + RESOLVE_HOLD, fn: advanceMail });
      },
    });
  };

  const throwIntake = () => {
    if (!legs) return;
    const { dwell } = legs.intake;
    launch(legs.intake, {
      onArrive: () => {
        spinner.onHit("C", "outC");
        timers.push({
          at: clock + dwell + HUB_WAIT,
          fn: throwDelivery,
        });
      },
    });
  };

  // The mail lands on an empty pill and fills it, then waits a beat so the
  // arrival reads before the snake carries it off.
  function startCycle() {
    if (!legs) return;
    mailReel?.setActive(true);
    mailReel?.hop(-1);
    timers.push({ at: clock + MAIL_FADE_IN, fn: throwIntake });
  }

  const teardown = () => {
    legs?.intake.snake.destroy();
    legs?.delivery.snake.destroy();
    legs = null;
    timers.reset();
  };

  cleanup(() => {
    teardown();
    mailReel?.destroy();
    statusReel?.destroy();
  });

  return {
    tick: (elapsed, dt) => {
      clock = elapsed;

      if (!legs) {
        legs = buildLegs(host, makeSnake, colors);
        if (!legs) return;
        startCycle();
      }

      timers.run(clock);
      legs.intake.throw.update(clock - legs.intake.startT);
      legs.delivery.throw.update(clock - legs.delivery.startT);
      spinner.tick(dt);
    },
    rebuild: () => {
      teardown();
      mailReel?.settle();
      statusReel?.settle();
      mailReel?.setActive(false);
      setStatus("idle");
    },
  };
}
