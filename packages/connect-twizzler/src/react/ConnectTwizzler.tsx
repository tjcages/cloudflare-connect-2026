"use client";

import { useEffect, useRef, useState, type CSSProperties, type Ref } from "react";
import type { TwizzlerSettings } from "../twizzler";
import type { SharedTwizzlerHandle } from "../shared/coordinator";

export type ConnectTwizzlerProps = {
  settings?: Partial<TwizzlerSettings>;
  posterSrc?: string;
  className?: string;
  canvasClassName?: string;
  style?: CSSProperties;
  rootMargin?: string;
  maxFps?: number;
  maxDpr?: number;
  paused?: boolean;
  onReady?: () => void;
  ref?: Ref<HTMLCanvasElement>;
};

export function ConnectTwizzler({
  settings,
  posterSrc,
  className,
  canvasClassName,
  style,
  rootMargin,
  maxFps,
  maxDpr,
  paused = false,
  onReady,
  ref,
}: ConnectTwizzlerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<SharedTwizzlerHandle | null>(null);
  const settingsRef = useRef(settings);
  const pausedRef = useRef(paused);
  const onReadyRef = useRef(onReady);
  const [ready, setReady] = useState(false);
  settingsRef.current = settings;
  pausedRef.current = paused;
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;
    let handle: SharedTwizzlerHandle | null = null;
    void import("../shared/coordinator").then(({ registerSharedTwizzler }) => {
      if (cancelled || !canvasRef.current) return;
      handle = registerSharedTwizzler({
        canvas: canvasRef.current,
        settings: settingsRef.current,
        rootMargin,
        maxFps,
        maxDpr,
        paused: pausedRef.current,
        onReady: () => {
          setReady(true);
          onReadyRef.current?.();
        },
      });
      handleRef.current = handle;
    });
    return () => {
      cancelled = true;
      handle?.unregister();
      handleRef.current = null;
    };
  }, [rootMargin, maxFps, maxDpr]);

  useEffect(() => {
    if (settings) handleRef.current?.setSettings(settings);
  }, [settings]);

  useEffect(() => {
    handleRef.current?.setPaused(paused);
  }, [paused]);

  return (
    <span
      aria-hidden
      className={className}
      data-connect-twizzler-ready={ready ? "true" : "false"}
      style={{ display: "block", position: "relative", overflow: "hidden", ...style }}
    >
      {posterSrc ? (
        <img
          alt=""
          decoding="async"
          src={posterSrc}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
            opacity: ready ? 0 : 1,
            transition: "opacity 240ms ease-out",
          }}
        />
      ) : null}
      <canvas
        ref={(node) => {
          canvasRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={canvasClassName}
        style={{ display: "block", width: "100%", height: "100%", opacity: ready ? 1 : 0 }}
      />
    </span>
  );
}
