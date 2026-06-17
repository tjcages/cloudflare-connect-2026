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
import { registerStripesFont } from "./registerStripesFont";
import { createPlaygroundFlamesState } from "./playgroundFlames";
import { normalizeStripesShaderConfig, type StripesShaderConfig } from "./StripesShaderConfig";
import { resolveStripesSceneConfig } from "./buildSceneConfig";
import type { PlaygroundRevealState } from "./playgroundReveal";

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
  /** Called each time the reveal animation is replayed (reveal config change or media load). For testing/observability. */
  onRevealReplay?: (replayKey: number) => void;
};

type MediaLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; source: PlaygroundTextureSource; native: PlaygroundDisplaySize };

function loadMedia(src: string, mediaKind: "video" | "image", loop: boolean, muted: boolean): Promise<MediaLoadState> {
  if (mediaKind === "video") {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.muted = muted;
      video.loop = loop;
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
  onRevealReplay,
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
      onRevealReplay={onRevealReplay}
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
  loop = true,
  muted = true,
  paused = false,
  className,
  style,
  onRevealReplay,
}: StripesShaderProps) {
  const [loadState, setLoadState] = useState<MediaLoadState>({ status: "loading" });
  // loadGeneration increments each time media finishes loading — used as the media-load signal
  // for the reveal-replay effect so it fires on actual load, not on every render.
  const [loadGeneration, setLoadGeneration] = useState(0);

  // Normalize config on each render so refs always see the current resolved values
  const normalizedConfig = normalizeStripesShaderConfig(config ?? {});

  const preferP3Ref = useRef(false);
  const flamesStateRef = useRef(createPlaygroundFlamesState());
  const revealStateRef = useRef<PlaygroundRevealState>({ progress: 0 });
  const revealPlaybackRef = useRef<PlaygroundRevealPlayback>({
    replayKey: 0,
    startedAtMs: typeof performance !== "undefined" ? performance.now() : 0,
  });

  // Stable content key for the reveal config — avoid bumping on object reference changes
  // when the reveal config CONTENT is identical (e.g. inline config={{ ... }} prop pattern).
  const revealKey = JSON.stringify(normalizedConfig.reveal ?? null);

  // Bump revealPlayback only when reveal config CONTENT changes or media (re)loads.
  // Using revealKey (serialized content) instead of the object reference prevents
  // every-render restart when the consumer passes a new inline config object each render.
  const onRevealReplayRef = useRef(onRevealReplay);
  onRevealReplayRef.current = onRevealReplay;
  useEffect(() => {
    revealStateRef.current = { progress: 0 };
    const nextKey = revealPlaybackRef.current.replayKey + 1;
    revealPlaybackRef.current = {
      replayKey: nextKey,
      startedAtMs: performance.now(),
    };
    onRevealReplayRef.current?.(nextKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealKey, loadGeneration]);

  // Load media (image or video) into a source element for the scene.
  // loop and muted are applied at load time (video element attributes set before load())
  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: "loading" });
    void loadMedia(src, mediaKind, loop, muted).then((next) => {
      if (!cancelled) {
        // Signal reveal-replay effect that media (re)loaded; the effect handles the bump.
        setLoadGeneration((g) => g + 1);
        setLoadState(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [src, mediaKind, loop, muted]);

  // paused: control video playback after load (guard play() promise rejections per browser requirements)
  useEffect(() => {
    if (loadState.status !== "ready" || loadState.source.kind !== "video") return;
    const video = loadState.source.element as HTMLVideoElement;
    if (paused) {
      video.pause();
    } else {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay may be blocked — ignore; the video will play once user interacts
        });
      }
    }
  }, [loadState, paused]);

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

  // Memoize the heavy scene-config resolution so it only runs when config CONTENT or preferP3
  // changes, not every frame. revealPlayback stays live via its ref.
  // configKey serializes config content so inline-object callers (new object, same content)
  // don't trigger a rebuild on every render.
  // preferP3 is unknown until after mount (set in resolveInitOptions); we re-resolve once it
  // becomes known by storing the result in a ref and invalidating when preferP3Ref flips.
  const configKey = JSON.stringify(config ?? {});
  const [preferP3Known, setPreferP3Known] = useState(false);
  const sceneBaseRef = useRef<ReturnType<typeof resolveStripesSceneConfig> | null>(null);
  // Keep a stable ref to the normalized config for use inside the getter closure
  const normalizedConfigRef = useRef(normalizedConfig);
  normalizedConfigRef.current = normalizedConfig;

  // Recompute base scene config when config CONTENT or preferP3 changes
  useMemo(() => {
    sceneBaseRef.current = resolveStripesSceneConfig(normalizedConfig, {
      preferP3: preferP3Ref.current,
      revealPlayback: revealPlaybackRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, preferP3Known]);

  const tickers = useMemo(() => {
    if (loadState.status !== "ready" || displaySize.width <= 0 || displaySize.height <= 0) {
      return [];
    }
    const source = loadState.source;
    return [
      createStripesShaderScene({
        // Return cached base with only the live revealPlayback overridden each frame.
        // The base is recomputed only when config/preferP3 change (useMemo above), not per-frame.
        getConfig: () => ({
          ...(sceneBaseRef.current ??
            resolveStripesSceneConfig(normalizedConfigRef.current, {
              preferP3: preferP3Ref.current,
              revealPlayback: revealPlaybackRef.current,
            })),
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
          await registerStripesFont();
        }}
        resolveInitOptions={(canvas) => {
          const context = createStripesWebGLContext(canvas);
          const p3 = stripesPreferDisplayP3();
          preferP3Ref.current = p3;
          // Trigger base scene-config recompute now that preferP3 is known
          sceneBaseRef.current = resolveStripesSceneConfig(normalizedConfigRef.current, {
            preferP3: p3,
            revealPlayback: revealPlaybackRef.current,
          });
          setPreferP3Known(true);
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
