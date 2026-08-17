import DualCanvas from "@/components/_animations/DualCanvas";
import { createPillHubPillVisual } from "@/components/_animations/pill-hub-pill/visual";
import { createSideHubSideVisual } from "@/components/_animations/side-hub-side/visual";
import { createEnrichVisual } from "./enrich/visual";
import { createReplyVisual } from "./reply/visual";

const REGISTRY = {
  send: { create: createSideHubSideVisual },
  enrich: { create: createEnrichVisual },
  route: { create: createPillHubPillVisual },
  reply: { create: createReplyVisual },
};

export default function FullStackCanvas() {
  "use no memo";

  return (
    <DualCanvas
      scopeAttr="data-email-fullstack-grid"
      rootAttr="data-email-fullstack-visual"
      registry={REGISTRY}
    />
  );
}
