import CanvasVisuals from "@/components/_animations/CanvasVisuals";
import { createBrowserCarouselVisual } from "./visual";

const REGISTRY = {
  "": { create: createBrowserCarouselVisual },
};

export default function BrowserCarouselCanvas() {
  "use no memo";

  return (
    <CanvasVisuals
      scopeAttr="data-browser-carousel"
      rootAttr="data-browser-carousel"
      registry={REGISTRY}
    />
  );
}
