import type { Container } from "pixi.js";
import { CELL_SIZE, PLATE_INSET } from "../../../constants";
import type { IProductsBox } from "../../box/types";
import { createBoxNudge } from "./box-nudge";
import { connectorLayout } from "./layout";
import { createRing } from "./ring";
import { createScoopMask } from "./scoop-mask";
import { createSnake } from "@/components/_animations/shared/snake-pulse/snake";
import { createPulseThrow } from "@/components/_animations/shared/snake-pulse/pulse-throw";
import { RING_BAND } from "./textures";

const WAVE_REACH = CELL_SIZE - 2 * PLATE_INSET;
const WAVE_ALPHA = 0.3;

export type Pulse = {
  update: (t: number) => void;
  play: (opts: {
    onArrive: () => void;
    onHandoff?: () => void;
    onPass?: () => void;
    onThrow?: () => void;
  }) => void;
  readonly busy: boolean;
};

export function createPulse(
  layer: Container,
  source: IProductsBox,
  target: IProductsBox,
  {
    ring: showRing = true,
    duration,
    handoff,
    ease,
    fadeSourceFraction,
    fadeTargetFraction,
  }: {
    ring?: boolean;
    duration?: number;
    handoff?: number;
    ease?: (t: number) => number;
    /** Fade the snake over this fraction of the connector at the canvas-edge
     * end, so it dies out with the line's gradient instead of a 6px hairline. */
    fadeSourceFraction?: number;
    fadeTargetFraction?: number;
  } = {}
): Pulse {
  const layout = connectorLayout(source, target);
  const span = Math.abs(layout.to.x - layout.from.x);
  const snake = createSnake(layout, source.color, target.color, {
    sourceFade: fadeSourceFraction && span * fadeSourceFraction,
    targetFade: fadeTargetFraction && span * fadeTargetFraction,
  });
  const nudgeBox = createBoxNudge(target, layout.to.side === "left" ? 1 : -1);

  layer.addChild(snake.container);
  if (snake.emergeMask) layer.addChild(snake.emergeMask);

  let ring: ReturnType<typeof createRing> | null = null;
  if (showRing) {
    const scoopMask = createScoopMask(layout.plate, layout.to);
    ring = createRing(layout.caret, target.color, scoopMask);
    layer.addChild(ring, scoopMask);
  }

  const throwDriver = createPulseThrow(snake, layout.endFraction, {
    duration,
    handoff,
    ease,
  });

  return {
    get busy() {
      return throwDriver.busy;
    },
    update: (t) => throwDriver.update(t),
    play(opts) {
      throwDriver.play({
        onThrow: opts.onThrow,
        onHandoff: opts.onHandoff,
        onPass: opts.onPass,
        onArrive: () => {
          nudgeBox();
          opts.onArrive();
        },
        onWave: ring
          ? (wave) => {
              ring.visible = wave > 0 && wave < 1;
              ring.scale.set((wave * WAVE_REACH) / RING_BAND);
              ring.alpha = WAVE_ALPHA * (1 - wave);
            }
          : undefined,
      });
    },
  };
}
