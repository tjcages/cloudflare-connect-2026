"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
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
  /**
   * IntersectionObserver margin for the render gate — the gate that decides
   * whether the instance renders (ambient blinks, drift, cursor trail) at all.
   * Outside it the render loop pauses; the GL context, source, sim state and
   * reveal timeline all survive, so a resumed instance continues rather than
   * replaying its reveal. Defaults to `"0px"`: any on-screen pixel renders, so a
   * visible canvas is never frozen and nothing offscreen burns GPU.
   *
   * The reveal gate is separate and not configurable — the reveal clock advances
   * once a quarter of the element's own height, or a quarter of the viewport
   * height, is on screen.
   */
  rootMargin?: string;
  /**
   * rootMargin for the preload gate that starts image loading ahead of the
   * render gate. Stays wide (`"200% 0px"`) so the source is decoded before the
   * render gate opens and the reveal never stalls on a fetch.
   */
  preloadRootMargin?: string;
  /** Delay the first source load so the reveal plays visibly after mount. */
  revealDelayMs?: number;
  /**
   * Called when the "wave" cursor trail's 0..1 activity changes. The value is
   * deduped inside the worker and delivered over the shared-context protocol,
   * but it still fires from the render loop — keep the handler cheap.
   */
  onWaterActivity?: (activity: number) => void;
  /** Name for this instance in the `subscribeStripesStats` debug readout. */
  label?: string;
};

/**
 * Renders `src` as an animated stripe-grid on a `<canvas>`.
 *
 * Every instance on the page draws through ONE WebGL2 context owned by a
 * worker, blitted back to each canvas in 2d — one context and one program
 * compile for the whole page, no matter how many shaders are mounted. This
 * requires `OffscreenCanvas` + `Worker` (Safari 16.4+) and there is no
 * main-thread fallback.
 *
 * For main-thread or imperative rendering — direct engine access, or
 * `EngineHooks` (custom field/post/reveal passes), which cannot cross the
 * worker boundary — use `createStripesEngine` from the package root instead.
 */
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
    rootMargin,
    preloadRootMargin,
    revealDelayMs,
    onWaterActivity,
    label,
  } = props;

  const resolvedConfig = useMemo(() => (config ? resolveThemedConfig(config, theme) : undefined), [config, theme]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sharedHandleRef = useRef<SharedShaderHandle | null>(null);
  const configRef = useRef(resolvedConfig);
  // Held in a ref so a new handler identity never tears the instance down.
  const waterActivityRef = useRef(onWaterActivity);
  waterActivityRef.current = onWaterActivity;

  const mergedStyle = useMemo<CSSProperties>(
    () => ({ display: "block", ...(width != null && height != null ? { width, height } : null), ...style }),
    [width, height, style],
  );

  configRef.current = resolvedConfig;

  useEffect(() => {
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
        config: configRef.current,
        revealDelayMs,
        loop,
        muted,
        autoPlay,
        rootMargin,
        preloadRootMargin,
        label,
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
  }, [src, mediaKind, autoPlay, loop, muted, rootMargin, preloadRootMargin, revealDelayMs, label]);

  useEffect(() => {
    const handle = sharedHandleRef.current;
    if (handle && resolvedConfig) handle.setConfig(resolvedConfig);
  }, [resolvedConfig]);

  return <canvas ref={canvasRef} className={className} style={mergedStyle} />;
}
