"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { createStripesEngine, type StripesEngine } from "../engine";
import type { EngineConfig } from "../config/types";
import type { SharedShaderHandle } from "../shared/coordinator";

export type StripesShaderProps = {
  src: string;
  mediaKind?: "video" | "image";
  config?: Partial<EngineConfig>;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  className?: string;
  style?: CSSProperties;
  sharedContext?: boolean;
  rootMargin?: string;
};

export function StripesShader(props: StripesShaderProps) {
  const {
    src,
    mediaKind = "image",
    config,
    width,
    height,
    autoPlay = true,
    loop = true,
    muted = true,
    className,
    style,
    sharedContext = false,
    rootMargin,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<StripesEngine | null>(null);
  const sharedHandleRef = useRef<SharedShaderHandle | null>(null);
  const configRef = useRef(config);

  const mergedStyle = useMemo<CSSProperties>(
    () => ({ display: "block", ...(width != null && height != null ? { width, height } : null), ...style }),
    [width, height, style],
  );

  useEffect(() => {
    if (sharedContext) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createStripesEngine(canvas);
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
    if (engine && config) engine.setConfig(config);
  }, [sharedContext, config]);

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

  configRef.current = config;

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
        config,
        loop,
        muted,
        autoPlay,
        rootMargin,
      });
      sharedHandleRef.current = handle;
      if (configRef.current) handle.setConfig(configRef.current);
    });
    return () => {
      cancelled = true;
      handle?.unregister();
      sharedHandleRef.current = null;
    };
  }, [sharedContext, src, mediaKind, autoPlay, loop, muted, rootMargin]);

  useEffect(() => {
    if (!sharedContext) return;
    const handle = sharedHandleRef.current;
    if (handle && config) handle.setConfig(config);
  }, [sharedContext, config]);

  return <canvas ref={canvasRef} className={className} style={mergedStyle} />;
}
