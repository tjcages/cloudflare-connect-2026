import type {
  Visual,
  VisualContext,
} from "@/components/_animations/section-visuals";
import type { IProductsBox } from "../box/types";
import { createDashedStrokes } from "./pulse/dashed-strokes";
import { createPulseAnimation, type PulseOptions } from "./pulse";

export function createProductsVisual(
  boxes: IProductsBox[],
  options: PulseOptions = {},
  edgeStyle: "dashed" | "solid" = "dashed"
) {
  return (ctx: VisualContext): Visual => {
    const pulse = createPulseAnimation(boxes, ctx.layer, ctx.app, ctx.cleanup, {
      ...options,
      edgeStyle,
    });
    const dashed =
      edgeStyle === "dashed"
        ? createDashedStrokes(
            boxes,
            ctx.layer,
            ctx.cleanup,
            options.canvasWidth
          )
        : null;

    return {
      tick: (elapsed, dt) => {
        pulse.tick(elapsed);
        dashed?.tick(dt);
      },
      rebuild: () => {},
    };
  };
}
