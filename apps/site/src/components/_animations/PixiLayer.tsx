import Pixi from "@/components/pixi/Pixi";
import { createSectionVisuals } from "./section-visuals";
import type { Visual, VisualContext } from "./section-visuals";

export default function PixiLayer({
  scopeAttr,
  rootAttr,
  registry,
  box,
}: {
  scopeAttr: string;
  rootAttr: string;
  registry: Record<string, { create: (ctx: VisualContext) => Visual }>;
  box: { left: number; top: number; width: number; height: number };
}) {
  "use no memo";

  return (
    <Pixi
      canvasAttrs={{
        "aria-hidden": "true",
        className: "pointer-events-none absolute",
        style: {
          left: `${box.left}px`,
          top: `${box.top}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
        },
      }}
      tickers={[createSectionVisuals({ scopeAttr, rootAttr, registry })]}
    />
  );
}
