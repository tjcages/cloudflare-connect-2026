"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Pixi from "./pixiMount";
import { createStripesWebGLContext, stripesPreferDisplayP3, applyStripesDrawingBufferColorSpace } from "./webglInit";
import {
  createStripesShaderScene,
  getPlaygroundTextureNativeSize,
  PLAYGROUND_PIXI_RESOLUTION,
  resolvePlaygroundDisplaySize,
  type PlaygroundDisplaySize,
  type PlaygroundRevealPlayback,
  type PlaygroundTextureSource,
} from "./setupTextureShaderScene";
import { preloadStripeLetterFont } from "./stripeLetterFont";
import { createPlaygroundFlamesState } from "./playgroundFlames";
import { normalizeStripesShaderConfig, type StripesShaderConfig } from "./StripesShaderConfig";
import { resolveStripesSceneConfig } from "./buildSceneConfig";
import type { PlaygroundRevealState } from "./playgroundReveal";

// SSR guard — bail to a placeholder when running outside the browser.
if (typeof window === "undefined") {
  // Export a no-op placeholder for SSR environments.
  // The module-level guard ensures the real component below never executes server-side.
}

export type StripesShaderProps = {
  src: string;
  mediaKind?: "video" | "image";
  config?: Partial<StripesShaderConfig>;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
};

type MediaLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; source: PlaygroundTextureSource; native: PlaygroundDisplaySize };

function loadMedia(src: string, mediaKind: "video" | "image"): Promise<MediaLoadState> {
  if (mediaKind === "video") {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";

      const onError = () => {
        resolve({ status: "error", message: `Failed to load video: ${src}` });
      };

      const onLoadedMetadata = () => {
        const native = getPlaygroundTextureNativeSize({ kind: "video", element: video });
        if (native.width <= 0 || native.height <= 0) {
          onError();
          return;
        }
        resolve({ status: "ready", source: { kind: "video", element: video }, native });
      };

      video.addEventListener("error", onError, { once: true });
      video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
      video.src = src;
      video.load();
    });
  }

  return new Promise((resolve) => {
    const image = document.createElement("img");
    image.crossOrigin = "anonymous";

    const onError = () => {
      resolve({ status: "error", message: `Failed to load image: ${src}` });
    };

    const onLoad = () => {
      const native = getPlaygroundTextureNativeSize({ kind: "image", element: image });
      if (native.width <= 0 || native.height <= 0) {
        onError();
        return;
      }
      resolve({ status: "ready", source: { kind: "image", element: image }, native });
    };

    image.addEventListener("error", onError, { once: true });
    image.addEventListener("load", onLoad, { once: true });
    image.src = src;
  });
}

function StripesShaderSSRPlaceholder({
  className,
  style,
  width,
  height,
}: Pick<StripesShaderProps, "className" | "style" | "width" | "height">) {
  const placeholderStyle: CSSProperties = {
    width: width ?? "100%",
    height: height ?? "100%",
    minHeight: height ? undefined : 240,
    ...style,
  };
  return <div className={className} style={placeholderStyle} aria-busy="true" />;
}

export function StripesShader({
  src,
  mediaKind = "video",
  config,
  width,
  height,
  autoPlay = true,
  loop = true,
  muted = true,
  paused = false,
  className,
  style,
}: StripesShaderProps) {
  // SSR guard
  if (typeof window === "undefined") {
    return <StripesShaderSSRPlaceholder className={className} style={style} width={width} height={height} />;
  }

  return (
    <StripesShaderClient
      src={src}
      mediaKind={mediaKind}
      config={config}
      width={width}
      height={height}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      paused={paused}
      className={className}
      style={style}
    />
  );
}

