import DualCanvas from "@/components/_animations/DualCanvas";
import { createContainersVisual } from "./containers/visual";
import { createInterpreterVisual } from "./interpreter/visual";
import { createSdkControlVisual } from "./sdk-control/visual";
import { createStreamingVisual } from "./streaming/visual";

const REGISTRY = {
  "sdk-control": { create: createSdkControlVisual },
  interpreter: { create: createInterpreterVisual },
  streaming: { create: createStreamingVisual },
};

const CANVAS_ONLY = {
  containers: { create: createContainersVisual },
};

export default function FullStackCanvas() {
  "use no memo";

  return (
    <DualCanvas
      registry={REGISTRY}
      canvasOnly={CANVAS_ONLY}
      rootAttr="data-sandboxes-fullstack-visual"
      scopeAttr="data-sandboxes-fullstack-grid"
    />
  );
}
