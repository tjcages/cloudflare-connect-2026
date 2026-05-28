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
  onPreload?: (canvas: HTMLCanvasElement) => void | Promise<void>;
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
  const layoutSizeRef = useRef({ width: layoutWidth, height: layoutHeight });
  layoutSizeRef.current = { width: layoutWidth, height: layoutHeight };
  const initResolutionRef = useRef(initOptions?.resolution ?? (window.devicePixelRatio || 1));

  const applyLayoutSize = useCallback((app: Application) => {
    const resolution = initResolutionRef.current;
    const { width, height } = layoutSizeRef.current;
    app.renderer.resize(width, height, resolution);
    const canvas = app.canvas as HTMLCanvasElement;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    app.render();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let aborted = false;
    const resourceCleanups: (() => void)[] = [];
    initCompleteRef.current = false;
    initResolutionRef.current = initOptions?.resolution ?? (window.devicePixelRatio || 1);

    const app = new Application();
    appRef.current = app;

    (async () => {
      const resolution = initResolutionRef.current;
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
        return;
      }

      for (const ticker of tickers) {
        await Promise.resolve(
          ticker({
            app,
            cleanup: (fn) => resourceCleanups.push(fn),
          }),
        );
      }

      initCompleteRef.current = true;
      applyLayoutSize(app);

      onInitialized?.(app);
    })();

    return () => {
      aborted = true;
      initCompleteRef.current = false;
      for (const fn of resourceCleanups) {
        fn();
      }
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
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps -- single Application mount; tickers are static module list
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
