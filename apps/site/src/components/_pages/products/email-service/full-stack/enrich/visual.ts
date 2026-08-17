import { createSpinnerBridge } from "@/components/_animations/shared/choreography/spinner-bridge";
import { dispatchIllustrationEvent } from "@/components/_animations/shared/illustration-event";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import type { Visual } from "@/components/_animations/section-visuals";
import type { EnrichPillDetail } from "./EnrichPill";
import { createEnrichSequencer } from "./sequencer";

export function createEnrichVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const host = root.querySelector<HTMLElement>("[data-illustration-root]");
  if (!host) {
    throw new Error("createEnrichVisual: missing [data-illustration-root]");
  }

  const spinner = createSpinnerBridge(root, {
    ring: root.querySelector<HTMLElement>("[data-orbit-ring]"),
    centerId: "C",
  });

  const sequencer = createEnrichSequencer(makeSnake, {
    root,
    onPill: (detail) =>
      dispatchIllustrationEvent<EnrichPillDetail>(host, "enrich-pill", detail),
    onArriveHub: () => spinner.onHit("C", "retC"),
    onReturnHandoff: () => spinner.onApproachCenter("retC"),
  });

  cleanup(sequencer.destroy);

  return {
    tick: (elapsed, dt) => {
      sequencer.update(elapsed);
      spinner.tick(dt);
    },
    rebuild: sequencer.rebuild,
  };
}
