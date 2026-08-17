import Pixi from "@/components/pixi/Pixi";
import { createSectionVisuals } from "@/components/_animations/section-visuals";
import { CELL_SIZE } from "../../constants";
import type { IProductsBox } from "../box/types";
import type { PulseOptions } from "./pulse";
import { createProductsVisual } from "./visual";

const CROP_PAD = 24;

export default function ProductsCanvas({
  boxes,
  pulse,
  edgeStyle,
}: {
  boxes: IProductsBox[];
  pulse?: PulseOptions;
  edgeStyle?: "dashed" | "solid";
}) {
  "use no memo";

  const top = Math.min(...boxes.map((box) => box.position.y)) - CROP_PAD;
  const bottom =
    Math.max(...boxes.map((box) => box.position.y + CELL_SIZE)) + CROP_PAD;

  return (
    <Pixi
      canvasAttrs={{
        "aria-hidden": "true",
        className: "pointer-events-none absolute inset-x-0 w-full",
        style: { top, height: bottom - top },
      }}
      tickers={[
        createSectionVisuals({
          scopeAttr: "data-products-canvas",
          rootAttr: "data-products-visual",
          visuals: [
            {
              create: createProductsVisual(boxes, pulse, edgeStyle),
              mask: false,
            },
          ],
        }),
      ]}
    />
  );
}
