import { Application, type ApplicationOptions } from "pixi.js";
import { type HTMLAttributes, type Ref, useCallback, useEffect, useRef } from "react";
import { isDestroyed } from "./utils";

function assignRef<T>(ref: Ref<T | null> | undefined, value: T | null) {
  if (ref === undefined) {
    return;
  }
  if (typeof ref === "function") {
    ref(value);
  } else if (ref !== null) {
    ref.current = value;
  }
}

export type Ticker<T = Record<string, unknown>> = (
  props: {
    app: Application;
    cleanup: (fn: () => void) => void;
  } & T,
) => void | Promise<void>;

export interface PixiProps {
  canvasAttrs?: HTMLAttributes<HTMLCanvasElement>;
  canvasRef?: Ref<HTMLCanvasElement | null>;
  initOptions?: Partial<ApplicationOptions>;
  layoutWidth: number;
  layoutHeight: number;
  onInitialized?: (app: Application) => void;
  onDisposed?: () => void;
  tickers: Ticker[];
}

function joinClassNames(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function Pixi({
  tickers,
  onInitialized,
  onDisposed,
  canvasAttrs,
  canvasRef: forwardedCanvasRef,
  initOptions,
  layoutWidth,
  layoutHeight,
}: PixiProps) {
  const { className: attrClassName, ...canvasRest } = canvasAttrs ?? {};
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mergeCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasRef.current = node;
      assignRef(forwardedCanvasRef, node);
    },
    [forwardedCanvasRef],
  );

  const appRef = useRef<Application | null>(null);

  /* Pixi application and tickers are intentionally mounted once; layout resizes handled below. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let aborted = false;
    const cleanupFunctions: (() => void)[] = [];

    const app = new Application();
    appRef.current = app;

    cleanupFunctions.push(() => {
      appRef.current = null;
      onDisposed?.();
      if (!isDestroyed(app)) {
        app.destroy(
          {},
          {
            children: true,
            texture: true,
            context: true,
            style: true,
          },
        );
      }
    });

    (async () => {
      const resolution = window.devicePixelRatio || 1;
      canvas.style.width = `${layoutWidth}px`;
      canvas.style.height = `${layoutHeight}px`;

      await app.init({
        canvas,
        width: layoutWidth,
        height: layoutHeight,
        resolution,
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

      if (aborted) {
        return;
      }

      for (const ticker of tickers) {
        await Promise.resolve(
          ticker({
            app,
            cleanup: (fn) => cleanupFunctions.push(fn),
          }),
        );
      }

      app.render();

      onInitialized?.(app);
    })();

    return () => {
      aborted = true;
      for (const fn of cleanupFunctions) {
        fn();
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps -- single Application mount; tickers are static module list
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app || isDestroyed(app)) {
      return;
    }

    const resolution = window.devicePixelRatio || 1;
    app.renderer.resize(layoutWidth, layoutHeight, resolution);
    const canvas = app.canvas as HTMLCanvasElement;
    canvas.style.width = `${layoutWidth}px`;
    canvas.style.height = `${layoutHeight}px`;
    app.render();
  }, [layoutWidth, layoutHeight]);

  return <canvas {...canvasRest} className={joinClassNames(attrClassName)} ref={mergeCanvasRef} />;
}
