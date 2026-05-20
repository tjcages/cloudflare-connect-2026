import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Pixi from "../components/pixi";
import { DEFAULT_CONFIG } from "../grid/config";
import { useAppStore } from "../store";
import {
  DEFAULT_PLAYGROUND_VIDEO_ID,
  getPlaygroundVideoOption,
  PLAYGROUND_VIDEOS,
  type PlaygroundDuotoneDefaults,
  type PlaygroundVideoId,
} from "./playgroundVideos";
import { PLAYGROUND_CONTROL_RANGES } from "./playgroundControlRanges";
import { createVideoSceneTicker, getPlaygroundDisplaySize, PLAYGROUND_PIXI_RESOLUTION } from "./setupVideoShaderScene";
import { buildStripeColors, type StripeColors } from "./stripeColors";
import { DEFAULT_STRIPE_DUOTONE_OPTIONS, hexToRgb01, type StripeDuotoneOptions } from "./stripeFilterOptions";

type VideoLayout = {
  width: number;
  height: number;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; layout: VideoLayout; video: HTMLVideoElement; videoId: PlaygroundVideoId };

function loadPlaygroundVideo(videoId: PlaygroundVideoId): Promise<LoadState> {
  const { url } = getPlaygroundVideoOption(videoId);

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
        message: `Failed to load ${url}`,
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
        videoId,
      });
    };

    video.addEventListener("error", onError, { once: true });
    video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    video.src = url;
    video.load();
  });
}

