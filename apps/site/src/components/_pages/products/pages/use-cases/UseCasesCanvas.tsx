import DualCanvas from "@/components/_animations/DualCanvas";
import { createGithubVisual } from "./github-integration/visual";
import { createShareVisual } from "./share-link/visual";

const REGISTRY = {
  github: { create: createGithubVisual },
  share: { create: createShareVisual },
};

export default function UseCasesCanvas() {
  "use no memo";

  return (
    <DualCanvas
      scopeAttr="data-pages-usecases-grid"
      rootAttr="data-pages-visual"
      registry={REGISTRY}
    />
  );
}
