import { createFloat } from "@/components/_animations/shared/float/create-float";
import { createGlobe } from "@/components/_animations/shared/globe/create-globe";
import type { CanvasVisualContext } from "@/components/_animations/canvas-visuals";
import type { Visual } from "@/components/_animations/section-visuals";
import { dispatchIllustrationEvent } from "@/components/_animations/shared/illustration-event";
import { FRAMEWORKS } from "./frameworks";
import { createIconOrbit } from "./orbit";
import { createViewPulse } from "./view-pulse";

const SWAP_EVERY = 2;

export function createDeployVisual({
  layer,
  root,
  cleanup,
}: CanvasVisualContext): Visual {
  const globe = createGlobe(root.clientWidth, root.clientHeight, {
    traffic: "sites",
  });
  layer.addChild(globe.container);
  cleanup(globe.destroy);

  const orbit = createIconOrbit(root);
  const viewPulse = createViewPulse(root);
  const float = createFloat(root);

  let swapAt = SWAP_EVERY;
  let frameworkIndex = 0;

  return {
    tick: (elapsed, dt) => {
      globe.tick(elapsed, dt);
      orbit.tick(dt);
      viewPulse.tick(elapsed, swapAt);
      float.tick(elapsed);

      if (elapsed >= swapAt) {
        swapAt += SWAP_EVERY;
        frameworkIndex = (frameworkIndex + 1) % FRAMEWORKS.length;
        dispatchIllustrationEvent(root, "deploy-framework", {
          index: frameworkIndex,
        });
      }
    },
    rebuild: () => {
      globe.resize(root.clientWidth, root.clientHeight);
    },
  };
}
