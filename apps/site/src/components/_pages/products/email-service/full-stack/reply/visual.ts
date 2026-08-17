import { createRingSpinner } from "@/components/_animations/shared/choreography/ring";
import { dispatchIllustrationEvent } from "@/components/_animations/shared/illustration-event";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import type { Visual } from "@/components/_animations/section-visuals";
import type { ReplyPillDetail } from "./actions";
import { createReplySequencer } from "./sequencer";

export function createReplyVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const host = root.querySelector<HTMLElement>("[data-illustration-root]");
  if (!host) {
    throw new Error("createReplyVisual: missing [data-illustration-root]");
  }

  const ring = createRingSpinner(
    root.querySelector<HTMLElement>("[data-orbit-ring]")
  );

  const sequencer = createReplySequencer(makeSnake, {
    root,
    onPill: (phase, index) =>
      dispatchIllustrationEvent<ReplyPillDetail>(host, "reply-pill", {
        phase,
        index,
      }),
  });

  cleanup(sequencer.destroy);

  return {
    tick: (elapsed, dt) => {
      sequencer.update(elapsed);
      ring.tick(dt);
    },
    rebuild: sequencer.rebuild,
  };
}
