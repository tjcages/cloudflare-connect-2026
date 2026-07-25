"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { createStripesEngine, type StripesEngine } from "../engine";
import { resolveThemedConfig, type ThemedEngineConfig, type ThemeName } from "../config/theme";
import { DEFAULT_ROOT_MARGIN } from "../core/visibility";
import type { SharedShaderHandle } from "../shared/coordinator";

export type StripesShaderProps = {
  src: string;
  mediaKind?: "video" | "image";
  config?: ThemedEngineConfig;
  /** Which theme's config to render. Dark deep-merges `config.dark` over the base. */
  theme?: ThemeName;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  className?: string;
  style?: CSSProperties;
  /**
   * Render through one WebGL context shared by every instance on the page,
   * driven from a worker. Defaults to `true`: one context and one program
   * compile for the whole page, and it is the only mode that defers an
   * offscreen instance's reveal until the canvas is actually in view.
   *
   * Pass `false` for a private per-instance context — needed for `EngineHooks`
   * (custom field/post/reveal passes), which cannot cross the worker boundary,
   * and for imperative access to the engine on the main thread. Both modes gate
   * rendering on `rootMargin`.
   */
  sharedContext?: boolean;
  /**
   * IntersectionObserver margin for the render gate, honored in both modes.
   * Outside it the render loop pauses; the GL context, source, sim state and
   * reveal timeline all survive, so a resumed instance continues rather than
   * replaying its reveal. Defaults to `"200% 0px"`.
   */
  rootMargin?: string;
  /** Shared mode only: rootMargin for the preload gate that starts image loading ahead of the render gate. */
  preloadRootMargin?: string;
  /** Shared mode only: delay the first source load so the reveal plays visibly after mount. */
  revealDelayMs?: number;
  /**
   * Called when the "wave" cursor trail's 0..1 activity changes. Fires from the
   * render loop, so keep the handler cheap. In shared mode the value is deduped
   * inside the worker and delivered over the shared-context protocol.
   */
  onWaterActivity?: (activity: number) => void;
};

