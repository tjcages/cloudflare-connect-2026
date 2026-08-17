import { createContainerStreamVisual } from "@/components/_animations/container-stream/visual";
import DualCanvas from "@/components/_animations/DualCanvas";
import { createSideHubSideVisual } from "@/components/_animations/side-hub-side/visual";
import { createLatencyVisual } from "./latency/visual";

const REGISTRY = {
  secure: { create: createContainerStreamVisual },
  sandbox: { create: createContainerStreamVisual },
  compute: { create: createSideHubSideVisual },
};

// The globe needs CanvasVisualContext.layer, which the backend-split registry
// does not hand out.
const CANVAS_ONLY = {
  latency: { create: createLatencyVisual },
};

export default function FullStackCanvas() {
  "use no memo";

  return (
    <DualCanvas
      scopeAttr="data-containers-fullstack-grid"
      rootAttr="data-containers-fullstack-visual"
      registry={REGISTRY}
      canvasOnly={CANVAS_ONLY}
    />
  );
}
