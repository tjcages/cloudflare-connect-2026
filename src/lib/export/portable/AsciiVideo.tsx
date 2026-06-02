import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Pixi from "./pixi";
import {
  applyPlaygroundDrawingBufferColorSpace,
  createPlaygroundWebGLContext,
  playgroundPrefersDisplayP3,
} from "./playgroundColorSpace";
import { preloadStripeLetterFont } from "./runtime/stripeLetterFont";
import type { StripeDuotoneOptions } from "./runtime/stripeFilterOptions";
import {
  createTextureSceneTicker,
  getPlaygroundTextureNativeSize,
  PLAYGROUND_PIXI_RESOLUTION,
  resolvePlaygroundDisplaySize,
  type PlaygroundDisplaySize,
  type PlaygroundTextureSource,
} from "./scene";
import { playgroundSparkleOptionsFromRate } from "./runtime/playgroundSparkle";
import {
  configToStripeBandColors,
  configToStripeOptions,
  defaultConfig,
  type AsciiVideoProps,
  type StripeBandColors,
} from "./types";

export type { AsciiVideoConfig, AsciiVideoProps } from "./types";
export { defaultConfig } from "./types";

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

export function AsciiVideo({
  src,
  mediaKind = "video",
  config = defaultConfig,
  className,
  style,
  autoplay = true,
}: AsciiVideoProps) {
  const [loadState, setLoadState] = useState<MediaLoadState>({ status: "loading" });
  const configRef = useRef(config);
  configRef.current = config;

  const stripeOptionsRef = useRef<StripeDuotoneOptions>(configToStripeOptions(config));
  const stripeColorsRef = useRef<StripeBandColors>(configToStripeBandColors(config));
  const duotoneEnabledRef = useRef(config.duotoneEnabled);
  const sparkleOptionsRef = useRef(playgroundSparkleOptionsFromRate(config.sparkleRate ?? 0));
  const autoplayRef = useRef(autoplay);
  const preferP3Ref = useRef(false);

  stripeOptionsRef.current = configToStripeOptions(config);
  stripeColorsRef.current = configToStripeBandColors(config);
  duotoneEnabledRef.current = config.duotoneEnabled;
  sparkleOptionsRef.current = playgroundSparkleOptionsFromRate(config.sparkleRate ?? 0);
  autoplayRef.current = autoplay;

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: "loading" });
    void loadMedia(src, mediaKind).then((next) => {
      if (!cancelled) {
        setLoadState(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [src, mediaKind]);

  const displaySize = useMemo((): PlaygroundDisplaySize => {
    if (loadState.status !== "ready") {
      return { width: 0, height: 0 };
    }
    return resolvePlaygroundDisplaySize(loadState.native, {
      displayWidth: config.displayWidth,
      displayHeight: config.displayHeight,
    });
  }, [loadState, config.displayWidth, config.displayHeight]);

  const tickers = useMemo(() => {
    if (loadState.status !== "ready" || displaySize.width <= 0 || displaySize.height <= 0) {
      return [];
    }
    return [
      createTextureSceneTicker(
        loadState.source,
        displaySize,
        stripeOptionsRef,
        stripeColorsRef,
        preferP3Ref,
        duotoneEnabledRef,
        sparkleOptionsRef,
        autoplayRef,
      ),
    ];
  }, [loadState, displaySize]);

  const sceneKey = `${src}:${mediaKind}:${displaySize.width}x${displaySize.height}`;

  const hostStyle: CSSProperties = {
    width: displaySize.width > 0 ? displaySize.width : (config.displayWidth ?? "100%"),
    height: displaySize.height > 0 ? displaySize.height : (config.displayHeight ?? "100%"),
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
          const context = createPlaygroundWebGLContext(canvas);
          preferP3Ref.current = playgroundPrefersDisplayP3(canvas, context);
          if (!context) {
            return {};
          }
          applyPlaygroundDrawingBufferColorSpace(context);
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
