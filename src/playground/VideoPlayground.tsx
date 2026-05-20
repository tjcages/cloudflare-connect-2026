import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Pixi from "../components/pixi";
import { DEFAULT_CONFIG } from "../grid/config";
import { useAppStore } from "../store";
import { PlaygroundVideoPreview } from "./PlaygroundVideoPreview";
import {
  createVideoShaderSceneTicker,
  getPlaygroundDisplaySize,
  PLAYGROUND_DISPLAY_SCALE,
  PLAYGROUND_PIXI_RESOLUTION,
  PLAYGROUND_STRIPE_FILTER_ENABLED,
} from "./setupVideoShaderScene";
import { buildStripeColors, type StripeColors } from "./stripeColors";
import { DEFAULT_STRIPE_DUOTONE_OPTIONS, hexToRgb01, type StripeDuotoneOptions } from "./stripeFilterOptions";

const VIDEO_URL = "/playground/545-137110823.mp4";

type VideoLayout = {
  width: number;
  height: number;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; layout: VideoLayout; video: HTMLVideoElement };

function loadPlaygroundVideo(): Promise<LoadState> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    const onError = () => {
      resolve({
        status: "error",
        message: `Failed to load ${VIDEO_URL}`,
      });
    };

    const onLoadedMetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width <= 0 || height <= 0) {
        onError();
        return;
      }
      resolve({
        status: "ready",
        layout: { width, height },
        video,
      });
    };

    video.addEventListener("error", onError, { once: true });
    video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    video.src = VIDEO_URL;
    video.load();
  });
}

export function VideoPlayground() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [ignoreColorHex, setIgnoreColorHex] = useState("#ffffff");
  const [ignoreTolerance, setIgnoreTolerance] = useState(DEFAULT_STRIPE_DUOTONE_OPTIONS.ignoreTolerance);
  const gridStrokeColor = useAppStore((state) => state.gridConfig.strokeColor);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stripeOptionsRef = useRef<StripeDuotoneOptions>(DEFAULT_STRIPE_DUOTONE_OPTIONS);
  const stripeColorsRef = useRef<StripeColors>(buildStripeColors(DEFAULT_CONFIG.strokeColor));

  useEffect(() => {
    stripeOptionsRef.current = {
      ignoreColorRgb: hexToRgb01(ignoreColorHex),
      ignoreTolerance,
    };
  }, [ignoreColorHex, ignoreTolerance]);

  useEffect(() => {
    stripeColorsRef.current = buildStripeColors(gridStrokeColor);
  }, [gridStrokeColor]);

  useEffect(() => {
    let cancelled = false;

    void loadPlaygroundVideo().then((next) => {
      if (cancelled) {
        if (next.status === "ready") {
          next.video.pause();
          next.video.removeAttribute("src");
          next.video.load();
        }
        return;
      }
      if (next.status === "ready") {
        videoRef.current = next.video;
      }
      setLoadState(next);
    });

    return () => {
      cancelled = true;
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
        videoRef.current = null;
      }
    };
  }, []);

  const tickers = useMemo(() => {
    if (loadState.status !== "ready" || !PLAYGROUND_STRIPE_FILTER_ENABLED) {
      return [];
    }
    return [createVideoShaderSceneTicker(loadState.video, stripeOptionsRef, stripeColorsRef)];
  }, [loadState]);

  const onPlayClick = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    void video.play();
  }, []);

  if (loadState.status === "loading") {
    return <p className="p-6 text-sm text-neutral-600">Loading video…</p>;
  }

  if (loadState.status === "error") {
    return <p className="p-6 text-sm text-red-700">{loadState.message}</p>;
  }

  const { layout, video } = loadState;
  const display = getPlaygroundDisplaySize(video);

  return (
    <div className="flex min-h-screen flex-col items-center gap-4 bg-neutral-50 p-6">
      <header className="max-w-3xl text-center">
        <h1 className="text-lg font-medium text-neutral-900">Video shader playground</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Canvas {display.width}×{display.height}px ({PLAYGROUND_DISPLAY_SCALE}× {layout.width}×{layout.height} video) —
          1px grid stroke, 3px solar, 5px lava.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-neutral-800">
          <button
            type="button"
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-100"
            onClick={onPlayClick}
          >
            Play video
          </button>
          <label className="flex items-center gap-2">
            <span className="text-neutral-600">Ignore bg</span>
            <input
              type="color"
              value={ignoreColorHex}
              onChange={(event) => setIgnoreColorHex(event.target.value)}
              className="h-8 w-12 cursor-pointer rounded border border-neutral-300 bg-white p-0.5"
              aria-label="Background color to ignore"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-neutral-600">Bg match</span>
            <input
              type="range"
              min={0.01}
              max={0.2}
              step={0.005}
              value={ignoreTolerance}
              onChange={(event) => setIgnoreTolerance(Number(event.target.value))}
              className="w-20"
              aria-label="Whiteness gap treated as background"
            />
            <span className="tabular-nums text-neutral-500">{ignoreTolerance.toFixed(3)}</span>
          </label>
        </div>
      </header>
      <div className="max-h-[calc(100vh-10rem)] max-w-full overflow-auto">
        {PLAYGROUND_STRIPE_FILTER_ENABLED ? (
          <Pixi
            layoutWidth={display.width}
            layoutHeight={display.height}
            canvasAttrs={{
              "data-testid": "playground-video-canvas",
              className: "block shrink-0",
              style: { width: display.width, height: display.height },
            }}
            initOptions={{
              preference: "webgl",
              background: 0x000000,
              resolution: PLAYGROUND_PIXI_RESOLUTION,
            }}
            tickers={tickers}
          />
        ) : (
          <PlaygroundVideoPreview video={video} display={display} />
        )}
      </div>
    </div>
  );
}
