"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { createStripesEngine, type StripesEngine } from "../engine";
import type { EngineConfig } from "../config/types";

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
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<StripesEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createStripesEngine(canvas);
    engineRef.current = engine;
    engine.start();
    return () => {
      engineRef.current = null;
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine && config) engine.setConfig(config);
  }, [config]);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine && width != null && height != null) engine.resize(width, height);
  }, [width, height]);

  useEffect(() => {
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
  }, [src, mediaKind, autoPlay, loop, muted]);

  return <canvas ref={canvasRef} className={className} style={style} />;
}
