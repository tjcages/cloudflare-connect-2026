import Pixi from "@/components/pixi/Pixi";
import { createSectionVisuals } from "@/components/_animations/section-visuals";
import { createIsolatesVisual } from "./visual";

export default function IsolatesCanvas() {
  "use no memo";

  return (
    <Pixi
      canvasAttrs={{
        "aria-hidden": "true",
        className:
          "pointer-events-none absolute top-80 left-161 z-10 h-[calc(100%-160px)] w-[calc(100%-322px)] max-lg:hidden",
      }}
      tickers={[
        createSectionVisuals({
          scopeAttr: "data-isolates-animation",
          visuals: [{ create: createIsolatesVisual, mask: false }],
        }),
      ]}
    />
  );
}
