import { Application, type ApplicationOptions } from "pixi.js";
import { type HTMLAttributes, type Ref, useCallback, useEffect, useRef } from "react";
import { isDestroyed } from "./pixiUtils";

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
  canvasAttrs?: HTMLAttributes<HTMLCanvasElement> & { "data-testid"?: string };
  canvasRef?: Ref<HTMLCanvasElement | null>;
  initOptions?: Partial<ApplicationOptions>;
  layoutWidth: number;
  layoutHeight: number;
  /** Runs after the canvas node exists and before `Application.init` / tickers / first render. */
  onPreload?: (canvas: HTMLCanvasElement) => void | Promise<void>;
  /** Merged into `init` after `onPreload` (e.g. pass a pre-created WebGL `context`). */
  resolveInitOptions?: (canvas: HTMLCanvasElement) => Partial<ApplicationOptions>;
  onInitialized?: (app: Application) => void;
  onDisposed?: () => void;
  tickers: Ticker[];
}

function joinClassNames(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function Pixi({
  tickers,
  onPreload,
  resolveInitOptions,
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
  const initCompleteRef = useRef(false);
  const tickersRef = useRef(tickers);
  tickersRef.current = tickers;
  const layoutSizeRef = useRef({ width: layoutWidth, height: layoutHeight });
  layoutSizeRef.current = { width: layoutWidth, height: layoutHeight };

  const applyLayoutSize = useCallback((app: Application) => {
    const resolution = app.renderer.resolution || window.devicePixelRatio || 1;
    const { width, height } = layoutSizeRef.current;
    app.renderer.resize(width, height, resolution);
    const canvas = app.canvas as HTMLCanvasElement;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    app.render();
  }, []);

  /* Pixi application and tickers mount once per canvas element; structural rebuilds use a React key. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let aborted = false;
    const resourceCleanups: (() => void)[] = [];
    initCompleteRef.current = false;

    const app = new Application();
    appRef.current = app;

    const runResourceCleanups = () => {
      for (let index = resourceCleanups.length - 1; index >= 0; index -= 1) {
        try {
          resourceCleanups[index]();
        } catch {
          // Ignore teardown errors during unmount.
        }
      }
      resourceCleanups.length = 0;
    };

    // Free the WebGL context. No-op while the app is still initializing (no renderer
    // yet), tears it down exactly once after `app.init` resolves. Safe to call repeatedly.
    const destroyApp = () => {
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
    };

    (async () => {
      const resolution = window.devicePixelRatio || 1;
      const initialLayout = layoutSizeRef.current;
      canvas.style.width = `${initialLayout.width}px`;
      canvas.style.height = `${initialLayout.height}px`;

      await Promise.resolve(onPreload?.(canvas));

      if (aborted) {
        return;
      }

      const resolvedInit = resolveInitOptions?.(canvas) ?? {};

      await app.init({
        canvas,
        width: initialLayout.width,
        height: initialLayout.height,
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
        ...resolvedInit,
      });

      if (aborted) {
        // Unmounted mid-init: the cleanup ran while the renderer was still null and
        // skipped destroy. Now that init produced a real WebGL context, free it here —
        // otherwise it leaks and eventually exhausts the browser's context limit.
        runResourceCleanups();
        destroyApp();
        return;
      }

      for (const ticker of tickersRef.current) {
        if (aborted) {
          break;
        }

        await Promise.resolve(
          ticker({
            app,
            cleanup: (fn) => resourceCleanups.push(fn),
          }),
        );
      }

      if (aborted) {
        runResourceCleanups();
        destroyApp();
        return;
      }

      initCompleteRef.current = true;
      applyLayoutSize(app);

      onInitialized?.(app);
    })();

    return () => {
      aborted = true;
      initCompleteRef.current = false;

      app.ticker?.stop?.();

      runResourceCleanups();

      appRef.current = null;
      onDisposed?.();

      destroyApp();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps -- initOptions/onPreload are intentionally stable per mount
  }, [applyLayoutSize]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || isDestroyed(app) || !initCompleteRef.current) {
      return;
    }

    applyLayoutSize(app);
  }, [layoutWidth, layoutHeight, applyLayoutSize]);

  return <canvas {...canvasRest} className={joinClassNames(attrClassName)} ref={mergeCanvasRef} />;
}
