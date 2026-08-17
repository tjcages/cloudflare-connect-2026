import DualCanvas from "@/components/_animations/DualCanvas";
import { createApiVisual } from "./api/visual";
import { createDeployVisual } from "./deploy/visual";
import { createRunVisual } from "./run/visual";
import { createServerlessVisual } from "./serverless/visual";

const REGISTRY = {
  api: { create: createApiVisual },
  serverless: { create: createServerlessVisual },
  run: { create: createRunVisual },
};

const CANVAS_ONLY = {
  deploy: { create: createDeployVisual },
};

export default function UseCasesCanvas() {
  "use no memo";

  return (
    <DualCanvas
      scopeAttr="data-usecases-grid"
      rootAttr="data-usecases-visual"
      registry={REGISTRY}
      canvasOnly={CANVAS_ONLY}
    />
  );
}
