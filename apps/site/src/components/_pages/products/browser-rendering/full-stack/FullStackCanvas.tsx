import DualCanvas from "@/components/_animations/DualCanvas";
import { createBotVisual } from "./bot/visual";
import { createLibrariesVisual } from "./libraries/visual";
import { createRenderVisual } from "./render/visual";

const REGISTRY = {
  render: { create: createRenderVisual },
  libraries: { create: createLibrariesVisual },
  bot: { create: createBotVisual },
};

export default function FullStackCanvas() {
  "use no memo";

  return (
    <DualCanvas
      scopeAttr="data-fullstack-grid"
      rootAttr="data-fullstack-visual"
      registry={REGISTRY}
    />
  );
}
