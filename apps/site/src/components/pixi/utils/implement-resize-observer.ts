import type { Application } from "pixi.js";
import { resolveZoom } from "@/utils/zoom";
import { isDestroyed } from "./is-destroyed";

export const implementResizeObserver = ({
  app,
  cleanup,
}: {
  app: Application;
  cleanup: (fn: () => void) => void;
}) => {
  const canvas = app.canvas as HTMLCanvasElement;

  let lastWidth = -1;
  let lastHeight = -1;
  let lastResolution = -1;

  const apply = () => {
    if (isDestroyed(app)) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const resolution = (window.devicePixelRatio || 1) * resolveZoom(canvas);

    if (
      width === lastWidth &&
      height === lastHeight &&
      resolution === lastResolution
    )
      return;

    lastWidth = width;
    lastHeight = height;
    lastResolution = resolution;

    app.renderer.resize(width, height, resolution);
    app.renderer.render(app.stage);
  };

  const resizeObserver = new ResizeObserver(apply);
  resizeObserver.observe(canvas);

  let dprQuery: MediaQueryList | null = null;

  const onDprChange = () => {
    apply();
    watchDpr();
  };

  const watchDpr = () => {
    dprQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`
    );
    dprQuery.addEventListener("change", onDprChange, { once: true });
  };

  watchDpr();

  cleanup(() => {
    resizeObserver.disconnect();
    dprQuery?.removeEventListener("change", onDprChange);
  });
};
