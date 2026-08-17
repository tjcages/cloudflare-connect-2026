import DualCanvas from "@/components/_animations/DualCanvas";
import { createAutomationVisual } from "./automation/visual";

const REGISTRY = {
  automation: { create: createAutomationVisual },
};

export default function FullStackCanvas() {
  "use no memo";

  return (
    <DualCanvas
      scopeAttr="data-wfp-fullstack-grid"
      rootAttr="data-wfp-fullstack-visual"
      registry={REGISTRY}
    />
  );
}