// Separate client component to avoid conditional hook usage after SSR check
function StripesShaderClient({
  src,
  mediaKind = "video",
  config,
  width,
  height,
  autoPlay = true,
  loop: _loop = true,
  muted: _muted = true,
  paused: _paused = false,
  className,
  style,
}: StripesShaderProps) {
  const [loadState, setLoadState] = useState<MediaLoadState>({ status: "loading" });

  // Normalize config on each render so refs always see the current resolved values
  const normalizedConfig = normalizeStripesShaderConfig(config ?? {});

  const preferP3Ref = useRef(false);
  const flamesStateRef = useRef(createPlaygroundFlamesState());
  const revealStateRef = useRef<PlaygroundRevealState>({ progress: 0 });
  const revealPlaybackRef = useRef<PlaygroundRevealPlayback>({
    replayKey: 0,
    startedAtMs: typeof performance !== "undefined" ? performance.now() : 0,
  });

  // Bump revealPlayback when reveal config changes (mirrors AsciiVideo.tsx useEffect on config.reveal)
  useEffect(() => {
    revealStateRef.current = { progress: 0 };
    revealPlaybackRef.current = {
      replayKey: revealPlaybackRef.current.replayKey + 1,
      startedAtMs: performance.now(),
    };
  }, [normalizedConfig.reveal]);

  // Load media (mirrors AsciiVideo.tsx useEffect on src/mediaKind)
  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: "loading" });
    void loadMedia(src, mediaKind).then((next) => {
      if (!cancelled) {
        // Bump reveal on new media load
        revealStateRef.current = { progress: 0 };
        revealPlaybackRef.current = {
          replayKey: revealPlaybackRef.current.replayKey + 1,
          startedAtMs: performance.now(),
        };
        setLoadState(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [src, mediaKind]);

  // Display size: from props, then from config, then from native source
  const displaySize = useMemo((): PlaygroundDisplaySize => {
    if (loadState.status !== "ready") {
      return { width: 0, height: 0 };
    }
    const configWidth = width ?? normalizedConfig.displayWidth;
    const configHeight = height ?? normalizedConfig.displayHeight;
    return resolvePlaygroundDisplaySize(loadState.native, {
      displayWidth: configWidth,
      displayHeight: configHeight,
    });
  }, [loadState, width, height, normalizedConfig.displayWidth, normalizedConfig.displayHeight]);

  // Keep a stable ref to the normalized config for use inside the getter closure
  const normalizedConfigRef = useRef(normalizedConfig);
  normalizedConfigRef.current = normalizedConfig;

  const tickers = useMemo(() => {
    if (loadState.status !== "ready" || displaySize.width <= 0 || displaySize.height <= 0) {
      return [];
    }
    const source = loadState.source;
    return [
      createStripesShaderScene({
        getConfig: () =>
          resolveStripesSceneConfig(normalizedConfigRef.current, {
            preferP3: preferP3Ref.current,
            revealPlayback: revealPlaybackRef.current,
          }),
        getSource: () => source,
        getDisplaySize: () => displaySize,
        autoplay: autoPlay,
        flamesStateRef,
        revealStateRef,
      }),
    ];
  }, [loadState, displaySize, autoPlay]);

  const sceneKey = `${src}:${mediaKind}:${displaySize.width}x${displaySize.height}`;

  const hostStyle: CSSProperties = {
    width: displaySize.width > 0 ? displaySize.width : (width ?? normalizedConfig.displayWidth ?? "100%"),
    height: displaySize.height > 0 ? displaySize.height : (height ?? normalizedConfig.displayHeight ?? "100%"),
    minHeight: displaySize.height > 0 ? undefined : 240,
    ...style,
  };

  if (loadState.status === "error") {
    return (
      <div className={className} style={hostStyle} role="alert">
        {loadState.message}
      </div>
    );
  }

  if (loadState.status === "loading" || displaySize.width <= 0 || displaySize.height <= 0) {
    return <div className={className} style={hostStyle} aria-busy="true" />;
  }

  return (
    <div className={className} style={hostStyle}>
      <Pixi
        key={sceneKey}
        layoutWidth={displaySize.width}
        layoutHeight={displaySize.height}
        onPreload={async () => {
          await preloadStripeLetterFont();
        }}
        resolveInitOptions={(canvas) => {
          const context = createStripesWebGLContext(canvas);
          preferP3Ref.current = stripesPreferDisplayP3();
          if (!context) {
            return {};
          }
          applyStripesDrawingBufferColorSpace(context);
          return { context: context as WebGL2RenderingContext };
        }}
        canvasAttrs={{
          className: "block shrink-0",
          style: { width: displaySize.width, height: displaySize.height },
        }}
        initOptions={{
          preference: "webgl",
          background: 0x000000,
          resolution: PLAYGROUND_PIXI_RESOLUTION,
        }}
        tickers={tickers}
      />
    </div>
  );
}
