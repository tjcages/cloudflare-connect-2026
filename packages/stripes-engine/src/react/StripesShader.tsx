"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { createStripesEngine, type StripesEngine } from "../engine";
import { resolveThemedConfig, type ThemedEngineConfig, type ThemeName } from "../config/theme";
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
  sharedContext?: boolean;
  rootMargin?: string;
  /** Shared mode only: rootMargin for the preload gate that starts image loading ahead of the render gate. */
  preloadRootMargin?: string;
  /** Shared mode only: delay the first source load so the reveal plays visibly after mount. */
  revealDelayMs?: number;
  /**
   * Standalone mode only: called when the "wave" cursor trail's 0..1 activity
   * changes. Fires from the render loop, so keep the handler cheap.
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
    sharedContext = false,
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
