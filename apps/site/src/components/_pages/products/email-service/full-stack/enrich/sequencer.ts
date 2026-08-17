import {
  type ChipCenter,
  measureChips,
  sideAnchors,
} from "@/components/_animations/shared/chips/measure-chips";
import { RING_DECEL_TIME } from "@/components/_animations/shared/choreography/ring";
import { buildConnector } from "@/components/_animations/shared/snake-pulse/build-connector";
import { createBullet } from "@/components/_animations/shared/snake-pulse/bullet";
import type { PulseThrow } from "@/components/_animations/shared/snake-pulse/pulse-throw";
import type {
  SnakeFactory,
  ThrowableSnake,
} from "@/components/_animations/shared/snake-pulse/snake";
import { type ClassificationStep, drawPass } from "./classifications";
import type { EnrichPillDetail } from "./EnrichPill";
import { createPillReel } from "@/components/_animations/shared/pill-reel/create-pill-reel";

const COLOR = "purple";
const CHIP_IDS = ["C", "R"] as const;
const DEEP = 14;
const EXIT = 0.3;
const THINKING = 2;
// Each answer holds for this long. The label fades in over ~0.45s, so the
// remainder is the time it sits still to be read.
const STEP = 1.1;
// Measured from the return snake's arrival at the hub, not from its exit tail.
const REST = 1.5;

type Phase = "rest" | "deliver" | "thinking" | "classify" | "return";
type Leg = { snake: ThrowableSnake; throw: PulseThrow; dwell: number };
type Shot = { leg: Leg; startT: number };

export function createEnrichSequencer(
  makeSnake: SnakeFactory,
  opts: {
    root: HTMLElement;
    onPill: (detail: EnrichPillDetail) => void;
    onArriveHub: () => void;
    onReturnHandoff: () => void;
  }
) {
  const reel = createPillReel(opts.root);

  let legs: { out: Leg; back: Leg } | null = null;
  let shots: Shot[] = [];
  let phase: Phase = "rest";
  let phaseUntil = REST;
  let clock = 0;
  // The pass is redrawn per cycle, so the dimensions and the answers inside
  // them both change. `step` indexes into it.
  let pass: ClassificationStep[] = drawPass();
  let step = 0;
  let active: HTMLElement | null = null;

  const connect = (from: ChipCenter, to: ChipCenter, handoff: number): Leg => {
    const anchors = sideAnchors(from, to);
    return createBullet(
      makeSnake,
      buildConnector(anchors.from, anchors.to, { deep: DEEP, root: opts.root }),
      COLOR,
      COLOR,
      { exitDuration: EXIT, handoff }
    );
  };

  const build = () => {
    const chips = measureChips(opts.root, CHIP_IDS);
    if (!chips) return null;

    legs = {
      out: connect(chips.C, chips.R, 0),
      // The ring has to be still by the time the answer lands, and the throw is
      // far shorter than the deceleration — so this hands off at launch.
      back: connect(chips.R, chips.C, RING_DECEL_TIME),
    };
    return legs;
  };

  const destroyLegs = () => {
    if (legs) {
      legs.out.snake.destroy();
      legs.back.snake.destroy();
    }
    legs = null;
    shots = [];
  };

  const launch = (
    leg: Leg,
    handlers: { onArrive: () => void; onHandoff?: () => void }
  ) => {
    shots.push({ leg, startT: clock });
    leg.throw.play(handlers);
  };

  // The snake lands from the left, so the impact carries the pill along its own
  // direction of travel rather than lifting it.
  const shovePill = () => reel?.hop(1, "x");
  const hopPill = () => reel?.hop(-1);

  const arrivePill = (dwell: number) => {
    active = reel?.centerCell() ?? null;
    active?.setAttribute("data-active", "");
    shovePill();
    opts.onPill({ phase: "thinking", ...pass[0] });
    phase = "thinking";
    phaseUntil = clock + dwell + THINKING;
  };

  // Every answer lands with the hop the single result used to take, so the four
  // of them read as four separate arrivals rather than a label ticking over.
  const resolve = () => {
    opts.onPill({ phase: "resolved", ...pass[step] });
    hopPill();
    phaseUntil = clock + STEP;
  };

  const arriveHub = (dwell: number) => {
    opts.onArriveHub();
    phase = "rest";
    phaseUntil = clock + dwell + REST;
  };

  const update = (t: number) => {
    clock = t;

    const built = legs ?? build();
    if (!built) return;

    for (const shot of shots) shot.leg.throw.update(clock - shot.startT);
    shots = shots.filter((shot) => !shot.leg.throw.done);

    if (clock < phaseUntil) return;

    switch (phase) {
      case "rest": {
        phase = "deliver";
        phaseUntil = Number.POSITIVE_INFINITY;
        pass = drawPass();
        launch(built.out, { onArrive: () => arrivePill(built.out.dwell) });
        return;
      }
      case "thinking": {
        phase = "classify";
        step = 0;
        resolve();
        return;
      }
      case "classify": {
        if (step + 1 < pass.length) {
          step += 1;
          resolve();
          return;
        }

        phase = "return";
        phaseUntil = Number.POSITIVE_INFINITY;
        // The last answer belongs to the pill that is leaving, so the content is
        // not pre-moved below centre — it rides up with its own row and only
        // snaps back once the slide commits, by which time it has faded out.
        opts.onPill({ phase: "idle", ...pass[step] });
        active?.removeAttribute("data-active");
        active = null;
        reel?.advance();
        launch(built.back, {
          onArrive: () => arriveHub(built.back.dwell),
          onHandoff: opts.onReturnHandoff,
        });
        return;
      }
      default:
        return;
    }
  };

  const rebuild = () => {
    destroyLegs();
    reel?.settle();
    active?.removeAttribute("data-active");
    active = null;
    opts.onPill({ phase: "idle", ...pass[step] });
    phase = "rest";
    phaseUntil = clock + REST;
  };

  const destroy = () => {
    destroyLegs();
    reel?.destroy();
  };

  return { update, rebuild, destroy };
}