export function StripesShader(props: StripesShaderProps) {
  const {
    src,
    mediaKind = "image",
    config,
    theme = "light",
    width,
    height,
    autoPlay = true,
    loop = true,
    muted = true,
    className,
    style,
    sharedContext = true,
    rootMargin,
    preloadRootMargin,
    revealDelayMs,
    onWaterActivity,
  } = props;

  const resolvedConfig = useMemo(() => (config ? resolveThemedConfig(config, theme) : undefined), [config, theme]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<StripesEngine | null>(null);
  const sharedHandleRef = useRef<SharedShaderHandle | null>(null);
  const configRef = useRef(config);
  // Held in a ref so a new handler identity never tears the engine down.
  const waterActivityRef = useRef(onWaterActivity);
  waterActivityRef.current = onWaterActivity;

  const mergedStyle = useMemo<CSSProperties>(
    () => ({ display: "block", ...(width != null && height != null ? { width, height } : null), ...style }),
    [width, height, style],
  );

  useEffect(() => {
    if (sharedContext) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createStripesEngine(canvas, {
      onWaterActivity: (activity) => waterActivityRef.current?.(activity),
    });
    engineRef.current = engine;
    engine.start();

    const applySize = () => {
      const w = Math.round(canvas.clientWidth);
      const h = Math.round(canvas.clientHeight);
      if (w > 0 && h > 0) engine.resize(w, h);
    };
    applySize();
    const ro = new ResizeObserver(applySize);
    ro.observe(canvas);

    return () => {
      ro.disconnect();
      engineRef.current = null;
      engine.dispose();
    };
  }, [sharedContext]);

  // Render gate for the private-context path, mirroring what the shared
  // coordinator does for shared instances. It pauses and resumes the rAF loop
  // and never disposes: the context, the loaded source and the reveal timeline
  // survive the pause, so scrolling away and back does not recompile programs
  // or replay the reveal. Separate from the engine effect so a `rootMargin`
  // change re-observes without tearing the context down.
  useEffect(() => {
    if (sharedContext) return;
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // start()/stop() are idempotent, so no visibility bookkeeping here.
          if (entry.isIntersecting) engineRef.current?.start();
          else engineRef.current?.stop();
        }
      },
      { rootMargin: rootMargin ?? DEFAULT_ROOT_MARGIN },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [sharedContext, rootMargin]);

  useEffect(() => {
    if (sharedContext) return;
    const engine = engineRef.current;
    if (engine && resolvedConfig) engine.setConfig(resolvedConfig);
  }, [sharedContext, resolvedConfig]);

  useEffect(() => {
    if (sharedContext) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let pointerInside = false;
    let lastClientX = Number.NaN;
    let lastClientY = Number.NaN;
    const hitTest = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      if (inside) {
        pointerInside = true;
        const zoom = canvas.currentCSSZoom ?? 1;
        engineRef.current?.setCursor((clientX - rect.left) / zoom, (clientY - rect.top) / zoom);
      } else if (pointerInside) {
        pointerInside = false;
        engineRef.current?.setCursor(null);
      }
    };
    const onMove = (e: PointerEvent) => {
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      hitTest(lastClientX, lastClientY);
    };
    // Scrolling moves the canvas under a stationary pointer, which fires no
    // pointer event; re-test so the cursor doesn't stick inside or outside.
    const onScroll = () => {
      if (!Number.isNaN(lastClientX)) hitTest(lastClientX, lastClientY);
    };
    const onLeave = () => {
      if (!pointerInside) return;
      pointerInside = false;
      engineRef.current?.setCursor(null);
    };
    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) return;
      const zoom = canvas.currentCSSZoom ?? 1;
      engineRef.current?.click((e.clientX - rect.left) / zoom, (e.clientY - rect.top) / zoom);
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [sharedContext]);

  useEffect(() => {
    if (sharedContext) return;
    const engine = engineRef.current;
    if (!engine) return;
    let disposed = false;

    if (mediaKind === "video") {
      const video = document.createElement("video");
      video.muted = muted;
      video.loop = loop;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      video.preload = "auto";
      const onReady = () => {
        if (disposed) return;
        engine.setSource(video);
        if (autoPlay) void video.play().catch(() => {});
      };
      video.addEventListener("loadeddata", onReady, { once: true });
      video.src = src;
      return () => {
        disposed = true;
        engine.setSource(null);
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    const onReady = () => {
      if (!disposed) engine.setSource(img);
    };
    img.addEventListener("load", onReady, { once: true });
    img.src = src;
    return () => {
      disposed = true;
      engine.setSource(null);
    };
  }, [sharedContext, src, mediaKind, autoPlay, loop, muted]);

  configRef.current = resolvedConfig;

  useEffect(() => {
    if (!sharedContext) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let handle: SharedShaderHandle | null = null;
    import("../shared/coordinator").then(({ registerSharedShader }) => {
      if (cancelled || !canvasRef.current) return;
      handle = registerSharedShader({
        canvas: canvasRef.current,
        src,
        mediaKind,
        config: resolvedConfig,
        revealDelayMs,
        loop,
        muted,
        autoPlay,
        rootMargin,
        preloadRootMargin,
        onWaterActivity: (activity) => waterActivityRef.current?.(activity),
      });
      sharedHandleRef.current = handle;
      if (configRef.current) handle.setConfig(configRef.current);
    });
    return () => {
      cancelled = true;
      handle?.unregister();
      sharedHandleRef.current = null;
    };
  }, [sharedContext, src, mediaKind, autoPlay, loop, muted, rootMargin, preloadRootMargin, revealDelayMs]);

  useEffect(() => {
    if (!sharedContext) return;
    const handle = sharedHandleRef.current;
    if (handle && resolvedConfig) handle.setConfig(resolvedConfig);
  }, [sharedContext, resolvedConfig]);

  return <canvas ref={canvasRef} className={className} style={mergedStyle} />;
}
