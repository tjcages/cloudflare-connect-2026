import { Application, type ApplicationOptions } from "pixi.js";
import { type HTMLAttributes, useEffect, useRef } from "react";
import { resolveZoom } from "@/utils/zoom";

import { enableDisplayP3IfSupported } from "./utils/display-p3";
import { implementAlphaVisible } from "./utils/implement-alpha-visible";
import { implementDocumentVisibility } from "./utils/implement-document-visibility";
import { implementIntersectionObserver } from "./utils/implement-intersection-observer";
import { implementOverlayCovered } from "./utils/implement-overlay-covered";
import { implementResizeObserver } from "./utils/implement-resize-observer";
import { implementSafeTickers } from "./utils/implement-safe-tickers";
import { implementWindowUnload } from "./utils/implement-window-unload";
import { isDestroyed } from "./utils/is-destroyed";

export type Ticker = (props: {
  app: Application;
  cleanup: (fn: () => void) => void;
}) => void | Promise<void>;

export interface PixiProps {
  canvasAttrs?: HTMLAttributes<HTMLCanvasElement>;
  initOptions?: Partial<ApplicationOptions>;
  tickers: Ticker[];
}

// Antialiased WebGL at raw devicePixelRatio is 2.25× this cap's pixel work on
// a 3× phone; past 2× the extra resolution is invisible on these canvases.
const MAX_RESOLUTION = 2;

export default function Pixi({ tickers, canvasAttrs, initOptions }: PixiProps) {
  "use no memo";

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    let aborted = false;
    const cleanupFunctions: (() => void)[] = [];

    canvas.style.opacity = "0";

    const resolution =
      Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION) *
      resolveZoom(canvas);

    const app = new Application();

    let initialized = false;
    let appDestroyed = false;

    // isDestroyed(app) can't distinguish "not ready" from "already gone"; `initialized` does.
    const destroyApp = () => {
      if (appDestroyed) return;
      if (!initialized) return;

      appDestroyed = true;

      if (!isDestroyed(app)) {
        app.destroy(
          {},
          {
            children: true,
            texture: true,
            context: true,
            style: true,
          }
        );
      }

      canvas.style.opacity = "0";
    };

    cleanupFunctions.push(destroyApp);

    (async () => {
      implementAlphaVisible();

      await new Promise<void>((resolve) => {
        const observer = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) {
            observer.disconnect();
            resolve();
          }
        });

        observer.observe(canvas);
        cleanupFunctions.push(() => {
          observer.disconnect();
          resolve();
        });
      });

      if (aborted) return;

      await app.init({
        canvas,
        resolution,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        antialias: true,
        hello: false,

        autoStart: true,
        sharedTicker: false,
        clearBeforeRender: true,
        backgroundAlpha: 0,
        preference: "webgl",
        eventMode: "passive",

        ...initOptions,
      });

      initialized = true;

      if (aborted) {
        destroyApp();
        return;
      }

      const disposeDisplayP3 = enableDisplayP3IfSupported(app);
      if (disposeDisplayP3) cleanupFunctions.push(disposeDisplayP3);

      const state = implementSafeTickers(app, {
        onStart: () => {
          app.ticker.start();
        },
        onStop: () => {
          app.ticker.stop();
        },
      });

      if (aborted) return;

      for (const ticker of tickers) {
        ticker({
          app,
          cleanup: (fn) => cleanupFunctions.push(fn),
        });
      }

      app.render();

      canvas.style.opacity = "1";
      canvas.style.touchAction = "auto";

      const observers = [
        implementResizeObserver,
        implementWindowUnload,
        implementIntersectionObserver,
        implementDocumentVisibility,
        implementOverlayCovered,
      ];

      for (const fn of observers) {
        fn({
          state,
          app,
          cleanup: (fn) => cleanupFunctions.push(fn),
        });
      }
    })();

    return () => {
      aborted = true;
      for (let i = cleanupFunctions.length - 1; i >= 0; i--) {
        cleanupFunctions[i]();
      }
    };
  }, []);

  return (
    <canvas
      {...canvasAttrs}
      className={canvasAttrs?.className}
      ref={canvasRef}
      style={{
        ...canvasAttrs?.style,
        opacity: 0,
      }}
    />
  );
}
