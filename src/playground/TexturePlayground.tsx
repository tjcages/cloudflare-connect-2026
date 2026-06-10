import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { writeSvgToClipboard } from "../grid/clipboard";
import { Button } from "../components/Button";
import Pixi from "../components/pixi";
import {
  catalogEntriesForLoadAttempt,
  copyPlaygroundStateToClipboard,
  defaultConfigForTexture,
  firstCatalogEntryWithUrl,
  getPersistedConfig,
  hydrateUploadUrls,
  loadPlaygroundEnvelope,
  mergeCatalog,
  parsePlaygroundStateInput,
  registerUpload,
  normalizePlaygroundBackgroundCss,
  normalizePlaygroundBackgroundColor,
  resolvePersistedGridConfig,
  resolvePersistedFlamesConfig,
  resolvePersistedRevealConfig,
  resolvePersistedCursorTrailConfig,
  resolvePersistedClickWaveConfig,
  resolvePersistedSourceTransform,
  resolvePersistedTextureAdjustments,
  resolvePersistedTextureLuminanceSettings,
  resolvePersistedOverlayStripes,
  resolveInitialTextureId,
  revokeUploadObjectUrl,
  saveLastTextureId,
  schedulePersistedConfig,
  type PlaygroundCatalogEntry,
  type PlaygroundPersistedConfig,
} from "./playgroundPersistence";
import {
  formatTextureLoadErrorMessage,
  type PlaygroundMediaKind,
  type PlaygroundTextureId,
} from "./playgroundTextures";
import { buildPlaygroundBlockGrid, sampleTextureFrame, sampleVideoFrame } from "./samplePlaygroundFrame";
import { PLAYGROUND_SCRUB_COMMIT_MS, useThrottledCallback } from "./playgroundLiveRefs";
import {
  DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED,
  playgroundSparkleOptionsFromSliders,
  resolvePersistedSparkleGapsActivePercent,
  resolvePersistedSparkleGapsSpeed,
} from "./playgroundSparkle";
import {
  DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT,
  DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED,
  playgroundWidthShuffleOptionsFromSliders,
  resolvePersistedSparkleWidthActivePercent,
  resolvePersistedSparkleWidthSpeed,
} from "./playgroundWidthShuffle";
import { createPlaygroundFlamesState } from "./playgroundFlames";
import {
  clampPlaygroundDisplayDimension,
  createTextureSceneTicker,
  getPlaygroundTextureNativeSize,
  PLAYGROUND_PIXI_RESOLUTION,
  resolvePlaygroundDisplaySize,
  type PlaygroundDisplaySize,
  type PlaygroundRevealPlayback,
  type PlaygroundSceneExportState,
  type PlaygroundTextureSource,
} from "./setupTextureShaderScene";
import {
  configurePlaygroundCanvasAfterPixiInit,
  configurePlaygroundGlColorSpace,
  createPlaygroundWebGLContext,
  playgroundPrefersDisplayP3,
} from "./playgroundColorSpace";
import { stripeGridToSvg } from "./stripeGridToSvg";
import { ExportReactDialog } from "./ExportReactDialog";
import { PlaygroundLevaControls, type PlaygroundLevaControlsProps } from "./playgroundLevaControls";
import { buildPlaygroundExportSnapshot } from "../lib/export/playgroundSnapshot";
import {
  exportPlaygroundVideo,
  formatVideoExportStatusLabel,
  resolveExportDuration,
  shouldConfirmLongExport,
  type PlaygroundVideoExportPhase,
} from "./playgroundVideoExport";
import {
  DEFAULT_PLAYGROUND_GRID_CONFIG,
  isDefaultPlaygroundGridConfig,
  normalizePlaygroundGridConfig,
  type PlaygroundGridConfig,
} from "./playgroundGridConfig";
import {
  DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
  isDefaultPlaygroundSourceTransform,
  normalizePlaygroundSourceTransform,
  type PlaygroundSourceTransform,
} from "./playgroundSourceTransform";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  isDefaultPlaygroundTextureAdjustments,
  normalizePlaygroundTextureAdjustments,
  type PlaygroundTextureAdjustments,
} from "./playgroundTextureAdjustments";
import {
  DEFAULT_PLAYGROUND_FLAMES_CONFIG,
  isDefaultPlaygroundFlamesConfig,
  normalizePlaygroundFlamesConfig,
  type PlaygroundFlamesConfig,
} from "./playgroundFlamesConfig";
import {
  DEFAULT_PLAYGROUND_REVEAL_CONFIG,
  isDefaultPlaygroundRevealConfig,
  normalizePlaygroundRevealConfig,
  type PlaygroundRandomColumnsRevealConfig,
  type PlaygroundRevealConfig,
  type PlaygroundWaveRevealConfig,
} from "./playgroundRevealConfig";
import {
  DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  isDefaultPlaygroundCursorTrailConfig,
  normalizePlaygroundCursorTrailConfig,
  type PlaygroundCursorTrailConfig,
} from "./playgroundCursorTrailConfig";
import {
  DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
  isDefaultPlaygroundClickWaveConfig,
  normalizePlaygroundClickWaveConfig,
  type PlaygroundClickWaveConfig,
} from "./playgroundClickWaveConfig";
import type { PlaygroundRevealState } from "./playgroundReveal";
import { preloadStripeLetterFont } from "./stripeLetterFont";
import {
  applyColorsModeStripeDefaults,
  cloneDefaultOverlayStripes,
  cloneDefaultStripes,
  DEFAULT_STRIPES,
  overlayStripesMatchDefault,
  resolveActivePlaygroundStripes,
  stripeColorFromHexPicker,
  updateStripe,
  type Stripe,
  type StripeColors,
} from "./stripeColors";
import { applyCanvasBackgroundCss, DEFAULT_PLAYGROUND_BACKGROUND_COLOR } from "./canvasBackgroundCss";
import {
  DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
  DEFAULT_TEXTURE_LUMINANCE_MODE,
  normalizeTextureLuminanceBackgroundColor,
  normalizeTextureLuminanceMode,
  type TextureLuminanceSettings,
} from "./colorWhiteness";
import { shouldToggleStripesFromShortcut } from "./playgroundShortcuts";
import { PLAYGROUND_BUTTON_ROW_CLASS, PLAYGROUND_SHELL_CLASS } from "./playgroundUi";

/** True when the stripe list differs from DEFAULT_STRIPES (ignoring ids). */
function stripesMatchDefault(stripes: readonly Stripe[]): boolean {
  if (stripes.length !== DEFAULT_STRIPES.length) {
    return false;
  }
  return stripes.every((stripe, index) => {
    const base = DEFAULT_STRIPES[index]!;
    return (
      stripe.hex.toLowerCase() === base.hex.toLowerCase() &&
      stripe.startFrom === base.startFrom &&
      stripe.width === base.width
    );
  });
}

type TextureLayout = {
  width: number;
  height: number;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; kind: "video"; layout: TextureLayout; video: HTMLVideoElement; textureId: PlaygroundTextureId }
  | { status: "ready"; kind: "image"; layout: TextureLayout; image: HTMLImageElement; textureId: PlaygroundTextureId };

