import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { writeSvgToClipboard } from "../grid/clipboard";
import Pixi from "../components/pixi";
import { DEFAULT_CONFIG } from "../grid/config";
import { useAppStore } from "../store";
import {
  copyPlaygroundStateToClipboard,
  defaultConfigForVideo,
  hydrateUploadUrls,
  loadPlaygroundEnvelope,
  mergeCatalog,
  parsePlaygroundStateInput,
  registerUpload,
  resolveCatalogEntry,
  resolveInitialVideoId,
  revokeUploadObjectUrl,
  saveLastVideoId,
  schedulePersistedConfig,
  type PlaygroundCatalogEntry,
  type PlaygroundPersistedConfig,
} from "./playgroundPersistence";
import type { PlaygroundVideoId } from "./playgroundVideos";
import { PLAYGROUND_CONTROL_RANGES } from "./playgroundControlRanges";
import { buildPlaygroundBlockGrid, sampleVideoFrame } from "./samplePlaygroundFrame";
import {
  createVideoSceneTicker,
  getPlaygroundDisplaySize,
  PLAYGROUND_PIXI_RESOLUTION,
  type PlaygroundSceneExportState,
} from "./setupVideoShaderScene";
import { stripeGridToSvg } from "./stripeGridToSvg";
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

function loadPlaygroundVideo(url: string, videoId: PlaygroundVideoId): Promise<LoadState> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.loop = false;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    const onError = () => {
      resolve({
        status: "error",
        message: `Failed to load ${url || videoId}`,
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

function applyPersistedConfig(config: PlaygroundPersistedConfig) {
  return {
    ignoreColorHex: config.ignoreColorHex,
    ignoreTolerance: config.ignoreTolerance,
    gamma: config.gamma,
    threshold: config.threshold,
    density: config.density,
    duotoneEnabled: config.duotoneEnabled,
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

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VideoPlayground() {
  const [hydrated, setHydrated] = useState(false);
  const [catalog, setCatalog] = useState<PlaygroundCatalogEntry[]>(() => mergeCatalog([], new Map()));
  const initialId = resolveInitialVideoId();
  const initialConfig = defaultConfigForVideo(initialId);
  const appliedInitial = applyPersistedConfig(initialConfig);

  const [selectedVideoId, setSelectedVideoId] = useState<PlaygroundVideoId>(initialId);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [ignoreColorHex, setIgnoreColorHex] = useState(appliedInitial.ignoreColorHex);
  const [ignoreTolerance, setIgnoreTolerance] = useState(appliedInitial.ignoreTolerance);
  const [gamma, setGamma] = useState(appliedInitial.gamma);
  const [threshold, setThreshold] = useState(appliedInitial.threshold);
  const [density, setDensity] = useState(appliedInitial.density);
  const [duotoneEnabled, setDuotoneEnabled] = useState(appliedInitial.duotoneEnabled);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "failed">("idle");
  const [importFeedback, setImportFeedback] = useState<"idle" | "imported" | "failed">("idle");
  const [exportFeedback, setExportFeedback] = useState<"idle" | "copied" | "failed">("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const gridStrokeColor = useAppStore((state) => state.gridConfig.strokeColor);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stripeOptionsRef = useRef<StripeDuotoneOptions>(DEFAULT_STRIPE_DUOTONE_OPTIONS);
  const stripeColorsRef = useRef<StripeColors>(buildStripeColors(DEFAULT_CONFIG.strokeColor));
  const duotoneEnabledRef = useRef(duotoneEnabled);
  const autoplayRef = useRef(true);
  const exportStateRef = useRef<PlaygroundSceneExportState | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const envelope = loadPlaygroundEnvelope();
      const blobUrls = await hydrateUploadUrls(envelope.uploads);
      if (cancelled) {
        return;
      }
      setCatalog(mergeCatalog(envelope.uploads, blobUrls));
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    duotoneEnabledRef.current = duotoneEnabled;
  }, [duotoneEnabled]);

  const persistCurrentConfig = useCallback(() => {
    const config: PlaygroundPersistedConfig = {
      duotoneEnabled,
      ignoreColorHex,
      ignoreTolerance,
      gamma,
      threshold,
      density,
    };
    schedulePersistedConfig(selectedVideoId, config);
  }, [selectedVideoId, duotoneEnabled, ignoreColorHex, ignoreTolerance, gamma, threshold, density]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    persistCurrentConfig();
  }, [hydrated, persistCurrentConfig]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    saveLastVideoId(selectedVideoId);
  }, [hydrated, selectedVideoId]);

  const applyConfig = useCallback((config: PlaygroundPersistedConfig) => {
    const next = applyPersistedConfig(config);
    setIgnoreColorHex(next.ignoreColorHex);
    setIgnoreTolerance(next.ignoreTolerance);
    setGamma(next.gamma);
    setThreshold(next.threshold);
    setDensity(next.density);
    setDuotoneEnabled(next.duotoneEnabled);
  }, []);

  const onVideoSelect = useCallback(
    (videoId: PlaygroundVideoId) => {
      applyConfig(defaultConfigForVideo(videoId));
      setSelectedVideoId(videoId);
    },
    [applyConfig],
  );

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
    if (!hydrated) {
      return;
    }

    const entry = resolveCatalogEntry(catalog, selectedVideoId);
    if (!entry?.url) {
      setLoadState({
        status: "error",
        message: "Video not found. Upload again or pick another clip.",
      });
      return;
    }

    let cancelled = false;
    setLoadState({ status: "loading" });
    autoplayRef.current = true;

    void loadPlaygroundVideo(entry.url, selectedVideoId).then((next) => {
      if (cancelled) {
        if (next.status === "ready") {
          disposeVideoElement(next.video);
        }
        return;
      }
      if (next.status === "ready") {
        videoRef.current = next.video;
        setDuration(next.video.duration || 0);
        setCurrentTime(next.video.currentTime);
        setIsPlaying(!next.video.paused);
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
  }, [hydrated, selectedVideoId, catalog]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [loadState]);

  const catalogEntry = resolveCatalogEntry(catalog, selectedVideoId);
  const displayScale = catalogEntry?.displayScale ?? 1;

  const tickers = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }
    return [
      createVideoSceneTicker(
        loadState.video,
        displayScale,
        stripeOptionsRef,
        stripeColorsRef,
        duotoneEnabledRef,
        autoplayRef,
        exportStateRef,
      ),
    ];
  }, [loadState, displayScale]);

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setUploadError(null);
    try {
      const { videoId, meta } = await registerUpload(file);
      const envelope = loadPlaygroundEnvelope();
      const blobUrls = await hydrateUploadUrls(envelope.uploads);
      setCatalog(mergeCatalog(envelope.uploads, blobUrls));
      onVideoSelect(videoId);
      void meta;
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  const onCopyState = async () => {
    const config: PlaygroundPersistedConfig = {
      duotoneEnabled,
      ignoreColorHex,
      ignoreTolerance,
      gamma,
      threshold,
      density,
    };
    const ok = await copyPlaygroundStateToClipboard(config);
    setCopyFeedback(ok ? "copied" : "failed");
    window.setTimeout(() => setCopyFeedback("idle"), ok ? 1200 : 1600);
  };

  const onImportState = () => {
    try {
      const config = parsePlaygroundStateInput(importText);
      applyConfig(config);
      schedulePersistedConfig(selectedVideoId, config);
      setImportText("");
      setImportFeedback("imported");
      window.setTimeout(() => setImportFeedback("idle"), 1200);
    } catch {
      setImportFeedback("failed");
      window.setTimeout(() => setImportFeedback("idle"), 1600);
    }
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      autoplayRef.current = true;
      void video.play();
    } else {
      video.pause();
    }
  };

  const onScrub = (value: number) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.currentTime = value;
    setCurrentTime(value);
  };

  const onExportSvg = async () => {
    const video = videoRef.current;
    if (!video || !duotoneEnabled) {
      return;
    }
    video.pause();

    const entry = resolveCatalogEntry(catalog, selectedVideoId);
    const scale = entry?.displayScale ?? 1;
    const display = getPlaygroundDisplaySize(video, scale);
    if (display.width <= 0 || display.height <= 0) {
      setExportFeedback("failed");
      window.setTimeout(() => setExportFeedback("idle"), 1600);
      return;
    }

    if (!sampleCanvasRef.current) {
      sampleCanvasRef.current = document.createElement("canvas");
      sampleCtxRef.current = sampleCanvasRef.current.getContext("2d", { willReadFrequently: true });
    }
    const sampleCanvas = sampleCanvasRef.current;
    const sampleCtx = sampleCtxRef.current;
    if (!sampleCtx) {
      setExportFeedback("failed");
      window.setTimeout(() => setExportFeedback("idle"), 1600);
      return;
    }

    const frame = sampleVideoFrame(video, display.width, display.height, sampleCanvas, sampleCtx);
    if (!frame) {
      setExportFeedback("failed");
      window.setTimeout(() => setExportFeedback("idle"), 1600);
      return;
    }

    const options = stripeOptionsRef.current;
    const colors = stripeColorsRef.current;
    const built = buildPlaygroundBlockGrid(frame, display.width, display.height, options, {});
    const svg = stripeGridToSvg(built.grid, colors, display.width, display.height);

    try {
      await writeSvgToClipboard(svg);
      setExportFeedback("copied");
    } catch {
      setExportFeedback("failed");
    }
    window.setTimeout(() => setExportFeedback("idle"), 1600);
  };

  useEffect(() => {
    return () => {
      for (const entry of catalog) {
        if (entry.isUpload) {
          revokeUploadObjectUrl(entry.id);
        }
      }
    };
  }, [catalog]);

  if (!hydrated || loadState.status === "loading") {
    return <p className="p-6 text-sm text-neutral-600">Loading video…</p>;
  }

  if (loadState.status === "error") {
    return <p className="p-6 text-sm text-red-700">{loadState.message}</p>;
  }

  const { video, videoId } = loadState;
  const display = getPlaygroundDisplaySize(video, displayScale);
  const sceneKey = `${videoId}-${display.width}x${display.height}`;
  const duotoneControlsDisabled = !duotoneEnabled;

  const copyLabel = copyFeedback === "copied" ? "Copied" : copyFeedback === "failed" ? "Copy failed" : "Copy state";
  const importStatus =
    importFeedback === "imported" ? "Imported" : importFeedback === "failed" ? "Import failed" : null;
  const exportLabel = exportFeedback === "copied" ? "Copied" : exportFeedback === "failed" ? "Copy failed" : "Copy SVG";

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="flex w-60 shrink-0 flex-col gap-5 border-r border-neutral-200 bg-white p-4">
        <div>
          <h1 className="text-base font-medium text-neutral-900">Video shader playground</h1>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            {display.width}×{display.height}px canvas · {displayScale}× source
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
            {catalog.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(event) => void onUploadFile(event)}
        />
        <button
          type="button"
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
          onClick={onUploadClick}
        >
          Upload video
        </button>
        {uploadError ? <p className="m-0 text-xs text-red-700">{uploadError}</p> : null}

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

        <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
          <button
            type="button"
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
            onClick={() => void onCopyState()}
          >
            {copyLabel}
          </button>
          <textarea
            className="min-h-[72px] resize-y rounded border border-neutral-300 px-2 py-1.5 font-mono text-[11px]"
            rows={4}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            spellCheck={false}
            placeholder="Paste state JSON"
          />
          <button
            type="button"
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
            onClick={onImportState}
          >
            Import state
          </button>
          {importStatus ? <p className="m-0 text-xs text-neutral-500">{importStatus}</p> : null}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col items-center gap-4 overflow-auto p-6">
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

        <div className="flex w-full max-w-[640px] flex-col gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
              onClick={togglePlayPause}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <span className="tabular-nums text-xs text-neutral-500">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <button
              type="button"
              className="ml-auto rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => void onExportSvg()}
              disabled={!duotoneEnabled}
            >
              {exportLabel}
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={currentTime}
            onChange={(event) => onScrub(Number(event.target.value))}
            className="w-full"
            aria-label="Video timeline"
          />
        </div>
      </main>
    </div>
  );
}