function disposeVideoElement(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function applyDuotoneDefaults(duotone: PlaygroundDuotoneDefaults) {
  return {
    ignoreColorHex: duotone.ignoreColorHex,
    ignoreTolerance: duotone.ignoreTolerance,
    gamma: duotone.gamma,
    threshold: duotone.threshold,
    density: duotone.density,
  };
}

type ControlFieldProps = {
  label: string;
  value: string;
  disabled?: boolean;
  children: ReactNode;
};

function ControlField({ label, value, disabled = false, children }: ControlFieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${disabled ? "opacity-40" : ""}`}>
      <span className="flex items-center justify-between gap-2 text-neutral-600">
        <span>{label}</span>
        <span className="tabular-nums text-xs text-neutral-500">{value}</span>
      </span>
      {children}
    </label>
  );
}

export function VideoPlayground() {
  const defaultVideo = getPlaygroundVideoOption(DEFAULT_PLAYGROUND_VIDEO_ID);
  const initialDuotone = applyDuotoneDefaults(defaultVideo.duotone);
  const [selectedVideoId, setSelectedVideoId] = useState<PlaygroundVideoId>(DEFAULT_PLAYGROUND_VIDEO_ID);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [ignoreColorHex, setIgnoreColorHex] = useState(initialDuotone.ignoreColorHex);
  const [ignoreTolerance, setIgnoreTolerance] = useState(initialDuotone.ignoreTolerance);
  const [gamma, setGamma] = useState(initialDuotone.gamma);
  const [threshold, setThreshold] = useState(initialDuotone.threshold);
  const [density, setDensity] = useState(initialDuotone.density);
  const [duotoneEnabled, setDuotoneEnabled] = useState(true);
  const gridStrokeColor = useAppStore((state) => state.gridConfig.strokeColor);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stripeOptionsRef = useRef<StripeDuotoneOptions>(DEFAULT_STRIPE_DUOTONE_OPTIONS);
  const stripeColorsRef = useRef<StripeColors>(buildStripeColors(DEFAULT_CONFIG.strokeColor));
  const duotoneEnabledRef = useRef(duotoneEnabled);

  useEffect(() => {
    duotoneEnabledRef.current = duotoneEnabled;
  }, [duotoneEnabled]);

  const onVideoSelect = useCallback((videoId: PlaygroundVideoId) => {
    const { duotone } = getPlaygroundVideoOption(videoId);
    const next = applyDuotoneDefaults(duotone);
    setSelectedVideoId(videoId);
    setIgnoreColorHex(next.ignoreColorHex);
    setIgnoreTolerance(next.ignoreTolerance);
    setGamma(next.gamma);
    setThreshold(next.threshold);
    setDensity(next.density);
  }, []);

  useEffect(() => {
    stripeOptionsRef.current = {
      ignoreColorRgb: hexToRgb01(ignoreColorHex),
      ignoreTolerance,
      gamma,
      threshold,
      density,
    };
  }, [ignoreColorHex, ignoreTolerance, gamma, threshold, density]);

  useEffect(() => {
    stripeColorsRef.current = buildStripeColors(gridStrokeColor);
  }, [gridStrokeColor]);

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: "loading" });

    void loadPlaygroundVideo(selectedVideoId).then((next) => {
      if (cancelled) {
        if (next.status === "ready") {
          disposeVideoElement(next.video);
        }
        return;
      }
      if (next.status === "ready") {
        videoRef.current = next.video;
      } else {
        videoRef.current = null;
      }
      setLoadState(next);
    });

    return () => {
      cancelled = true;
      const video = videoRef.current;
      if (video) {
        disposeVideoElement(video);
        videoRef.current = null;
      }
    };
  }, [selectedVideoId]);

  const tickers = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }
    return [
      createVideoSceneTicker(loadState.video, loadState.videoId, stripeOptionsRef, stripeColorsRef, duotoneEnabledRef),
    ];
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

  const { video, videoId } = loadState;
  const videoOption = getPlaygroundVideoOption(videoId);
  const display = getPlaygroundDisplaySize(video, videoOption.displayScale);
  const sceneKey = `${videoId}-${display.width}x${display.height}`;
  const duotoneControlsDisabled = !duotoneEnabled;

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="flex w-60 shrink-0 flex-col gap-5 border-r border-neutral-200 bg-white p-4">
        <div>
          <h1 className="text-base font-medium text-neutral-900">Video shader playground</h1>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            {display.width}×{display.height}px canvas · {videoOption.displayScale}× source
          </p>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-600">Video</span>
          <select
            value={selectedVideoId}
            onChange={(event) => onVideoSelect(event.target.value as PlaygroundVideoId)}
            className="rounded border border-neutral-300 bg-white px-2 py-1.5"
            aria-label="Playground sample video"
          >
            {PLAYGROUND_VIDEOS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
          onClick={onPlayClick}
        >
          Play video
        </button>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={duotoneEnabled}
            onChange={(event) => setDuotoneEnabled(event.target.checked)}
            className="size-4 cursor-pointer rounded border-neutral-300"
            aria-label="Stripe duotone effect"
          />
          <span className="text-neutral-800">Duotone</span>
        </label>

        <div className="flex flex-col gap-4 border-t border-neutral-200 pt-4">
          <ControlField label="Ignore bg" value={ignoreColorHex} disabled={duotoneControlsDisabled}>
            <input
              type="color"
              value={ignoreColorHex}
              onChange={(event) => setIgnoreColorHex(event.target.value)}
              disabled={duotoneControlsDisabled}
              className="h-9 w-full max-w-[4.5rem] cursor-pointer rounded border border-neutral-300 bg-white p-0.5 disabled:cursor-not-allowed"
              aria-label="Background color to ignore"
            />
          </ControlField>

          <ControlField label="Bg match" value={ignoreTolerance.toFixed(3)} disabled={duotoneControlsDisabled}>
            <input
              type="range"
              min={PLAYGROUND_CONTROL_RANGES.bgMatch.min}
              max={PLAYGROUND_CONTROL_RANGES.bgMatch.max}
              step={PLAYGROUND_CONTROL_RANGES.bgMatch.step}
              value={ignoreTolerance}
              onChange={(event) => setIgnoreTolerance(Number(event.target.value))}
              disabled={duotoneControlsDisabled}
              className="w-full disabled:cursor-not-allowed"
              aria-label="Background color match tolerance"
            />
          </ControlField>

          <ControlField label="Gamma" value={gamma.toFixed(2)} disabled={duotoneControlsDisabled}>
            <input
              type="range"
              min={PLAYGROUND_CONTROL_RANGES.gamma.min}
              max={PLAYGROUND_CONTROL_RANGES.gamma.max}
              step={PLAYGROUND_CONTROL_RANGES.gamma.step}
              value={gamma}
              onChange={(event) => setGamma(Number(event.target.value))}
              disabled={duotoneControlsDisabled}
              className="w-full disabled:cursor-not-allowed"
              aria-label="Gamma for background matching"
            />
          </ControlField>

          <ControlField label="Threshold" value={threshold.toFixed(2)} disabled={duotoneControlsDisabled}>
            <input
              type="range"
              min={PLAYGROUND_CONTROL_RANGES.threshold.min}
              max={PLAYGROUND_CONTROL_RANGES.threshold.max}
              step={PLAYGROUND_CONTROL_RANGES.threshold.step}
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              disabled={duotoneControlsDisabled}
              className="w-full disabled:cursor-not-allowed"
              aria-label="Block background threshold"
            />
          </ControlField>

          <ControlField label="Density" value={density.toFixed(2)} disabled={duotoneControlsDisabled}>
            <input
              type="range"
              min={PLAYGROUND_CONTROL_RANGES.density.min}
              max={PLAYGROUND_CONTROL_RANGES.density.max}
              step={PLAYGROUND_CONTROL_RANGES.density.step}
              value={density}
              onChange={(event) => setDensity(Number(event.target.value))}
              disabled={duotoneControlsDisabled}
              className="w-full disabled:cursor-not-allowed"
              aria-label="Stripe density"
            />
          </ControlField>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 items-start justify-center overflow-auto p-6">
        <Pixi
          key={sceneKey}
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
      </main>
    </div>
  );
}
