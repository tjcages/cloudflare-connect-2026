import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { writeSvgToClipboard } from "../grid/clipboard";
import Pixi from "../components/pixi";
import {
  copyPlaygroundStateToClipboard,
  defaultConfigForTexture,
  getPersistedConfig,
  hydrateUploadUrls,
  loadPlaygroundEnvelope,
  mergeCatalog,
  parsePlaygroundStateInput,
  registerUpload,
  resolveCatalogEntry,
  resolveInitialTextureId,
  revokeUploadObjectUrl,
  saveLastTextureId,
  schedulePersistedConfig,
  type PlaygroundCatalogEntry,
  type PlaygroundPersistedConfig,
} from "./playgroundPersistence";
import type { PlaygroundMediaKind, PlaygroundTextureId } from "./playgroundTextures";
import { PLAYGROUND_CONTROL_RANGES } from "./playgroundControlRanges";
import { buildPlaygroundBlockGrid, sampleTextureFrame, sampleVideoFrame } from "./samplePlaygroundFrame";
import {
  playgroundSparkleOptionsFromRate,
  resolvePersistedSparkleRate,
  sparkleRateHzFromSlider,
} from "./playgroundSparkle";
import {
  DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT,
  DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED_SLIDER,
  playgroundWidthShuffleOptionsFromSliders,
  resolvePersistedSparkleWidthActivePercent,
  resolvePersistedSparkleWidthSpeed,
  sparkleWidthSpeedLabelFromSlider,
} from "./playgroundWidthShuffle";
import {
  clampPlaygroundDisplayDimension,
  createTextureSceneTicker,
  getPlaygroundTextureNativeSize,
  PLAYGROUND_PIXI_RESOLUTION,
  resolvePlaygroundDisplaySize,
  type PlaygroundDisplaySize,
  type PlaygroundSceneExportState,
  type PlaygroundTextureSource,
} from "./setupTextureShaderScene";
import {
  applyPlaygroundDrawingBufferColorSpace,
  createPlaygroundWebGLContext,
  playgroundPrefersDisplayP3,
} from "./playgroundColorSpace";
import { stripeGridToSvg } from "./stripeGridToSvg";
import { ExportReactDialog } from "./ExportReactDialog";
import { buildPlaygroundExportSnapshot } from "../lib/export/playgroundSnapshot";
import { preloadStripeLetterFont } from "./stripeLetterFont";
import {
  buildStripeColors,
  DEFAULT_STRIPE_BAND_ENABLED,
  PLAYGROUND_STRIPE_BAND_HEX,
  PLAYGROUND_STRIPE_BAND_SWATCH_P3,
  toggleStripeBandEnabled,
  type StripeBandEnabled,
  type StripeColors,
} from "./stripeColors";
import {
  DEFAULT_STRIPE_BAND_BREAKPOINTS,
  normalizeStripeBandBreakpoints,
  setStripeBandBreakpoint,
  STRIPE_BAND_BREAKPOINT_MIN_GAP,
  STRIPE_BAND_BREAKPOINT_ORDER_EPS,
  stripeBandDistanceLabel,
  type StripeBandBreakpoints,
} from "./stripeBandThresholds";
import { DEFAULT_STRIPE_DUOTONE_OPTIONS, type StripeDuotoneOptions } from "./stripeFilterOptions";

type TextureLayout = {
  width: number;
  height: number;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; kind: "video"; layout: TextureLayout; video: HTMLVideoElement; textureId: PlaygroundTextureId }
  | { status: "ready"; kind: "image"; layout: TextureLayout; image: HTMLImageElement; textureId: PlaygroundTextureId };

function loadPlaygroundVideo(url: string, textureId: PlaygroundTextureId): Promise<LoadState> {
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
        message: `Failed to load ${url || textureId}`,
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
        kind: "video",
        layout: { width, height },
        video,
        textureId,
      });
    };

    video.addEventListener("error", onError, { once: true });
    video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    video.src = url;
    video.load();
  });
}

function loadPlaygroundImage(url: string, textureId: PlaygroundTextureId): Promise<LoadState> {
  return new Promise((resolve) => {
    const image = document.createElement("img");
    image.crossOrigin = "anonymous";

    const onError = () => {
      resolve({
        status: "error",
        message: `Failed to load ${url || textureId}`,
      });
    };

    const onLoad = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (width <= 0 || height <= 0) {
        onError();
        return;
      }
      resolve({
        status: "ready",
        kind: "image",
        layout: { width, height },
        image,
        textureId,
      });
    };

    image.addEventListener("error", onError, { once: true });
    image.addEventListener("load", onLoad, { once: true });
    image.src = url;
  });
}