function loadPlaygroundVideo(url: string, textureId: PlaygroundTextureId, label: string): Promise<LoadState> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    const fail = (reason: Parameters<typeof formatTextureLoadErrorMessage>[0]["reason"]) => {
      resolve({
        status: "error",
        message: formatTextureLoadErrorMessage({ label, mediaKind: "video", reason }),
      });
    };

    const onError = () => {
      fail(url.length === 0 ? "missing" : "decode");
    };

    const onLoadedMetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width <= 0 || height <= 0) {
        fail("dimensions");
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

function loadPlaygroundImage(url: string, textureId: PlaygroundTextureId, label: string): Promise<LoadState> {
  return new Promise((resolve) => {
    const image = document.createElement("img");
    image.crossOrigin = "anonymous";

    const fail = (reason: Parameters<typeof formatTextureLoadErrorMessage>[0]["reason"]) => {
      resolve({
        status: "error",
        message: formatTextureLoadErrorMessage({ label, mediaKind: "image", reason }),
      });
    };

    const onError = () => {
      fail(url.length === 0 ? "missing" : "decode");
    };

    const onLoad = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (width <= 0 || height <= 0) {
        fail("dimensions");
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
  label: string,
): Promise<LoadState> {
  return mediaKind === "image"
    ? loadPlaygroundImage(url, textureId, label)
    : loadPlaygroundVideo(url, textureId, label);
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
    duotoneEnabled: config.duotoneEnabled,
    stripesEnabled: config.stripesEnabled !== false,
    backgroundCss: normalizePlaygroundBackgroundCss(config.backgroundCss),
    backgroundColor: normalizePlaygroundBackgroundColor(config.backgroundColor),
    textureAdjustments: resolvePersistedTextureAdjustments(config),
    textureLuminanceSettings: resolvePersistedTextureLuminanceSettings(config),
    sourceTransform: resolvePersistedSourceTransform(config),
    sparkleGapsActivePercent: resolvePersistedSparkleGapsActivePercent(config),
    sparkleGapsSpeed: resolvePersistedSparkleGapsSpeed(config),
    sparkleWidthActivePercent: resolvePersistedSparkleWidthActivePercent(config),
    sparkleWidthSpeed: resolvePersistedSparkleWidthSpeed(config),
    displayWidth: config.displayWidth,
    displayHeight: config.displayHeight,
    grid: resolvePersistedGridConfig(config),
    flames: resolvePersistedFlamesConfig(config),
    reveal: resolvePersistedRevealConfig(config),
    cursorTrail: resolvePersistedCursorTrailConfig(config),
    clickWave: resolvePersistedClickWaveConfig(config),
    stripes: config.stripes.map((stripe) => ({ ...stripe })),
    overlayStripes: resolvePersistedOverlayStripes(config).map((stripe) => ({ ...stripe })),
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
  const [duotoneEnabled, setDuotoneEnabled] = useState(appliedInitial.duotoneEnabled);
  const [stripesEnabled, setStripesEnabled] = useState(appliedInitial.stripesEnabled);
  const [backgroundCss, setBackgroundCss] = useState(appliedInitial.backgroundCss ?? "");
  const [backgroundColor, setBackgroundColor] = useState(appliedInitial.backgroundColor);
  const [textureAdjustments, setTextureAdjustments] = useState<PlaygroundTextureAdjustments>(
    appliedInitial.textureAdjustments,
  );
  const [textureLuminanceSettings, setTextureLuminanceSettings] = useState<TextureLuminanceSettings>(
    appliedInitial.textureLuminanceSettings,
  );
  const [sourceTransform, setSourceTransform] = useState<PlaygroundSourceTransform>(appliedInitial.sourceTransform);
  const [sparkleGapsActivePercent, setSparkleGapsActivePercent] = useState(appliedInitial.sparkleGapsActivePercent);
  const [sparkleGapsSpeed, setSparkleGapsSpeed] = useState(appliedInitial.sparkleGapsSpeed);
  const [sparkleWidthActivePercent, setSparkleWidthActivePercent] = useState(appliedInitial.sparkleWidthActivePercent);
  const [sparkleWidthSpeed, setSparkleWidthSpeed] = useState(appliedInitial.sparkleWidthSpeed);
  const [stripes, setStripes] = useState<Stripe[]>(() => appliedInitial.stripes);
  const [overlayStripes, setOverlayStripes] = useState<Stripe[]>(() => appliedInitial.overlayStripes);
  const [gridConfig, setGridConfig] = useState<PlaygroundGridConfig>(appliedInitial.grid);
  const [flamesConfig, setFlamesConfig] = useState<PlaygroundFlamesConfig>(appliedInitial.flames);
  const [revealConfig, setRevealConfig] = useState<PlaygroundRevealConfig>(appliedInitial.reveal);
  const [cursorTrailConfig, setCursorTrailConfig] = useState<PlaygroundCursorTrailConfig>(appliedInitial.cursorTrail);
  const [clickWaveConfig, setClickWaveConfig] = useState<PlaygroundClickWaveConfig>(appliedInitial.clickWave);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importFeedback, setImportFeedback] = useState<"idle" | "imported" | "failed">("idle");
  const [exportFeedback, setExportFeedback] = useState<"idle" | "copied" | "failed">("idle");
  const [exportReactOpen, setExportReactOpen] = useState(false);
  const [videoExportPhase, setVideoExportPhase] = useState<PlaygroundVideoExportPhase>("idle");
  const [videoExportProgress, setVideoExportProgress] = useState({ elapsedMs: 0, totalMs: 0 });
  const [videoExportTranscodePercent, setVideoExportTranscodePercent] = useState<number | null>(null);
  const [videoExportEtaTick, setVideoExportEtaTick] = useState(0);
  const videoExportAbortRef = useRef<AbortController | null>(null);
  const videoExportTranscodeStartedAtRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [displayWidth, setDisplayWidth] = useState(0);
  const [displayHeight, setDisplayHeight] = useState(0);
  const [sourceWidth, setSourceWidth] = useState(0);
  const [sourceHeight, setSourceHeight] = useState(0);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const textureGamma = textureAdjustments.gamma;
  const activeStripes = useMemo(
    () => [...resolveActivePlaygroundStripes(textureLuminanceSettings.mode, stripes, overlayStripes)],
    [textureLuminanceSettings.mode, stripes, overlayStripes],
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stripeColorsRef = useRef<StripeColors>({ stripes });
  const gridConfigRef = useRef<PlaygroundGridConfig>(gridConfig);
  const flamesConfigRef = useRef<PlaygroundFlamesConfig>(flamesConfig);
  const revealConfigRef = useRef<PlaygroundRevealConfig>(revealConfig);
  const cursorTrailConfigRef = useRef<PlaygroundCursorTrailConfig>(cursorTrailConfig);
  const clickWaveConfigRef = useRef<PlaygroundClickWaveConfig>(clickWaveConfig);
  // Set during render so a scene rebuild (sceneKey change) reads fresh structural values.
  gridConfigRef.current = gridConfig;
  flamesConfigRef.current = flamesConfig;
  revealConfigRef.current = revealConfig;
  cursorTrailConfigRef.current = cursorTrailConfig;
  clickWaveConfigRef.current = clickWaveConfig;
  const preferP3Ref = useRef(false);
  const duotoneEnabledRef = useRef(duotoneEnabled);
  const stripesEnabledRef = useRef(stripesEnabled);
  const textureGammaRef = useRef(textureGamma);
  const textureAdjustmentsRef = useRef(textureAdjustments);
  const textureLuminanceSettingsRef = useRef(textureLuminanceSettings);
  const sourceTransformRef = useRef(sourceTransform);
  const sparkleOptionsRef = useRef(playgroundSparkleOptionsFromSliders(sparkleGapsActivePercent, sparkleGapsSpeed));
  const widthShuffleOptionsRef = useRef(
    playgroundWidthShuffleOptionsFromSliders(sparkleWidthActivePercent, sparkleWidthSpeed),
  );
  const flamesStateRef = useRef(createPlaygroundFlamesState());
  const revealStateRef = useRef<PlaygroundRevealState>({ progress: 0 });
  const revealPlaybackRef = useRef<PlaygroundRevealPlayback>({ replayKey: 0, startedAtMs: performance.now() });
  const autoplayRef = useRef(true);
  const exportStateRef = useRef<PlaygroundSceneExportState | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sparkleGapsActivePercentRef = useRef(sparkleGapsActivePercent);
  const sparkleGapsSpeedRef = useRef(sparkleGapsSpeed);
  const sparkleWidthActivePercentRef = useRef(sparkleWidthActivePercent);
  const sparkleWidthSpeedRef = useRef(sparkleWidthSpeed);
  sparkleGapsActivePercentRef.current = sparkleGapsActivePercent;
  sparkleGapsSpeedRef.current = sparkleGapsSpeed;
  sparkleWidthActivePercentRef.current = sparkleWidthActivePercent;
  sparkleWidthSpeedRef.current = sparkleWidthSpeed;

  const setCanvasNode = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    setCanvasElement(node);
  }, []);

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
    stripesEnabledRef.current = stripesEnabled;
  }, [stripesEnabled]);

  useEffect(() => {
    textureGammaRef.current = textureGamma;
  }, [textureGamma]);

  useEffect(() => {
    textureAdjustmentsRef.current = textureAdjustments;
  }, [textureAdjustments]);

  useEffect(() => {
    textureLuminanceSettingsRef.current = textureLuminanceSettings;
  }, [textureLuminanceSettings]);

  useEffect(() => {
    sourceTransformRef.current = sourceTransform;
  }, [sourceTransform]);

  useEffect(() => {
    sparkleOptionsRef.current = playgroundSparkleOptionsFromSliders(
      sparkleGapsActivePercent,
      sparkleGapsSpeed,
      gridConfig.sparkleGapsPeriodMinSec,
      gridConfig.sparkleGapsPeriodMaxSec,
    );
  }, [
    sparkleGapsActivePercent,
    sparkleGapsSpeed,
    gridConfig.sparkleGapsPeriodMinSec,
    gridConfig.sparkleGapsPeriodMaxSec,
  ]);

  useEffect(() => {
    widthShuffleOptionsRef.current = playgroundWidthShuffleOptionsFromSliders(
      sparkleWidthActivePercent,
      sparkleWidthSpeed,
      gridConfig.sparkleWidthPeriodMinSec,
      gridConfig.sparkleWidthPeriodMaxSec,
    );
  }, [
    sparkleWidthActivePercent,
    sparkleWidthSpeed,
    gridConfig.sparkleWidthPeriodMinSec,
    gridConfig.sparkleWidthPeriodMaxSec,
  ]);

  const replayReveal = useCallback(() => {
    revealStateRef.current = { progress: 0 };
    revealPlaybackRef.current = {
      replayKey: revealPlaybackRef.current.replayKey + 1,
      startedAtMs: performance.now(),
    };
  }, []);

  const persistCurrentConfig = useCallback(() => {
    const config: PlaygroundPersistedConfig = {
      duotoneEnabled,
      stripesEnabled: stripesEnabled ? undefined : false,
      textureAdjustments: isDefaultPlaygroundTextureAdjustments(textureAdjustments) ? undefined : textureAdjustments,
      textureLuminanceMode:
        textureLuminanceSettings.mode !== DEFAULT_TEXTURE_LUMINANCE_MODE ? textureLuminanceSettings.mode : undefined,
      textureLuminanceBackgroundColor:
        textureLuminanceSettings.backgroundColor !== DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR
          ? textureLuminanceSettings.backgroundColor
          : undefined,
      sourceTransform: isDefaultPlaygroundSourceTransform(sourceTransform) ? undefined : sourceTransform,
      sparkleGapsActivePercent: sparkleGapsActivePercent > 0 ? sparkleGapsActivePercent : undefined,
      sparkleGapsSpeed:
        sparkleGapsActivePercent > 0 && sparkleGapsSpeed !== DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED
          ? sparkleGapsSpeed
          : undefined,
      sparkleWidthActivePercent:
        sparkleWidthActivePercent !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT
          ? sparkleWidthActivePercent
          : undefined,
      sparkleWidthSpeed: sparkleWidthSpeed !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED ? sparkleWidthSpeed : undefined,
      displayWidth: displayWidth > 0 ? displayWidth : undefined,
      displayHeight: displayHeight > 0 ? displayHeight : undefined,
      backgroundCss: normalizePlaygroundBackgroundCss(backgroundCss),
      backgroundColor: backgroundColor !== DEFAULT_PLAYGROUND_BACKGROUND_COLOR ? backgroundColor : undefined,
      grid: isDefaultPlaygroundGridConfig(gridConfig) ? undefined : gridConfig,
      flames: isDefaultPlaygroundFlamesConfig(flamesConfig) ? undefined : flamesConfig,
      reveal: isDefaultPlaygroundRevealConfig(revealConfig) ? undefined : revealConfig,
      cursorTrail: isDefaultPlaygroundCursorTrailConfig(cursorTrailConfig) ? undefined : cursorTrailConfig,
      clickWave: isDefaultPlaygroundClickWaveConfig(clickWaveConfig) ? undefined : clickWaveConfig,
      stripes,
      overlayStripes: overlayStripesMatchDefault(overlayStripes) ? undefined : overlayStripes,
    };
    schedulePersistedConfig(selectedTextureId, config);
  }, [
    selectedTextureId,
    duotoneEnabled,
    stripesEnabled,
    textureAdjustments,
    textureLuminanceSettings,
    sourceTransform,
    sparkleGapsActivePercent,
    sparkleGapsSpeed,
    sparkleWidthActivePercent,
    sparkleWidthSpeed,
    displayWidth,
    displayHeight,
    backgroundCss,
    backgroundColor,
    gridConfig,
    flamesConfig,
    revealConfig,
    cursorTrailConfig,
    clickWaveConfig,
    stripes,
    overlayStripes,
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

  const applyConfig = useCallback(
    (config: PlaygroundPersistedConfig) => {
      const next = applyPersistedConfig(config);
      setDuotoneEnabled(next.duotoneEnabled);
      setStripesEnabled(next.stripesEnabled);
      setBackgroundCss(next.backgroundCss ?? "");
      setBackgroundColor(next.backgroundColor);
      setTextureAdjustments(next.textureAdjustments);
      setTextureLuminanceSettings(next.textureLuminanceSettings);
      setSourceTransform(next.sourceTransform);
      setSparkleGapsActivePercent(resolvePersistedSparkleGapsActivePercent(config));
      setSparkleGapsSpeed(resolvePersistedSparkleGapsSpeed(config));
      setSparkleWidthActivePercent(resolvePersistedSparkleWidthActivePercent(next));
      setSparkleWidthSpeed(resolvePersistedSparkleWidthSpeed(next));
      if (next.displayWidth && next.displayWidth > 0) {
        setDisplayWidth(next.displayWidth);
      }
      if (next.displayHeight && next.displayHeight > 0) {
        setDisplayHeight(next.displayHeight);
      }
      setGridConfig(next.grid);
      setFlamesConfig(next.flames);
      setRevealConfig(next.reveal);
      setCursorTrailConfig(next.cursorTrail);
      setClickWaveConfig(next.clickWave);
      revealConfigRef.current = next.reveal;
      cursorTrailConfigRef.current = next.cursorTrail;
      clickWaveConfigRef.current = next.clickWave;
      replayReveal();
      setStripes(next.stripes);
      setOverlayStripes(next.overlayStripes);
    },
    [replayReveal],
  );

  const applyDisplayScale = useCallback((multiplier: number) => {
    const textureSource: PlaygroundTextureSource | null = videoRef.current
      ? { kind: "video", element: videoRef.current }
      : imageRef.current
        ? { kind: "image", element: imageRef.current }
        : null;
    if (!textureSource || multiplier <= 0 || !Number.isFinite(multiplier)) {
      return;
    }
    const source = getPlaygroundTextureNativeSize(textureSource);
    if (source.width <= 0 || source.height <= 0) {
      return;
    }
    setSourceWidth(source.width);
    setSourceHeight(source.height);
    setDisplayWidth(clampPlaygroundDisplayDimension(source.width * multiplier, source.width));
    setDisplayHeight(clampPlaygroundDisplayDimension(source.height * multiplier, source.height));
  }, []);

  const onTextureSelect = useCallback(
    (textureId: PlaygroundTextureId) => {
      applyConfig(defaultConfigForTexture(textureId));
      setSelectedTextureId(textureId);
    },
    [applyConfig],
  );

  useEffect(() => {
    stripeColorsRef.current = { stripes: activeStripes };
  }, [activeStripes]);

  const refreshSparkleGapsOptionsRef = useCallback((activePercent: number, speed: number) => {
    sparkleOptionsRef.current = playgroundSparkleOptionsFromSliders(
      activePercent,
      speed,
      gridConfigRef.current.sparkleGapsPeriodMinSec,
      gridConfigRef.current.sparkleGapsPeriodMaxSec,
    );
  }, []);

  const refreshWidthShuffleOptionsRef = useCallback((activePercent: number, speed: number) => {
    widthShuffleOptionsRef.current = playgroundWidthShuffleOptionsFromSliders(
      activePercent,
      speed,
      gridConfigRef.current.sparkleWidthPeriodMinSec,
      gridConfigRef.current.sparkleWidthPeriodMaxSec,
    );
  }, []);

  const throttledSetGridConfig = useThrottledCallback((next: PlaygroundGridConfig) => {
    setGridConfig(next);
  }, PLAYGROUND_SCRUB_COMMIT_MS);

  const throttledSetTextureAdjustments = useThrottledCallback((next: PlaygroundTextureAdjustments) => {
    setTextureAdjustments(next);
  }, PLAYGROUND_SCRUB_COMMIT_MS);

  const throttledSetSourceTransform = useThrottledCallback((next: PlaygroundSourceTransform) => {
    setSourceTransform(next);
  }, PLAYGROUND_SCRUB_COMMIT_MS);

  const throttledSetSparkleGapsActivePercent = useThrottledCallback((value: number) => {
    setSparkleGapsActivePercent(value);
  }, PLAYGROUND_SCRUB_COMMIT_MS);

  const throttledSetSparkleGapsSpeed = useThrottledCallback((value: number) => {
    setSparkleGapsSpeed(value);
  }, PLAYGROUND_SCRUB_COMMIT_MS);

  const throttledSetSparkleWidthActivePercent = useThrottledCallback((value: number) => {
    setSparkleWidthActivePercent(value);
  }, PLAYGROUND_SCRUB_COMMIT_MS);

  const throttledSetSparkleWidthSpeed = useThrottledCallback((value: number) => {
    setSparkleWidthSpeed(value);
  }, PLAYGROUND_SCRUB_COMMIT_MS);

  const throttledSetFlamesConfig = useThrottledCallback((next: PlaygroundFlamesConfig) => {
    setFlamesConfig(next);
  }, PLAYGROUND_SCRUB_COMMIT_MS);

  const throttledSetCursorTrailConfig = useThrottledCallback((next: PlaygroundCursorTrailConfig) => {
    setCursorTrailConfig(next);
  }, PLAYGROUND_SCRUB_COMMIT_MS);

  const throttledSetClickWaveConfig = useThrottledCallback((next: PlaygroundClickWaveConfig) => {
    setClickWaveConfig(next);
  }, PLAYGROUND_SCRUB_COMMIT_MS);

  const throttledSetRevealConfig = useThrottledCallback((next: PlaygroundRevealConfig) => {
    setRevealConfig(next);
  }, PLAYGROUND_SCRUB_COMMIT_MS);

  const applyStripePatch = useCallback((id: string, patch: Parameters<typeof updateStripe>[2]) => {
    const next = updateStripe({ stripes: stripeColorsRef.current.stripes }, id, patch).stripes;
    stripeColorsRef.current = { stripes: next };
    if (normalizeTextureLuminanceMode(textureLuminanceSettingsRef.current.mode) === "overlay") {
      setOverlayStripes(next);
    } else {
      setStripes(next);
    }
    return next;
  }, []);

  const onStripeColorChange = useCallback(
    (id: string, hex: string) => {
      applyStripePatch(id, stripeColorFromHexPicker(hex));
    },
    [applyStripePatch],
  );

  const onStripeStartFromCommit = useCallback(
    (id: string, value: number) => {
      applyStripePatch(id, { startFrom: value });
    },
    [applyStripePatch],
  );

  const onStripeWidthCommit = useCallback(
    (id: string, value: number) => {
      applyStripePatch(id, { width: value });
    },
    [applyStripePatch],
  );

  const resetStripes = useCallback(() => {
    setStripesEnabled(true);
    setTextureLuminanceSettings({
      mode: DEFAULT_TEXTURE_LUMINANCE_MODE,
      backgroundColor: DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
    });
    setStripes(cloneDefaultStripes());
    setOverlayStripes(cloneDefaultOverlayStripes());
    setGridConfig((previous) => ({
      ...previous,
      gridUpdateIntervalMs: DEFAULT_PLAYGROUND_GRID_CONFIG.gridUpdateIntervalMs,
    }));
  }, []);

  const updateGridLive = useCallback(
    (patch: Partial<PlaygroundGridConfig>) => {
      const next = normalizePlaygroundGridConfig({ ...gridConfigRef.current, ...patch });
      gridConfigRef.current = next;
      refreshSparkleGapsOptionsRef(sparkleGapsActivePercentRef.current, sparkleGapsSpeedRef.current);
      refreshWidthShuffleOptionsRef(sparkleWidthActivePercentRef.current, sparkleWidthSpeedRef.current);
      throttledSetGridConfig(next);
    },
    [refreshSparkleGapsOptionsRef, refreshWidthShuffleOptionsRef, throttledSetGridConfig],
  );

  const updateGrid = useCallback(
    (patch: Partial<PlaygroundGridConfig>) => {
      const next = normalizePlaygroundGridConfig({ ...gridConfigRef.current, ...patch });
      gridConfigRef.current = next;
      setGridConfig(next);
      refreshSparkleGapsOptionsRef(sparkleGapsActivePercentRef.current, sparkleGapsSpeedRef.current);
      refreshWidthShuffleOptionsRef(sparkleWidthActivePercentRef.current, sparkleWidthSpeedRef.current);
    },
    [refreshSparkleGapsOptionsRef, refreshWidthShuffleOptionsRef],
  );

  const resetGridSection = useCallback(() => {
    setGridConfig((previous) => ({
      ...previous,
      cellWidth: DEFAULT_PLAYGROUND_GRID_CONFIG.cellWidth,
      cellHeight: DEFAULT_PLAYGROUND_GRID_CONFIG.cellHeight,
      gapX: DEFAULT_PLAYGROUND_GRID_CONFIG.gapX,
      gapY: DEFAULT_PLAYGROUND_GRID_CONFIG.gapY,
      cornerRadius: DEFAULT_PLAYGROUND_GRID_CONFIG.cornerRadius,
      orientation: DEFAULT_PLAYGROUND_GRID_CONFIG.orientation,
    }));
  }, []);

  const resetLettersSection = useCallback(() => {
    setGridConfig((previous) => ({
      ...previous,
      letterSize: DEFAULT_PLAYGROUND_GRID_CONFIG.letterSize,
      letterRatio: DEFAULT_PLAYGROUND_GRID_CONFIG.letterRatio,
      letterCharset: DEFAULT_PLAYGROUND_GRID_CONFIG.letterCharset,
      letterColor: DEFAULT_PLAYGROUND_GRID_CONFIG.letterColor,
      letterShuffleSpeed: DEFAULT_PLAYGROUND_GRID_CONFIG.letterShuffleSpeed,
    }));
  }, []);

  const resetGeneral = useCallback(() => {
    setDuotoneEnabled(true);
  }, []);

  const resetBackground = useCallback(() => {
    setBackgroundCss("");
    setBackgroundColor(DEFAULT_PLAYGROUND_BACKGROUND_COLOR);
  }, []);

  const updateFlamesConfigLive = useCallback(
    (patch: Partial<PlaygroundFlamesConfig>) => {
      const prev = flamesConfigRef.current;
      const next = normalizePlaygroundFlamesConfig({ ...prev, ...patch });
      flamesConfigRef.current = next;
      if (patch.direction !== undefined && patch.direction !== prev.direction) {
        flamesStateRef.current = createPlaygroundFlamesState();
      }
      throttledSetFlamesConfig(next);
    },
    [throttledSetFlamesConfig],
  );

  const updateFlamesConfig = useCallback((patch: Partial<PlaygroundFlamesConfig>) => {
    const prev = flamesConfigRef.current;
    const next = normalizePlaygroundFlamesConfig({ ...prev, ...patch });
    flamesConfigRef.current = next;
    if (patch.direction !== undefined && patch.direction !== prev.direction) {
      flamesStateRef.current = createPlaygroundFlamesState();
    }
    setFlamesConfig(next);
  }, []);

  const resetFlames = useCallback(() => {
    flamesConfigRef.current = { ...DEFAULT_PLAYGROUND_FLAMES_CONFIG };
    flamesStateRef.current = createPlaygroundFlamesState();
    setFlamesConfig({ ...DEFAULT_PLAYGROUND_FLAMES_CONFIG });
  }, []);

  const updateCursorTrailConfigLive = useCallback(
    (patch: Partial<PlaygroundCursorTrailConfig>) => {
      const next = normalizePlaygroundCursorTrailConfig({ ...cursorTrailConfigRef.current, ...patch });
      cursorTrailConfigRef.current = next;
      throttledSetCursorTrailConfig(next);
    },
    [throttledSetCursorTrailConfig],
  );

  const updateCursorTrailConfig = useCallback((patch: Partial<PlaygroundCursorTrailConfig>) => {
    const next = normalizePlaygroundCursorTrailConfig({ ...cursorTrailConfigRef.current, ...patch });
    cursorTrailConfigRef.current = next;
    setCursorTrailConfig(next);
  }, []);

  const resetCursorTrail = useCallback(() => {
    cursorTrailConfigRef.current = { ...DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG };
    setCursorTrailConfig({ ...DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG });
  }, []);

  const updateClickWaveConfigLive = useCallback(
    (patch: Partial<PlaygroundClickWaveConfig>) => {
      const next = normalizePlaygroundClickWaveConfig({ ...clickWaveConfigRef.current, ...patch });
      clickWaveConfigRef.current = next;
      throttledSetClickWaveConfig(next);
    },
    [throttledSetClickWaveConfig],
  );

  const updateClickWaveConfig = useCallback((patch: Partial<PlaygroundClickWaveConfig>) => {
    const next = normalizePlaygroundClickWaveConfig({ ...clickWaveConfigRef.current, ...patch });
    clickWaveConfigRef.current = next;
    setClickWaveConfig(next);
  }, []);

  const resetClickWave = useCallback(() => {
    clickWaveConfigRef.current = { ...DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG };
    setClickWaveConfig({ ...DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG });
  }, []);

  const updateRevealConfigLive = useCallback(
    (patch: Partial<PlaygroundRevealConfig>) => {
      const next = normalizePlaygroundRevealConfig({ ...revealConfigRef.current, ...patch });
      revealConfigRef.current = next;
      throttledSetRevealConfig(next);
      replayReveal();
    },
    [replayReveal, throttledSetRevealConfig],
  );

  const updateRevealWaveLive = useCallback(
    (patch: Partial<PlaygroundWaveRevealConfig>) => {
      updateRevealConfigLive({ wave: { ...revealConfigRef.current.wave, ...patch } });
    },
    [updateRevealConfigLive],
  );

  const updateRevealRandomColumnsLive = useCallback(
    (patch: Partial<PlaygroundRandomColumnsRevealConfig>) => {
      updateRevealConfigLive({ randomColumns: { ...revealConfigRef.current.randomColumns, ...patch } });
    },
    [updateRevealConfigLive],
  );

  const updateRevealConfig = useCallback(
    (patch: Partial<PlaygroundRevealConfig>) => {
      const next = normalizePlaygroundRevealConfig({ ...revealConfigRef.current, ...patch });
      revealConfigRef.current = next;
      setRevealConfig(next);
      replayReveal();
    },
    [replayReveal],
  );

  const resetReveal = useCallback(() => {
    const next = {
      preset: DEFAULT_PLAYGROUND_REVEAL_CONFIG.preset,
      wave: { ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave },
      randomColumns: { ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.randomColumns },
    };
    revealConfigRef.current = next;
    setRevealConfig(next);
    replayReveal();
  }, [replayReveal]);

  const updateTextureAdjustmentsLive = useCallback(
    (patch: Partial<PlaygroundTextureAdjustments>) => {
      const next = normalizePlaygroundTextureAdjustments({ ...textureAdjustmentsRef.current, ...patch });
      textureAdjustmentsRef.current = next;
      textureGammaRef.current = next.gamma;
      throttledSetTextureAdjustments(next);
    },
    [throttledSetTextureAdjustments],
  );

  const updateTextureAdjustments = useCallback((patch: Partial<PlaygroundTextureAdjustments>) => {
    const next = normalizePlaygroundTextureAdjustments({ ...textureAdjustmentsRef.current, ...patch });
    textureAdjustmentsRef.current = next;
    textureGammaRef.current = next.gamma;
    setTextureAdjustments(next);
  }, []);

  const onTextureLuminanceSettingsDetected = useCallback((settings: TextureLuminanceSettings) => {
    textureLuminanceSettingsRef.current = settings;
    setTextureLuminanceSettings(settings);
  }, []);

  const updateTextureLuminanceSettings = useCallback((patch: Partial<TextureLuminanceSettings>) => {
    const prevMode = textureLuminanceSettingsRef.current.mode;
    const switchingToColors =
      prevMode !== "colors" && normalizeTextureLuminanceMode(patch.mode ?? prevMode) === "colors";
    const next: TextureLuminanceSettings = {
      mode: normalizeTextureLuminanceMode(patch.mode ?? prevMode),
      backgroundColor: normalizeTextureLuminanceBackgroundColor(
        patch.backgroundColor ?? (switchingToColors ? 0xffffff : textureLuminanceSettingsRef.current.backgroundColor),
      ),
    };
    textureLuminanceSettingsRef.current = next;
    setTextureLuminanceSettings(next);

    if (switchingToColors) {
      const nextStripes = applyColorsModeStripeDefaults(stripeColorsRef.current.stripes);
      stripeColorsRef.current = { stripes: nextStripes };
      setStripes(nextStripes);
    }
  }, []);

  const updateSourceTransformLive = useCallback(
    (patch: Partial<PlaygroundSourceTransform>) => {
      const next = normalizePlaygroundSourceTransform({ ...sourceTransformRef.current, ...patch });
      sourceTransformRef.current = next;
      throttledSetSourceTransform(next);
    },
    [throttledSetSourceTransform],
  );

  const updateSourceTransform = useCallback((patch: Partial<PlaygroundSourceTransform>) => {
    const next = normalizePlaygroundSourceTransform({ ...sourceTransformRef.current, ...patch });
    sourceTransformRef.current = next;
    setSourceTransform(next);
  }, []);

  const commitSparkleGapsActivePercent = useCallback(
    (value: number) => {
      sparkleGapsActivePercentRef.current = value;
      refreshSparkleGapsOptionsRef(value, sparkleGapsSpeedRef.current);
      setSparkleGapsActivePercent(value);
    },
    [refreshSparkleGapsOptionsRef],
  );

  const setSparkleGapsActivePercentLive = useCallback(
    (value: number) => {
      sparkleGapsActivePercentRef.current = value;
      refreshSparkleGapsOptionsRef(value, sparkleGapsSpeedRef.current);
      throttledSetSparkleGapsActivePercent(value);
    },
    [refreshSparkleGapsOptionsRef, throttledSetSparkleGapsActivePercent],
  );

  const commitSparkleGapsSpeed = useCallback(
    (value: number) => {
      sparkleGapsSpeedRef.current = value;
      refreshSparkleGapsOptionsRef(sparkleGapsActivePercentRef.current, value);
      setSparkleGapsSpeed(value);
    },
    [refreshSparkleGapsOptionsRef],
  );

  const setSparkleGapsSpeedLive = useCallback(
    (value: number) => {
      sparkleGapsSpeedRef.current = value;
      refreshSparkleGapsOptionsRef(sparkleGapsActivePercentRef.current, value);
      throttledSetSparkleGapsSpeed(value);
    },
    [refreshSparkleGapsOptionsRef, throttledSetSparkleGapsSpeed],
  );

  const commitSparkleWidthActivePercent = useCallback(
    (value: number) => {
      sparkleWidthActivePercentRef.current = value;
      refreshWidthShuffleOptionsRef(value, sparkleWidthSpeedRef.current);
      setSparkleWidthActivePercent(value);
    },
    [refreshWidthShuffleOptionsRef],
  );

  const setSparkleWidthActivePercentLive = useCallback(
    (value: number) => {
      sparkleWidthActivePercentRef.current = value;
      refreshWidthShuffleOptionsRef(value, sparkleWidthSpeedRef.current);
      throttledSetSparkleWidthActivePercent(value);
    },
    [refreshWidthShuffleOptionsRef, throttledSetSparkleWidthActivePercent],
  );

  const commitSparkleWidthSpeed = useCallback(
    (value: number) => {
      sparkleWidthSpeedRef.current = value;
      refreshWidthShuffleOptionsRef(sparkleWidthActivePercentRef.current, value);
      setSparkleWidthSpeed(value);
    },
    [refreshWidthShuffleOptionsRef],
  );

  const setSparkleWidthSpeedLive = useCallback(
    (value: number) => {
      sparkleWidthSpeedRef.current = value;
      refreshWidthShuffleOptionsRef(sparkleWidthActivePercentRef.current, value);
      throttledSetSparkleWidthSpeed(value);
    },
    [refreshWidthShuffleOptionsRef, throttledSetSparkleWidthSpeed],
  );

  const resetTextureTone = useCallback(() => {
    setTextureAdjustments((previous) =>
      normalizePlaygroundTextureAdjustments({
        ...previous,
        brightness: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.brightness,
        exposure: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.exposure,
        contrast: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.contrast,
        gamma: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.gamma,
        invert: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.invert,
      }),
    );
  }, []);

  const resetTextureEffects = useCallback(() => {
    setTextureAdjustments((previous) =>
      normalizePlaygroundTextureAdjustments({
        ...previous,
        blackPoint: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.blackPoint,
        whitePoint: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.whitePoint,
        thresholdBias: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.thresholdBias,
        posterizeLevels: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.posterizeLevels,
        noiseAmount: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.noiseAmount,
        blurRadius: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.blurRadius,
        sharpenAmount: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.sharpenAmount,
      }),
    );
  }, []);

  const resetSourceTransform = useCallback(() => {
    setSourceTransform(DEFAULT_PLAYGROUND_SOURCE_TRANSFORM);
  }, []);

  const resetSparkleGaps = useCallback(() => {
    setSparkleGapsActivePercent(0);
    setSparkleGapsSpeed(DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED);
    setGridConfig((previous) => ({
      ...previous,
      sparkleGapsPeriodMinSec: DEFAULT_PLAYGROUND_GRID_CONFIG.sparkleGapsPeriodMinSec,
      sparkleGapsPeriodMaxSec: DEFAULT_PLAYGROUND_GRID_CONFIG.sparkleGapsPeriodMaxSec,
    }));
  }, []);

  const resetSparkleWidth = useCallback(() => {
    setSparkleWidthActivePercent(DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT);
    setSparkleWidthSpeed(DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED);
    setGridConfig((previous) => ({
      ...previous,
      sparkleWidthPeriodMinSec: DEFAULT_PLAYGROUND_GRID_CONFIG.sparkleWidthPeriodMinSec,
      sparkleWidthPeriodMaxSec: DEFAULT_PLAYGROUND_GRID_CONFIG.sparkleWidthPeriodMaxSec,
      widthShuffleSwing: DEFAULT_PLAYGROUND_GRID_CONFIG.widthShuffleSwing,
    }));
  }, []);

  const generalModified = !duotoneEnabled;
  const backgroundCssActive = normalizePlaygroundBackgroundCss(backgroundCss) !== undefined;
  const backgroundModified = backgroundCssActive || backgroundColor !== DEFAULT_PLAYGROUND_BACKGROUND_COLOR;
  const flamesModified = !isDefaultPlaygroundFlamesConfig(flamesConfig);
  const cursorTrailModified = !isDefaultPlaygroundCursorTrailConfig(cursorTrailConfig);
  const cursorClickModified = !isDefaultPlaygroundClickWaveConfig(clickWaveConfig);
  const revealModified = !isDefaultPlaygroundRevealConfig(revealConfig);
  const textureToneModified =
    textureAdjustments.brightness !== DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.brightness ||
    textureAdjustments.exposure !== DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.exposure ||
    textureAdjustments.contrast !== DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.contrast ||
    textureAdjustments.gamma !== DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.gamma ||
    textureAdjustments.invert !== DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.invert;
  const textureEffectsModified =
    textureAdjustments.blackPoint !== DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.blackPoint ||
    textureAdjustments.whitePoint !== DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.whitePoint ||
    textureAdjustments.thresholdBias !== DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.thresholdBias ||
    textureAdjustments.posterizeLevels !== DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.posterizeLevels ||
    textureAdjustments.noiseAmount !== DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.noiseAmount ||
    textureAdjustments.blurRadius !== DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.blurRadius ||
    textureAdjustments.sharpenAmount !== DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS.sharpenAmount;
  const sourceTransformModified = !isDefaultPlaygroundSourceTransform(sourceTransform);
  const activeStripesModified =
    textureLuminanceSettings.mode === "overlay"
      ? !overlayStripesMatchDefault(overlayStripes)
      : !stripesMatchDefault(stripes);
  const stripesModified =
    !stripesEnabled ||
    textureLuminanceSettings.mode !== DEFAULT_TEXTURE_LUMINANCE_MODE ||
    (textureLuminanceSettings.mode === "colors" &&
      textureLuminanceSettings.backgroundColor !== DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR) ||
    activeStripesModified ||
    gridConfig.gridUpdateIntervalMs !== DEFAULT_PLAYGROUND_GRID_CONFIG.gridUpdateIntervalMs;
  const sparkleGapsModified =
    sparkleGapsActivePercent !== 0 ||
    sparkleGapsSpeed !== DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED ||
    gridConfig.sparkleGapsPeriodMinSec !== DEFAULT_PLAYGROUND_GRID_CONFIG.sparkleGapsPeriodMinSec ||
    gridConfig.sparkleGapsPeriodMaxSec !== DEFAULT_PLAYGROUND_GRID_CONFIG.sparkleGapsPeriodMaxSec;
  const sparkleWidthModified =
    sparkleWidthActivePercent !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT ||
    sparkleWidthSpeed !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED ||
    gridConfig.sparkleWidthPeriodMinSec !== DEFAULT_PLAYGROUND_GRID_CONFIG.sparkleWidthPeriodMinSec ||
    gridConfig.sparkleWidthPeriodMaxSec !== DEFAULT_PLAYGROUND_GRID_CONFIG.sparkleWidthPeriodMaxSec ||
    gridConfig.widthShuffleSwing !== DEFAULT_PLAYGROUND_GRID_CONFIG.widthShuffleSwing;
  const base = DEFAULT_PLAYGROUND_GRID_CONFIG;
  const gridSectionModified =
    gridConfig.cellWidth !== base.cellWidth ||
    gridConfig.cellHeight !== base.cellHeight ||
    gridConfig.gapX !== base.gapX ||
    gridConfig.gapY !== base.gapY ||
    gridConfig.cornerRadius !== base.cornerRadius ||
    gridConfig.orientation !== base.orientation;
  const lettersSectionModified =
    gridConfig.letterSize !== base.letterSize ||
    gridConfig.letterRatio !== base.letterRatio ||
    gridConfig.letterCharset !== base.letterCharset ||
    gridConfig.letterColor !== base.letterColor ||
    gridConfig.letterShuffleSpeed !== base.letterShuffleSpeed;

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const candidates = catalogEntriesForLoadAttempt(catalog, selectedTextureId);
    const entry = candidates[0];
    if (!entry) {
      setLoadState({
        status: "error",
        message: formatTextureLoadErrorMessage({
          label: "Texture",
          mediaKind: "image",
          reason: "unavailable",
        }),
      });
      return;
    }

    if (entry.id !== selectedTextureId) {
      onTextureSelect(entry.id);
      return;
    }

    let cancelled = false;
    setLoadState({ status: "loading" });
    autoplayRef.current = entry.mediaKind === "video";

    void loadPlaygroundSource(entry.url, entry.id, entry.mediaKind, entry.label).then((next) => {
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
      if (next.status === "error") {
        const fallback = candidates[1];
        if (fallback) {
          onTextureSelect(fallback.id);
          return;
        }
        setLoadState({
          status: "error",
          message: formatTextureLoadErrorMessage({
            label: entry.label,
            mediaKind: entry.mediaKind,
            reason: entry.url.length === 0 ? "missing" : "decode",
          }),
        });
        return;
      }
      if (next.status !== "ready") {
        return;
      }

      videoRef.current = null;
      imageRef.current = null;
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
      const { display, source } = syncDisplaySizeFromTexture(textureSource, entry.id);
      setSourceWidth(source.width);
      setSourceHeight(source.height);
      setDisplayWidth(display.width);
      setDisplayHeight(display.height);
      replayReveal();
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
  }, [hydrated, selectedTextureId, catalog, onTextureSelect, replayReveal]);

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
  const duotoneControlsDisabled = !duotoneEnabled;

  useEffect(() => {
    if (!canvasElement) {
      return;
    }
    applyCanvasBackgroundCss(canvasElement, backgroundCss, displaySize, backgroundColor);
  }, [backgroundCss, backgroundColor, canvasElement, displaySize]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (duotoneControlsDisabled || !shouldToggleStripesFromShortcut(event)) {
        return;
      }
      event.preventDefault();
      setStripesEnabled((current) => !current);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [duotoneControlsDisabled]);

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
        stripeColorsRef,
        preferP3Ref,
        duotoneEnabledRef,
        stripesEnabledRef,
        textureGammaRef,
        sparkleOptionsRef,
        widthShuffleOptionsRef,
        autoplayRef,
        exportStateRef,
        gridConfigRef,
        textureAdjustmentsRef,
        textureLuminanceSettingsRef,
        sourceTransformRef,
        flamesStateRef,
        flamesConfigRef,
        revealConfigRef,
        revealStateRef,
        revealPlaybackRef,
        cursorTrailConfigRef,
        clickWaveConfigRef,
        onTextureLuminanceSettingsDetected,
      ),
    ];
  }, [
    loadState,
    displayWidth,
    displayHeight,
    displaySize,
    flamesStateRef,
    flamesConfigRef,
    cursorTrailConfigRef,
    clickWaveConfigRef,
    onTextureLuminanceSettingsDetected,
  ]);

  const onUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setUploadError(null);
    try {
      const { textureId } = await registerUpload(file);
      const envelope = loadPlaygroundEnvelope();
      const blobUrls = await hydrateUploadUrls(envelope.uploads);
      setCatalog(mergeCatalog(envelope.uploads, blobUrls));
      onTextureSelect(textureId);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Try another image or video file.");
    }
  };

  const onCopyState = async () => {
    const config: PlaygroundPersistedConfig = {
      duotoneEnabled,
      stripesEnabled: stripesEnabled ? undefined : false,
      textureAdjustments: isDefaultPlaygroundTextureAdjustments(textureAdjustments) ? undefined : textureAdjustments,
      textureLuminanceMode:
        textureLuminanceSettings.mode !== DEFAULT_TEXTURE_LUMINANCE_MODE ? textureLuminanceSettings.mode : undefined,
      textureLuminanceBackgroundColor:
        textureLuminanceSettings.backgroundColor !== DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR
          ? textureLuminanceSettings.backgroundColor
          : undefined,
      sourceTransform: isDefaultPlaygroundSourceTransform(sourceTransform) ? undefined : sourceTransform,
      sparkleGapsActivePercent: sparkleGapsActivePercent > 0 ? sparkleGapsActivePercent : undefined,
      sparkleGapsSpeed:
        sparkleGapsActivePercent > 0 && sparkleGapsSpeed !== DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED
          ? sparkleGapsSpeed
          : undefined,
      sparkleWidthActivePercent:
        sparkleWidthActivePercent !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT
          ? sparkleWidthActivePercent
          : undefined,
      sparkleWidthSpeed: sparkleWidthSpeed !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED ? sparkleWidthSpeed : undefined,
      displayWidth: displayWidth > 0 ? displayWidth : undefined,
      displayHeight: displayHeight > 0 ? displayHeight : undefined,
      backgroundCss: normalizePlaygroundBackgroundCss(backgroundCss),
      backgroundColor: backgroundColor !== DEFAULT_PLAYGROUND_BACKGROUND_COLOR ? backgroundColor : undefined,
      grid: isDefaultPlaygroundGridConfig(gridConfig) ? undefined : gridConfig,
      flames: isDefaultPlaygroundFlamesConfig(flamesConfig) ? undefined : flamesConfig,
      reveal: isDefaultPlaygroundRevealConfig(revealConfig) ? undefined : revealConfig,
      cursorTrail: isDefaultPlaygroundCursorTrailConfig(cursorTrailConfig) ? undefined : cursorTrailConfig,
      clickWave: isDefaultPlaygroundClickWaveConfig(clickWaveConfig) ? undefined : clickWaveConfig,
      stripes,
      overlayStripes: overlayStripesMatchDefault(overlayStripes) ? undefined : overlayStripes,
    };
    await copyPlaygroundStateToClipboard(config);
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

  const onCancelVideoExport = () => {
    videoExportAbortRef.current?.abort();
  };

  const handleVideoExportPhase = useCallback((phase: PlaygroundVideoExportPhase) => {
    if (phase === "transcoding") {
      if (videoExportTranscodeStartedAtRef.current === null) {
        videoExportTranscodeStartedAtRef.current = performance.now();
      }
    } else {
      videoExportTranscodeStartedAtRef.current = null;
    }
    setVideoExportPhase(phase);
  }, []);

  useEffect(() => {
    if (videoExportPhase !== "transcoding") {
      return;
    }
    const id = window.setInterval(() => setVideoExportEtaTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(id);
  }, [videoExportPhase]);

  const onExportVideo = async () => {
    if (loadState.status !== "ready" || displayWidth <= 0 || displayHeight <= 0) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setVideoExportPhase("failed");
      window.setTimeout(() => setVideoExportPhase("idle"), 1600);
      return;
    }

    const sourceKind = loadState.kind;
    const videoDuration = loadState.kind === "video" ? loadState.video.duration : 0;
    const exportDurationSec = resolveExportDuration(sourceKind, videoDuration);
    if (exportDurationSec <= 0) {
      setVideoExportPhase("failed");
      window.setTimeout(() => setVideoExportPhase("idle"), 1600);
      return;
    }

    if (shouldConfirmLongExport(exportDurationSec)) {
      const confirmed = window.confirm(
        `Export will record about ${formatTime(exportDurationSec)} of video. This may take a while. Continue?`,
      );
      if (!confirmed) {
        return;
      }
    }

    const controller = new AbortController();
    videoExportAbortRef.current = controller;
    setVideoExportProgress({ elapsedMs: 0, totalMs: exportDurationSec * 1000 });
    setVideoExportTranscodePercent(null);
    videoExportTranscodeStartedAtRef.current = null;
    setVideoExportPhase("recording");

    try {
      await exportPlaygroundVideo({
        canvas,
        sourceKind,
        video: loadState.kind === "video" ? loadState.video : undefined,
        backgroundCss,
        backgroundColor,
        signal: controller.signal,
        onPhase: handleVideoExportPhase,
        onProgress: (elapsedMs, totalMs) => setVideoExportProgress({ elapsedMs, totalMs }),
        onTranscodeProgress: setVideoExportTranscodePercent,
      });
      setVideoExportPhase("done");
      window.setTimeout(() => setVideoExportPhase("idle"), 1600);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setVideoExportPhase("idle");
      } else {
        setVideoExportPhase("failed");
        window.setTimeout(() => setVideoExportPhase("idle"), 1600);
      }
    } finally {
      videoExportAbortRef.current = null;
    }
  };

  const onExportSvg = async () => {
    if (!duotoneEnabled || !stripesEnabled || loadState.status !== "ready") {
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
        ? sampleVideoFrame(loadState.video, display.width, display.height, sampleCanvas, sampleCtx, sourceTransform)
        : sampleTextureFrame(loadState.image, display.width, display.height, sampleCanvas, sampleCtx, sourceTransform);
    if (!frame) {
      setExportFeedback("failed");
      window.setTimeout(() => setExportFeedback("idle"), 1600);
      return;
    }

    const colors = stripeColorsRef.current;
    const built = buildPlaygroundBlockGrid(frame, display.width, display.height, colors, {}, textureGamma, {
      textureAdjustments,
      luminanceSettings: textureLuminanceSettings,
      flamesState: flamesStateRef.current,
      flamesConfig: flamesConfigRef.current,
      reveal: {
        config: revealConfigRef.current,
        progress: revealStateRef.current.progress,
        replayKey: revealPlaybackRef.current.replayKey,
      },
    });
    const svg = stripeGridToSvg(built.grid, colors, display.width, display.height, {
      useCellColors: textureLuminanceSettings.mode === "colors",
    });

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
          stripesEnabled: stripesEnabled ? undefined : false,
          textureAdjustments: isDefaultPlaygroundTextureAdjustments(textureAdjustments)
            ? undefined
            : textureAdjustments,
          textureLuminanceMode:
            textureLuminanceSettings.mode !== DEFAULT_TEXTURE_LUMINANCE_MODE
              ? textureLuminanceSettings.mode
              : undefined,
          textureLuminanceBackgroundColor:
            textureLuminanceSettings.backgroundColor !== DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR
              ? textureLuminanceSettings.backgroundColor
              : undefined,
          sourceTransform: isDefaultPlaygroundSourceTransform(sourceTransform) ? undefined : sourceTransform,
          sparkleGapsActivePercent: sparkleGapsActivePercent > 0 ? sparkleGapsActivePercent : undefined,
          sparkleGapsSpeed:
            sparkleGapsActivePercent > 0 && sparkleGapsSpeed !== DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED
              ? sparkleGapsSpeed
              : undefined,
          sparkleWidthActivePercent:
            sparkleWidthActivePercent !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT
              ? sparkleWidthActivePercent
              : undefined,
          sparkleWidthSpeed:
            sparkleWidthSpeed !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED ? sparkleWidthSpeed : undefined,
          displayWidth: displayWidth > 0 ? displayWidth : undefined,
          displayHeight: displayHeight > 0 ? displayHeight : undefined,
          reveal: isDefaultPlaygroundRevealConfig(revealConfig) ? undefined : revealConfig,
          stripes: activeStripes,
          overlayStripes: overlayStripesMatchDefault(overlayStripes) ? undefined : overlayStripes,
        },
        displayWidth: displayWidth > 0 ? displayWidth : 640,
        displayHeight: displayHeight > 0 ? displayHeight : 360,
        mediaKind: loadState.status === "ready" ? loadState.kind : "video",
      }),
    [
      duotoneEnabled,
      stripesEnabled,
      textureAdjustments,
      textureLuminanceSettings,
      sourceTransform,
      sparkleGapsActivePercent,
      sparkleGapsSpeed,
      sparkleWidthActivePercent,
      sparkleWidthSpeed,
      displayWidth,
      displayHeight,
      revealConfig,
      activeStripes,
      overlayStripes,
      loadState,
    ],
  );

  const importStatusMessage =
    importFeedback === "imported" ? "Imported" : importFeedback === "failed" ? "Import failed" : null;
  const isVideoExportBusy =
    videoExportPhase === "recording" || videoExportPhase === "loading-encoder" || videoExportPhase === "transcoding";

  const playgroundLevaProps: PlaygroundLevaControlsProps = {
    catalog,
    selectedTextureId,
    onTextureSelect,
    displayWidth,
    displayHeight,
    sourceWidth,
    sourceHeight,
    onDisplayWidthChange: (value) => {
      const fallback = displayWidth > 0 ? displayWidth : sourceWidth || 1;
      setDisplayWidth(clampPlaygroundDisplayDimension(value, fallback));
    },
    onDisplayHeightChange: (value) => {
      const fallback = displayHeight > 0 ? displayHeight : sourceHeight || 1;
      setDisplayHeight(clampPlaygroundDisplayDimension(value, fallback));
    },
    applyDisplayScale,
    onUploadFile,
    importText,
    onImportTextChange: setImportText,
    onCopyState,
    onImportState,
    importStatus: importStatusMessage,
    uploadError,
    workflowDisabled: isVideoExportBusy,
    duotoneEnabled,
    onDuotoneEnabledChange: setDuotoneEnabled,
    duotoneControlsDisabled,
    textureAdjustments,
    onAdjustmentsChange: updateTextureAdjustments,
    onLiveAdjustmentsChange: updateTextureAdjustmentsLive,
    onResetTone: resetTextureTone,
    onResetEffects: resetTextureEffects,
    toneModified: textureToneModified,
    effectsModified: textureEffectsModified,
    sourceTransform,
    onSourceTransformChange: updateSourceTransform,
    onLiveSourceTransformChange: updateSourceTransformLive,
    onResetSource: resetSourceTransform,
    sourceModified: sourceTransformModified,
    backgroundColor,
    backgroundCss,
    backgroundCssActive,
    onBackgroundColorChange: setBackgroundColor,
    onBackgroundCssChange: setBackgroundCss,
    onResetBackground: resetBackground,
    backgroundModified,
    gridConfig,
    onGridChange: updateGrid,
    onGridLiveChange: updateGridLive,
    onResetGrid: resetGridSection,
    onResetLetters: resetLettersSection,
    gridModified: gridSectionModified,
    lettersModified: lettersSectionModified,
    stripes: activeStripes,
    stripesEnabled,
    textureLuminanceSettings,
    onStripesEnabledChange: setStripesEnabled,
    onTextureLuminanceSettingsChange: updateTextureLuminanceSettings,
    onStripeColorChange,
    onStripeStartFromCommit,
    onStripeWidthCommit,
    onResetStripes: resetStripes,
    stripesModified,
    sparkleGapsActivePercent,
    sparkleGapsSpeed,
    setSparkleGapsActivePercentLive,
    commitSparkleGapsActivePercent,
    setSparkleGapsSpeedLive,
    commitSparkleGapsSpeed,
    onResetSparkleGaps: resetSparkleGaps,
    sparkleGapsModified,
    sparkleWidthActivePercent,
    sparkleWidthSpeed,
    setSparkleWidthActivePercentLive,
    commitSparkleWidthActivePercent,
    setSparkleWidthSpeedLive,
    commitSparkleWidthSpeed,
    onResetSparkleWidth: resetSparkleWidth,
    sparkleWidthModified,
    flamesConfig,
    onFlamesChange: updateFlamesConfig,
    onFlamesLiveChange: updateFlamesConfigLive,
    onResetFlames: resetFlames,
    flamesModified,
    cursorTrailConfig,
    onCursorTrailChange: updateCursorTrailConfig,
    onCursorTrailLiveChange: updateCursorTrailConfigLive,
    onResetCursorTrail: resetCursorTrail,
    cursorTrailModified,
    clickWaveConfig,
    onClickWaveChange: updateClickWaveConfig,
    onClickWaveLiveChange: updateClickWaveConfigLive,
    onResetClickWave: resetClickWave,
    cursorClickModified,
    revealConfig,
    onRevealChange: updateRevealConfig,
    onRevealWaveLiveChange: updateRevealWaveLive,
    onRevealRandomColumnsLiveChange: updateRevealRandomColumnsLive,
    onResetReveal: resetReveal,
    onReplayReveal: replayReveal,
    revealModified,
    onResetGeneral: resetGeneral,
    generalModified,
  };

  if (!hydrated || loadState.status === "loading") {
    return <p className="p-6 text-[12px] text-builder-muted">Loading texture...</p>;
  }

  if (loadState.status === "error") {
    const fallbackEntry = firstCatalogEntryWithUrl(catalog);
    return (
      <div className={PLAYGROUND_SHELL_CLASS}>
        <main className="flex flex-1 items-center justify-center p-6">
          <p className="m-0 rounded-md border border-builder-hairline bg-white px-3 py-2 text-[12px] text-builder-muted">
            Select a texture from the Leva panel to continue.
          </p>
        </main>
        <PlaygroundLevaControls
          {...playgroundLevaProps}
          loadError={loadState.message}
          fallbackTextureId={fallbackEntry?.id ?? null}
          fallbackTextureLabel={fallbackEntry?.label ?? null}
          onLoadFallbackTexture={fallbackEntry ? () => onTextureSelect(fallbackEntry.id) : undefined}
        />
      </div>
    );
  }

  const { textureId } = loadState;
  // Grid/letter config changes are applied live by the ticker. Texture, media kind, and display
  // size remount Pixi with a fresh canvas (WebGL context cannot be recreated on the same element).
  const sceneKey = `${textureId}-${loadState.kind}-${displayWidth}x${displayHeight}`;
  const isVideoSource = loadState.kind === "video";
  const exportLabel = exportFeedback === "copied" ? "Copied" : exportFeedback === "failed" ? "Copy failed" : "Copy SVG";
  const videoExportTranscodeElapsedMs =
    videoExportTranscodeStartedAtRef.current === null
      ? 0
      : performance.now() - videoExportTranscodeStartedAtRef.current;
  void videoExportEtaTick;
  const videoExportLabel = formatVideoExportStatusLabel(
    videoExportPhase,
    videoExportProgress,
    videoExportTranscodePercent,
    videoExportTranscodeElapsedMs,
  );
  return (
    <div className={PLAYGROUND_SHELL_CLASS}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
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
            canvasRef={setCanvasNode}
            resolveInitOptions={(canvas) => {
              const context = createPlaygroundWebGLContext(canvas);
              preferP3Ref.current = playgroundPrefersDisplayP3(canvas, context);
              if (!context) {
                return {};
              }
              configurePlaygroundGlColorSpace(context);
              return { context: context as WebGL2RenderingContext };
            }}
            onInitialized={(app) => {
              const canvas = canvasRef.current;
              if (canvas) {
                configurePlaygroundCanvasAfterPixiInit(canvas, app);
              }
            }}
            initOptions={{
              preference: "webgl",
              background: 0x000000,
              antialias: false,
              resolution: PLAYGROUND_PIXI_RESOLUTION,
            }}
            tickers={tickers}
          />
        </main>

        <footer
          className="shrink-0 border-t border-builder-hairline bg-builder-surface px-3.5 py-2.5"
          data-testid="playground-bottom-bar"
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className={PLAYGROUND_BUTTON_ROW_CLASS}>
              {isVideoExportBusy ? (
                <Button padding="inline" onClick={onCancelVideoExport}>
                  Cancel
                </Button>
              ) : null}
              <Button
                padding="inline"
                onClick={() => void onExportVideo()}
                disabled={isVideoExportBusy || videoExportPhase === "done"}
              >
                {videoExportLabel}
              </Button>
              <Button padding="inline" onClick={() => setExportReactOpen(true)} disabled={isVideoExportBusy}>
                Export React
              </Button>
              <Button
                padding="inline"
                onClick={() => void onExportSvg()}
                disabled={!duotoneEnabled || !stripesEnabled || isVideoExportBusy}
              >
                {exportLabel}
              </Button>
            </div>
            <div className="flex min-w-0 items-center gap-2" data-testid="playground-playback-controls">
              {isVideoSource ? (
                <>
                  <Button
                    className="flex h-8 w-8 items-center justify-center p-0"
                    onClick={togglePlayPause}
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                  </Button>
                  <span className="w-10 shrink-0 text-right tabular-nums text-[11px] text-builder-control">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.01}
                    value={currentTime}
                    onChange={(event) => onScrub(Number(event.target.value))}
                    className="w-72 max-w-[40vw] min-w-32"
                    aria-label="Texture timeline"
                  />
                  <span className="w-10 shrink-0 tabular-nums text-[11px] text-builder-control">
                    {formatTime(duration)}
                  </span>
                </>
              ) : null}
            </div>
            <div aria-hidden />
          </div>
        </footer>
      </div>

      <PlaygroundLevaControls {...playgroundLevaProps} />

      <ExportReactDialog
        open={exportReactOpen}
        onClose={() => setExportReactOpen(false)}
        snapshot={reactExportSnapshot}
      />
    </div>
  );
}