function loadPlaygroundSource(
  url: string,
  textureId: PlaygroundTextureId,
  mediaKind: PlaygroundMediaKind,
): Promise<LoadState> {
  return mediaKind === "image" ? loadPlaygroundImage(url, textureId) : loadPlaygroundVideo(url, textureId);
}

function disposeVideoElement(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function disposeImageElement(image: HTMLImageElement) {
  image.removeAttribute("src");
}

function applyPersistedConfig(config: PlaygroundPersistedConfig) {
  return {
    ignoreTolerance: config.ignoreTolerance,
    gamma: config.gamma,
    threshold: config.threshold,
    density: config.density,
    duotoneEnabled: config.duotoneEnabled,
    sparkleRate: resolvePersistedSparkleRate(config),
    sparkleWidthActivePercent: resolvePersistedSparkleWidthActivePercent(config),
    sparkleWidthSpeed: resolvePersistedSparkleWidthSpeed(config),
    displayWidth: config.displayWidth,
    displayHeight: config.displayHeight,
    bandBreakpoints: normalizeStripeBandBreakpoints(config.bandBreakpoints ?? DEFAULT_STRIPE_BAND_BREAKPOINTS),
  };
}

function syncDisplaySizeFromTexture(
  textureSource: PlaygroundTextureSource,
  textureId: PlaygroundTextureId,
  persistedOverride?: Pick<PlaygroundPersistedConfig, "displayWidth" | "displayHeight">,
): { display: PlaygroundDisplaySize; source: PlaygroundDisplaySize } {
  const source = getPlaygroundTextureNativeSize(textureSource);
  const persisted = persistedOverride ?? getPersistedConfig(textureId);
  const display = resolvePlaygroundDisplaySize(source, persisted);
  return { display, source };
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

export function TexturePlayground() {
  const [hydrated, setHydrated] = useState(false);
  const [catalog, setCatalog] = useState<PlaygroundCatalogEntry[]>(() => mergeCatalog([], new Map()));
  const initialId = resolveInitialTextureId();
  const initialConfig = defaultConfigForTexture(initialId);
  const appliedInitial = applyPersistedConfig(initialConfig);

  const [selectedTextureId, setSelectedTextureId] = useState<PlaygroundTextureId>(initialId);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [ignoreTolerance, setIgnoreTolerance] = useState(appliedInitial.ignoreTolerance);
  const [gamma, setGamma] = useState(appliedInitial.gamma);
  const [threshold, setThreshold] = useState(appliedInitial.threshold);
  const [density, setDensity] = useState(appliedInitial.density);
  const [duotoneEnabled, setDuotoneEnabled] = useState(appliedInitial.duotoneEnabled);
  const [sparkleRate, setSparkleRate] = useState(appliedInitial.sparkleRate);
  const [sparkleWidthActivePercent, setSparkleWidthActivePercent] = useState(
    appliedInitial.sparkleWidthActivePercent,
  );
  const [sparkleWidthSpeed, setSparkleWidthSpeed] = useState(appliedInitial.sparkleWidthSpeed);
  const [enabledBands, setEnabledBands] = useState<StripeBandEnabled>(() => [...DEFAULT_STRIPE_BAND_ENABLED]);
  const [bandBreakpoints, setBandBreakpoints] = useState<StripeBandBreakpoints>(() => appliedInitial.bandBreakpoints);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "failed">("idle");
  const [importFeedback, setImportFeedback] = useState<"idle" | "imported" | "failed">("idle");
  const [exportFeedback, setExportFeedback] = useState<"idle" | "copied" | "failed">("idle");
  const [exportReactOpen, setExportReactOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [displayWidth, setDisplayWidth] = useState(0);
  const [displayHeight, setDisplayHeight] = useState(0);
  const [sourceWidth, setSourceWidth] = useState(0);
  const [sourceHeight, setSourceHeight] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stripeOptionsRef = useRef<StripeDuotoneOptions>(DEFAULT_STRIPE_DUOTONE_OPTIONS);
  const stripeColorsRef = useRef<StripeColors>(buildStripeColors());
  const preferP3Ref = useRef(false);
  const duotoneEnabledRef = useRef(duotoneEnabled);
  const sparkleOptionsRef = useRef(playgroundSparkleOptionsFromRate(sparkleRate));
  const widthShuffleOptionsRef = useRef(
    playgroundWidthShuffleOptionsFromSliders(sparkleWidthActivePercent, sparkleWidthSpeed),
  );
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

  useEffect(() => {
    sparkleOptionsRef.current = playgroundSparkleOptionsFromRate(sparkleRate);
  }, [sparkleRate]);

  useEffect(() => {
    widthShuffleOptionsRef.current = playgroundWidthShuffleOptionsFromSliders(
      sparkleWidthActivePercent,
      sparkleWidthSpeed,
    );
  }, [sparkleWidthActivePercent, sparkleWidthSpeed]);

  const persistCurrentConfig = useCallback(() => {
    const config: PlaygroundPersistedConfig = {
      duotoneEnabled,
      sparkleRate: sparkleRate > 0 ? sparkleRate : undefined,
      sparkleWidthActivePercent:
        sparkleWidthActivePercent !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT
          ? sparkleWidthActivePercent
          : undefined,
      sparkleWidthSpeed:
        sparkleWidthSpeed !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED_SLIDER ? sparkleWidthSpeed : undefined,
      ignoreTolerance,
      gamma,
      threshold,
      density,
      displayWidth: displayWidth > 0 ? displayWidth : undefined,
      displayHeight: displayHeight > 0 ? displayHeight : undefined,
      bandBreakpoints,
    };
    schedulePersistedConfig(selectedTextureId, config);
  }, [
    selectedTextureId,
    duotoneEnabled,
    sparkleRate,
    sparkleWidthActivePercent,
    sparkleWidthSpeed,
    ignoreTolerance,
    gamma,
    threshold,
    density,
    displayWidth,
    displayHeight,
    bandBreakpoints,
  ]);

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
    saveLastTextureId(selectedTextureId);
  }, [hydrated, selectedTextureId]);

  const applyConfig = useCallback((config: PlaygroundPersistedConfig) => {
    const next = applyPersistedConfig(config);
    setIgnoreTolerance(next.ignoreTolerance);
    setGamma(next.gamma);
    setThreshold(next.threshold);
    setDensity(next.density);
    setDuotoneEnabled(next.duotoneEnabled);
    setSparkleRate(resolvePersistedSparkleRate(next));
    setSparkleWidthActivePercent(resolvePersistedSparkleWidthActivePercent(next));
    setSparkleWidthSpeed(resolvePersistedSparkleWidthSpeed(next));
    if (next.displayWidth && next.displayWidth > 0) {
      setDisplayWidth(next.displayWidth);
    }
    if (next.displayHeight && next.displayHeight > 0) {
      setDisplayHeight(next.displayHeight);
    }
    setBandBreakpoints(next.bandBreakpoints);
  }, []);

  const matchSourceDisplaySize = useCallback(() => {
    const textureSource: PlaygroundTextureSource | null = videoRef.current
      ? { kind: "video", element: videoRef.current }
      : imageRef.current
        ? { kind: "image", element: imageRef.current }
        : null;
    if (!textureSource) {
      return;
    }
    const source = getPlaygroundTextureNativeSize(textureSource);
    if (source.width <= 0 || source.height <= 0) {
      return;
    }
    setSourceWidth(source.width);
    setSourceHeight(source.height);
    setDisplayWidth(source.width);
    setDisplayHeight(source.height);
  }, []);

  const onTextureSelect = useCallback(
    (textureId: PlaygroundTextureId) => {
      applyConfig(defaultConfigForTexture(textureId));
      setSelectedTextureId(textureId);
    },
    [applyConfig],
  );

  useEffect(() => {
    stripeOptionsRef.current = {
      ignoreTolerance,
      gamma,
      threshold,
      density,
      bandBreakpoints,
    };
  }, [ignoreTolerance, gamma, threshold, density, bandBreakpoints]);

  useEffect(() => {
    stripeColorsRef.current = buildStripeColors(enabledBands);
  }, [enabledBands]);

  const toggleStripeBand = useCallback((index: number) => {
    setEnabledBands((previous) => toggleStripeBandEnabled(previous, index));
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const entry = resolveCatalogEntry(catalog, selectedTextureId);
    if (!entry?.url) {
      setLoadState({
        status: "error",
        message: "Texture not found. Upload again or pick another source.",
      });
      return;
    }

    let cancelled = false;
    setLoadState({ status: "loading" });
    autoplayRef.current = entry.mediaKind === "video";

    void loadPlaygroundSource(entry.url, selectedTextureId, entry.mediaKind).then((next) => {
      if (cancelled) {
        if (next.status === "ready") {
          if (next.kind === "video") {
            disposeVideoElement(next.video);
          } else {
            disposeImageElement(next.image);
          }
        }
        return;
      }
      videoRef.current = null;
      imageRef.current = null;
      if (next.status === "ready") {
        const textureSource: PlaygroundTextureSource =
          next.kind === "video" ? { kind: "video", element: next.video } : { kind: "image", element: next.image };
        if (next.kind === "video") {
          videoRef.current = next.video;
          setDuration(next.video.duration || 0);
          setCurrentTime(next.video.currentTime);
          setIsPlaying(!next.video.paused);
        } else {
          imageRef.current = next.image;
          setDuration(0);
          setCurrentTime(0);
          setIsPlaying(false);
        }
        const { display, source } = syncDisplaySizeFromTexture(textureSource, selectedTextureId);
        setSourceWidth(source.width);
        setSourceHeight(source.height);
        setDisplayWidth(display.width);
        setDisplayHeight(display.height);
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
      const image = imageRef.current;
      if (image) {
        disposeImageElement(image);
        imageRef.current = null;
      }
    };
  }, [hydrated, selectedTextureId, catalog]);

  useEffect(() => {
    if (loadState.status !== "ready" || loadState.kind !== "video") {
      return;
    }
    const video = loadState.video;

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

  const displaySize = useMemo(
    (): PlaygroundDisplaySize => ({ width: displayWidth, height: displayHeight }),
    [displayWidth, displayHeight],
  );

  const tickers = useMemo(() => {
    if (loadState.status !== "ready" || displayWidth <= 0 || displayHeight <= 0) {
      return [];
    }
    const textureSource: PlaygroundTextureSource =
      loadState.kind === "video"
        ? { kind: "video", element: loadState.video }
        : { kind: "image", element: loadState.image };
    return [
      createTextureSceneTicker(
        textureSource,
        displaySize,
        stripeOptionsRef,
        stripeColorsRef,
        preferP3Ref,
        duotoneEnabledRef,
        sparkleOptionsRef,
        widthShuffleOptionsRef,
        autoplayRef,
        exportStateRef,
      ),
    ];
  }, [loadState, displayWidth, displayHeight, displaySize]);

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
      const { textureId, meta } = await registerUpload(file);
      const envelope = loadPlaygroundEnvelope();
      const blobUrls = await hydrateUploadUrls(envelope.uploads);
      setCatalog(mergeCatalog(envelope.uploads, blobUrls));
      onTextureSelect(textureId);
      void meta;
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  const onCopyState = async () => {
    const config: PlaygroundPersistedConfig = {
      duotoneEnabled,
      sparkleRate: sparkleRate > 0 ? sparkleRate : undefined,
      sparkleWidthActivePercent:
        sparkleWidthActivePercent !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT
          ? sparkleWidthActivePercent
          : undefined,
      sparkleWidthSpeed:
        sparkleWidthSpeed !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED_SLIDER ? sparkleWidthSpeed : undefined,
      ignoreTolerance,
      gamma,
      threshold,
      density,
      displayWidth: displayWidth > 0 ? displayWidth : undefined,
      displayHeight: displayHeight > 0 ? displayHeight : undefined,
      bandBreakpoints,
    };
    const ok = await copyPlaygroundStateToClipboard(config);
    setCopyFeedback(ok ? "copied" : "failed");
    window.setTimeout(() => setCopyFeedback("idle"), ok ? 1200 : 1600);
  };

  const onImportState = () => {
    try {
      const config = parsePlaygroundStateInput(importText);
      applyConfig(config);
      schedulePersistedConfig(selectedTextureId, config);
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
    if (!duotoneEnabled || loadState.status !== "ready") {
      return;
    }

    const display = displaySize;
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

    if (loadState.kind === "video") {
      loadState.video.pause();
    }

    const frame =
      loadState.kind === "video"
        ? sampleVideoFrame(loadState.video, display.width, display.height, sampleCanvas, sampleCtx)
        : sampleTextureFrame(loadState.image, display.width, display.height, sampleCanvas, sampleCtx);
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

  const reactExportSnapshot = useMemo(
    () =>
      buildPlaygroundExportSnapshot({
        config: {
          duotoneEnabled,
          sparkleRate: sparkleRate > 0 ? sparkleRate : undefined,
      sparkleWidthActivePercent:
        sparkleWidthActivePercent !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT
          ? sparkleWidthActivePercent
          : undefined,
      sparkleWidthSpeed:
        sparkleWidthSpeed !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED_SLIDER ? sparkleWidthSpeed : undefined,
          ignoreTolerance,
          gamma,
          threshold,
          density,
          displayWidth: displayWidth > 0 ? displayWidth : undefined,
          displayHeight: displayHeight > 0 ? displayHeight : undefined,
          bandBreakpoints,
        },
        bandEnabled: enabledBands,
        displayWidth: displayWidth > 0 ? displayWidth : 640,
        displayHeight: displayHeight > 0 ? displayHeight : 360,
        mediaKind: loadState.status === "ready" ? loadState.kind : "video",
      }),
    [
      duotoneEnabled,
      sparkleRate,
      sparkleWidthActivePercent,
      sparkleWidthSpeed,
      ignoreTolerance,
      gamma,
      threshold,
      density,
      displayWidth,
      displayHeight,
      bandBreakpoints,
      enabledBands,
      loadState,
    ],
  );

  if (!hydrated || loadState.status === "loading") {
    return <p className="p-6 text-sm text-neutral-600">Loading texture…</p>;
  }

  if (loadState.status === "error") {
    return <p className="p-6 text-sm text-red-700">{loadState.message}</p>;
  }

  const { textureId } = loadState;
  const sceneKey = `${textureId}-${loadState.kind}-${displayWidth}x${displayHeight}`;
  const isVideoSource = loadState.kind === "video";
  const duotoneControlsDisabled = !duotoneEnabled;

  const copyLabel = copyFeedback === "copied" ? "Copied" : copyFeedback === "failed" ? "Copy failed" : "Copy state";
  const importStatus =
    importFeedback === "imported" ? "Imported" : importFeedback === "failed" ? "Import failed" : null;
  const exportLabel = exportFeedback === "copied" ? "Copied" : exportFeedback === "failed" ? "Copy failed" : "Copy SVG";

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="flex w-60 shrink-0 flex-col gap-5 border-r border-neutral-200 bg-white p-4">
        <div>
          <h1 className="text-base font-medium text-neutral-900">Texture shader playground</h1>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            {displayWidth}×{displayHeight}px canvas
            {sourceWidth > 0 && sourceHeight > 0 ? ` · source ${sourceWidth}×${sourceHeight}` : null}
          </p>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-600">Texture</span>
          <select
            value={selectedTextureId}
            onChange={(event) => onTextureSelect(event.target.value as PlaygroundTextureId)}
            className="rounded border border-neutral-300 bg-white px-2 py-1.5"
            aria-label="Playground texture source"
          >
            {catalog.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm text-neutral-600">
            <span>Width</span>
            <input
              type="number"
              min={1}
              max={8192}
              value={displayWidth > 0 ? displayWidth : ""}
              onChange={(event) => {
                const fallback = displayWidth > 0 ? displayWidth : sourceWidth || 1;
                setDisplayWidth(clampPlaygroundDisplayDimension(Number(event.target.value), fallback));
              }}
              className="rounded border border-neutral-300 bg-white px-2 py-1.5 tabular-nums"
              aria-label="Canvas width in pixels"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-600">
            <span>Height</span>
            <input
              type="number"
              min={1}
              max={8192}
              value={displayHeight > 0 ? displayHeight : ""}
              onChange={(event) => {
                const fallback = displayHeight > 0 ? displayHeight : sourceHeight || 1;
                setDisplayHeight(clampPlaygroundDisplayDimension(Number(event.target.value), fallback));
              }}
              className="rounded border border-neutral-300 bg-white px-2 py-1.5 tabular-nums"
              aria-label="Canvas height in pixels"
            />
          </label>
        </div>
        <button
          type="button"
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={matchSourceDisplaySize}
          disabled={sourceWidth <= 0 || sourceHeight <= 0}
        >
          Match source size
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          className="hidden"
          onChange={(event) => void onUploadFile(event)}
        />
        <button
          type="button"
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
          onClick={onUploadClick}
        >
          Upload texture
        </button>
        {uploadError ? <p className="m-0 text-xs text-red-700">{uploadError}</p> : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={duotoneEnabled}
            onChange={(event) => setDuotoneEnabled(event.target.checked)}
            className="size-4 cursor-pointer rounded border-neutral-300"
            aria-label="Shader enabled"
          />
          <span className="text-neutral-800">Shader enabled</span>
        </label>

          <ControlField
            label="Sparkle"
            value={sparkleRate <= 0 ? "Off" : `${sparkleRateHzFromSlider(sparkleRate).toFixed(2)} Hz`}
            disabled={duotoneControlsDisabled}
          >
            <input
              type="range"
              min={PLAYGROUND_CONTROL_RANGES.sparkleRate.min}
              max={PLAYGROUND_CONTROL_RANGES.sparkleRate.max}
              step={PLAYGROUND_CONTROL_RANGES.sparkleRate.step}
              value={sparkleRate}
              onChange={(event) => setSparkleRate(Number(event.target.value))}
              disabled={duotoneControlsDisabled}
              className="w-full disabled:cursor-not-allowed"
              aria-label="Sparkle blink frequency"
            />
          </ControlField>

        <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
          <span className="text-sm text-neutral-600">Sparkle width</span>
          <ControlField
            label="Active"
            value={sparkleWidthActivePercent <= 0 ? "Off" : `${sparkleWidthActivePercent}%`}
            disabled={duotoneControlsDisabled}
          >
            <input
              type="range"
              min={PLAYGROUND_CONTROL_RANGES.sparkleWidthActivePercent.min}
              max={PLAYGROUND_CONTROL_RANGES.sparkleWidthActivePercent.max}
              step={PLAYGROUND_CONTROL_RANGES.sparkleWidthActivePercent.step}
              value={sparkleWidthActivePercent}
              onChange={(event) => setSparkleWidthActivePercent(Number(event.target.value))}
              disabled={duotoneControlsDisabled}
              className="w-full disabled:cursor-not-allowed"
              aria-label="Sparkle width active percentage"
            />
          </ControlField>
          <ControlField
            label="Speed"
            value={
              sparkleWidthActivePercent <= 0
                ? "Off"
                : sparkleWidthSpeedLabelFromSlider(sparkleWidthSpeed)
            }
            disabled={duotoneControlsDisabled || sparkleWidthActivePercent <= 0}
          >
            <input
              type="range"
              min={PLAYGROUND_CONTROL_RANGES.sparkleWidthSpeed.min}
              max={PLAYGROUND_CONTROL_RANGES.sparkleWidthSpeed.max}
              step={PLAYGROUND_CONTROL_RANGES.sparkleWidthSpeed.step}
              value={sparkleWidthSpeed}
              onChange={(event) => setSparkleWidthSpeed(Number(event.target.value))}
              disabled={duotoneControlsDisabled || sparkleWidthActivePercent <= 0}
              className="w-full disabled:cursor-not-allowed"
              aria-label="Sparkle width pulse speed"
            />
          </ControlField>
        </div>

        <div className="flex flex-col gap-4 border-t border-neutral-200 pt-4">
          <ControlField label="Darkness" value={ignoreTolerance.toFixed(3)} disabled={duotoneControlsDisabled}>
            <input
              type="range"
              min={PLAYGROUND_CONTROL_RANGES.bgMatch.min}
              max={PLAYGROUND_CONTROL_RANGES.bgMatch.max}
              step={PLAYGROUND_CONTROL_RANGES.bgMatch.step}
              value={ignoreTolerance}
              onChange={(event) => setIgnoreTolerance(Number(event.target.value))}
              disabled={duotoneControlsDisabled}
              className="w-full disabled:cursor-not-allowed"
              aria-label="Maximum luminance treated as background"
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
              aria-label="Gamma for luminance sampling"
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

          <div className={`flex flex-col gap-3 ${duotoneControlsDisabled ? "opacity-40" : ""}`}>
            <span className="text-sm text-neutral-600">Stripe colors</span>
            {PLAYGROUND_STRIPE_BAND_HEX.map((hex, index) => {
              const p3Css = PLAYGROUND_STRIPE_BAND_SWATCH_P3[index] ?? hex;
              const rangeLabel = stripeBandDistanceLabel(bandBreakpoints, index);
              const hasUpperSlider = index < PLAYGROUND_STRIPE_BAND_HEX.length - 1;
              const orderPad = STRIPE_BAND_BREAKPOINT_MIN_GAP || STRIPE_BAND_BREAKPOINT_ORDER_EPS;
              const sliderStep = PLAYGROUND_CONTROL_RANGES.bandBreakpoint.step;
              const sliderMin =
                index === 0
                  ? PLAYGROUND_CONTROL_RANGES.bandBreakpoint.min
                  : bandBreakpoints[index - 1]! + STRIPE_BAND_BREAKPOINT_MIN_GAP;
              const sliderMax = hasUpperSlider
                ? Math.max(
                    sliderMin + sliderStep,
                    index < PLAYGROUND_STRIPE_BAND_HEX.length - 2
                      ? bandBreakpoints[index + 1]! - orderPad
                      : PLAYGROUND_CONTROL_RANGES.bandBreakpoint.max,
                  )
                : PLAYGROUND_CONTROL_RANGES.bandBreakpoint.max;

              return (
                <div key={hex} className="flex flex-col gap-1.5">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={enabledBands[index]}
                      onChange={() => toggleStripeBand(index)}
                      disabled={duotoneControlsDisabled}
                      className="size-4 shrink-0 cursor-pointer rounded border-neutral-300 disabled:cursor-not-allowed"
                      aria-label={`Show ${hex} stripes`}
                    />
                    <span
                      className="playground-stripe-swatch size-3.5 shrink-0 rounded-sm border border-neutral-200"
                      style={
                        {
                          ["--stripe-swatch-fallback" as string]: hex,
                          ["--stripe-swatch-p3" as string]: p3Css,
                        } as CSSProperties
                      }
                      aria-hidden
                    />
                    <span className="ml-auto tabular-nums text-xs text-neutral-500">{rangeLabel}</span>
                  </label>
                  {hasUpperSlider ? (
                    <input
                      type="range"
                      min={sliderMin}
                      max={sliderMax}
                      step={PLAYGROUND_CONTROL_RANGES.bandBreakpoint.step}
                      value={bandBreakpoints[index]}
                      onChange={(event) =>
                        setBandBreakpoints((previous) =>
                          setStripeBandBreakpoint(previous, index, Number(event.target.value)),
                        )
                      }
                      disabled={duotoneControlsDisabled}
                      className="w-full disabled:cursor-not-allowed"
                      aria-label={`Upper distance for ${hex} (${rangeLabel})`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
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
          layoutWidth={displayWidth}
          layoutHeight={displayHeight}
          onPreload={async () => {
            await preloadStripeLetterFont();
          }}
          canvasAttrs={{
            "data-testid": "playground-texture-canvas",
            className: "block shrink-0",
            style: { width: displayWidth, height: displayHeight },
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
          initOptions={{
            preference: "webgl",
            background: 0x000000,
            resolution: PLAYGROUND_PIXI_RESOLUTION,
          }}
          tickers={tickers}
        />

        <div className="flex w-full max-w-[640px] flex-col gap-2">
          <div className="flex items-center gap-3">
            {isVideoSource ? (
              <>
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
              </>
            ) : null}
            <div className={`flex flex-wrap items-center gap-2 ${isVideoSource ? "ml-auto" : ""}`}>
              <button
                type="button"
                className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
                onClick={() => setExportReactOpen(true)}
              >
                Export React
              </button>
              <button
                type="button"
                className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => void onExportSvg()}
                disabled={!duotoneEnabled}
              >
                {exportLabel}
              </button>
            </div>
          </div>
          {isVideoSource ? (
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={currentTime}
              onChange={(event) => onScrub(Number(event.target.value))}
              className="w-full"
              aria-label="Texture timeline"
            />
          ) : null}
        </div>
      </main>

      <ExportReactDialog
        open={exportReactOpen}
        onClose={() => setExportReactOpen(false)}
        snapshot={reactExportSnapshot}
      />
    </div>
  );
}
