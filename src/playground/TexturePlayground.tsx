import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { writeSvgToClipboard } from "../grid/clipboard";
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
  resolvePersistedSourceTransform,
  resolvePersistedTextureAdjustments,
  resolveInitialTextureId,
  revokeUploadObjectUrl,
  saveLastTextureId,
  schedulePersistedConfig,
  type PlaygroundCatalogEntry,
  type PlaygroundPersistedConfig,
} from "./playgroundPersistence";
import type { PlaygroundMediaKind, PlaygroundTextureId } from "./playgroundTextures";
import { HexColorPopover } from "../components/HexColorPopover";
import { ControlValueInput } from "./ControlValueInput";
import { PLAYGROUND_CONTROL_INPUT_BOUNDS, PLAYGROUND_CONTROL_RANGES } from "./playgroundControlRanges";
import { buildPlaygroundBlockGrid, sampleTextureFrame, sampleVideoFrame } from "./samplePlaygroundFrame";
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
import { FieldHelp } from "./FieldHelp";
import { PlaygroundControlSection } from "./PlaygroundControlSection";
import { PLAYGROUND_FIELD_HELP } from "./playgroundFieldHelp";
import { buildPlaygroundExportSnapshot } from "../lib/export/playgroundSnapshot";
import { PlaygroundGridControls } from "./PlaygroundGridControls";
import { PlaygroundFlamesControls } from "./PlaygroundFlamesControls";
import { PlaygroundNumberField } from "./PlaygroundNumberField";
import { PlaygroundTextureControls } from "./PlaygroundTextureControls";
import { PLAYGROUND_SCRUB_COMMIT_MS, useThrottledCallback } from "./playgroundLiveRefs";
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
import { preloadStripeLetterFont } from "./stripeLetterFont";
import {
  cloneDefaultStripes,
  DEFAULT_STRIPES,
  hexToDisplayP3Css,
  STRIPE_START_FROM_MAX,
  STRIPE_START_FROM_MIN,
  STRIPE_WIDTH_MIN,
  STRIPE_WIDTH_STORAGE_MAX,
  updateStripe,
  type Stripe,
  type StripeColors,
} from "./stripeColors";
import {
  applyCanvasBackgroundCss,
  DEFAULT_PLAYGROUND_BACKGROUND_COLOR,
  playgroundBackgroundColorToHex,
} from "./canvasBackgroundCss";
import { shouldToggleStripesFromShortcut } from "./playgroundShortcuts";

/** Bordered grid-cell styling for stripe numeric fields (commit on Enter/blur). */
const STRIPE_FIELD_INPUT_CLASS =
  "h-7 w-full rounded border border-neutral-300 px-1.5 text-right text-xs tabular-nums text-neutral-700 focus:border-neutral-400 focus:outline-none disabled:cursor-not-allowed";

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
    duotoneEnabled: config.duotoneEnabled,
    stripesEnabled: config.stripesEnabled !== false,
    backgroundCss: normalizePlaygroundBackgroundCss(config.backgroundCss),
    backgroundColor: normalizePlaygroundBackgroundColor(config.backgroundColor),
    textureAdjustments: resolvePersistedTextureAdjustments(config),
    sourceTransform: resolvePersistedSourceTransform(config),
    sparkleGapsActivePercent: resolvePersistedSparkleGapsActivePercent(config),
    sparkleGapsSpeed: resolvePersistedSparkleGapsSpeed(config),
    sparkleWidthActivePercent: resolvePersistedSparkleWidthActivePercent(config),
    sparkleWidthSpeed: resolvePersistedSparkleWidthSpeed(config),
    displayWidth: config.displayWidth,
    displayHeight: config.displayHeight,
    grid: resolvePersistedGridConfig(config),
    flames: resolvePersistedFlamesConfig(config),
    stripes: config.stripes.map((stripe) => ({ ...stripe })),
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
  const [sourceTransform, setSourceTransform] = useState<PlaygroundSourceTransform>(appliedInitial.sourceTransform);
  const [sparkleGapsActivePercent, setSparkleGapsActivePercent] = useState(appliedInitial.sparkleGapsActivePercent);
  const [sparkleGapsSpeed, setSparkleGapsSpeed] = useState(appliedInitial.sparkleGapsSpeed);
  const [sparkleWidthActivePercent, setSparkleWidthActivePercent] = useState(appliedInitial.sparkleWidthActivePercent);
  const [sparkleWidthSpeed, setSparkleWidthSpeed] = useState(appliedInitial.sparkleWidthSpeed);
  const [stripes, setStripes] = useState<Stripe[]>(() => appliedInitial.stripes);
  const [gridConfig, setGridConfig] = useState<PlaygroundGridConfig>(appliedInitial.grid);
  const [flamesConfig, setFlamesConfig] = useState<PlaygroundFlamesConfig>(appliedInitial.flames);
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
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const textureGamma = textureAdjustments.gamma;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stripeColorsRef = useRef<StripeColors>({ stripes });
  const gridConfigRef = useRef<PlaygroundGridConfig>(gridConfig);
  const flamesConfigRef = useRef<PlaygroundFlamesConfig>(flamesConfig);
  // Set during render so a scene rebuild (sceneKey change) reads fresh structural values.
  gridConfigRef.current = gridConfig;
  flamesConfigRef.current = flamesConfig;
  const preferP3Ref = useRef(false);
  const duotoneEnabledRef = useRef(duotoneEnabled);
  const stripesEnabledRef = useRef(stripesEnabled);
  const textureGammaRef = useRef(textureGamma);
  const textureAdjustmentsRef = useRef(textureAdjustments);
  const sourceTransformRef = useRef(sourceTransform);
  const sparkleOptionsRef = useRef(playgroundSparkleOptionsFromSliders(sparkleGapsActivePercent, sparkleGapsSpeed));
  const widthShuffleOptionsRef = useRef(
    playgroundWidthShuffleOptionsFromSliders(sparkleWidthActivePercent, sparkleWidthSpeed),
  );
  const flamesStateRef = useRef(createPlaygroundFlamesState());
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

  const persistCurrentConfig = useCallback(() => {
    const config: PlaygroundPersistedConfig = {
      duotoneEnabled,
      stripesEnabled: stripesEnabled ? undefined : false,
      textureAdjustments: isDefaultPlaygroundTextureAdjustments(textureAdjustments) ? undefined : textureAdjustments,
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
      stripes,
    };
    schedulePersistedConfig(selectedTextureId, config);
  }, [
    selectedTextureId,
    duotoneEnabled,
    stripesEnabled,
    textureAdjustments,
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
    stripes,
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
    setDuotoneEnabled(next.duotoneEnabled);
    setStripesEnabled(next.stripesEnabled);
    setBackgroundCss(next.backgroundCss ?? "");
    setBackgroundColor(next.backgroundColor);
    setTextureAdjustments(next.textureAdjustments);
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
    setStripes(next.stripes);
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
    stripeColorsRef.current = { stripes };
  }, [stripes]);

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

  const applyStripePatch = useCallback((id: string, patch: Parameters<typeof updateStripe>[2]) => {
    const next = updateStripe({ stripes: stripeColorsRef.current.stripes }, id, patch).stripes;
    stripeColorsRef.current = { stripes: next };
    return next;
  }, []);

  const onStripeColorChange = useCallback(
    (id: string, hex: string) => {
      const next = applyStripePatch(id, { hex, p3Css: hexToDisplayP3Css(hex) });
      setStripes(next);
    },
    [applyStripePatch],
  );

  const onStripeStartFromCommit = useCallback(
    (id: string, value: number) => {
      const next = applyStripePatch(id, { startFrom: value });
      setStripes(next);
    },
    [applyStripePatch],
  );

  const onStripeWidthCommit = useCallback(
    (id: string, value: number) => {
      const next = applyStripePatch(id, { width: value });
      setStripes(next);
    },
    [applyStripePatch],
  );

  const resetStripes = useCallback(() => {
    setStripesEnabled(true);
    setStripes(cloneDefaultStripes());
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
      const next = normalizePlaygroundFlamesConfig({ ...flamesConfigRef.current, ...patch });
      flamesConfigRef.current = next;
      throttledSetFlamesConfig(next);
    },
    [throttledSetFlamesConfig],
  );

  const updateFlamesConfig = useCallback((patch: Partial<PlaygroundFlamesConfig>) => {
    const next = normalizePlaygroundFlamesConfig({ ...flamesConfigRef.current, ...patch });
    flamesConfigRef.current = next;
    setFlamesConfig(next);
  }, []);

  const resetFlames = useCallback(() => {
    flamesConfigRef.current = { ...DEFAULT_PLAYGROUND_FLAMES_CONFIG };
    flamesStateRef.current = createPlaygroundFlamesState();
    setFlamesConfig({ ...DEFAULT_PLAYGROUND_FLAMES_CONFIG });
  }, []);

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
  const stripesModified =
    !stripesEnabled ||
    !stripesMatchDefault(stripes) ||
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
        message: "No textures available. Upload an image or video to continue.",
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

    void loadPlaygroundSource(entry.url, entry.id, entry.mediaKind).then((next) => {
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
          message: "Could not load the selected texture. Choose another source below.",
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
  }, [hydrated, selectedTextureId, catalog, onTextureSelect]);

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
        sourceTransformRef,
        flamesStateRef,
        flamesConfigRef,
      ),
    ];
  }, [loadState, displayWidth, displayHeight, displaySize, flamesStateRef, flamesConfigRef]);

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
      stripesEnabled: stripesEnabled ? undefined : false,
      textureAdjustments: isDefaultPlaygroundTextureAdjustments(textureAdjustments) ? undefined : textureAdjustments,
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
      stripes,
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
    });
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
          stripesEnabled: stripesEnabled ? undefined : false,
          textureAdjustments: isDefaultPlaygroundTextureAdjustments(textureAdjustments)
            ? undefined
            : textureAdjustments,
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
          stripes,
        },
        displayWidth: displayWidth > 0 ? displayWidth : 640,
        displayHeight: displayHeight > 0 ? displayHeight : 360,
        mediaKind: loadState.status === "ready" ? loadState.kind : "video",
      }),
    [
      duotoneEnabled,
      stripesEnabled,
      textureAdjustments,
      sourceTransform,
      sparkleGapsActivePercent,
      sparkleGapsSpeed,
      sparkleWidthActivePercent,
      sparkleWidthSpeed,
      displayWidth,
      displayHeight,
      stripes,
      loadState,
    ],
  );

  if (!hydrated || loadState.status === "loading") {
    return <p className="p-6 text-sm text-neutral-600">Loading texture…</p>;
  }

  if (loadState.status === "error") {
    const fallbackEntry = firstCatalogEntryWithUrl(catalog);
    return (
      <div className="flex h-dvh overflow-hidden bg-neutral-50">
        <aside className="flex w-60 shrink-0 flex-col gap-4 border-r border-neutral-200 bg-white p-4">
          <h1 className="text-base font-medium text-neutral-900">Texture shader playground</h1>
          <p className="m-0 text-sm text-red-700">{loadState.message}</p>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center gap-1.5 text-neutral-600">
              <FieldHelp label="Texture" description={PLAYGROUND_FIELD_HELP.texture} />
            </span>
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
          {fallbackEntry ? (
            <button
              type="button"
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
              onClick={() => onTextureSelect(fallbackEntry.id)}
            >
              Load {fallbackEntry.label}
            </button>
          ) : null}
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
        </aside>
        <main className="flex flex-1 items-center justify-center p-6">
          <p className="m-0 text-sm text-neutral-600">Select a texture from the sidebar to continue.</p>
        </main>
      </div>
    );
  }

  const { textureId } = loadState;
  // Grid/letter config changes are applied live by the ticker (no remount); only the texture,
  // media kind, and canvas size require a fresh scene.
  const sceneKey = `${textureId}-${loadState.kind}-${displayWidth}x${displayHeight}`;
  const isVideoSource = loadState.kind === "video";
  const stripeControlsDisabled = duotoneControlsDisabled || !stripesEnabled;

  const copyLabel = copyFeedback === "copied" ? "Copied" : copyFeedback === "failed" ? "Copy failed" : "Copy state";
  const importStatus =
    importFeedback === "imported" ? "Imported" : importFeedback === "failed" ? "Import failed" : null;
  const exportLabel = exportFeedback === "copied" ? "Copied" : exportFeedback === "failed" ? "Copy failed" : "Copy SVG";

  return (
    <div className="flex h-dvh overflow-hidden bg-neutral-50">
      <aside className="flex min-h-0 w-60 shrink-0 flex-col gap-4 border-r border-neutral-200 bg-white py-4">
        <div className="shrink-0 px-4">
          <h1 className="text-base font-medium text-neutral-900">Texture shader playground</h1>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            {displayWidth}×{displayHeight}px canvas
            {sourceWidth > 0 && sourceHeight > 0 ? ` · source ${sourceWidth}×${sourceHeight}` : null}
          </p>
        </div>

        <div className="ui-scroll-hidden flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-3 px-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="flex items-center gap-1.5 text-neutral-600">
                <FieldHelp label="Texture" description={PLAYGROUND_FIELD_HELP.texture} />
              </span>
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
                <span className="flex items-center gap-1.5">
                  <FieldHelp label="Width" description={PLAYGROUND_FIELD_HELP.canvasWidth} />
                </span>
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
                <span className="flex items-center gap-1.5">
                  <FieldHelp label="Height" description={PLAYGROUND_FIELD_HELP.canvasHeight} />
                </span>
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
          </div>

          <PlaygroundControlSection
            title="General"
            testId="playground-section-general"
            className="mt-4"
            modified={generalModified}
            onReset={resetGeneral}
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={duotoneEnabled}
                onChange={(event) => setDuotoneEnabled(event.target.checked)}
                className="size-4 cursor-pointer rounded border-neutral-300"
                aria-label="Shader enabled"
              />
              <span className="flex items-center gap-1.5 text-neutral-800">
                <FieldHelp label="Shader enabled" description={PLAYGROUND_FIELD_HELP.shaderEnabled} />
              </span>
            </label>
          </PlaygroundControlSection>

          <PlaygroundTextureControls
            adjustments={textureAdjustments}
            sourceTransform={sourceTransform}
            onAdjustmentsChange={updateTextureAdjustments}
            onLiveAdjustmentsChange={updateTextureAdjustmentsLive}
            onSourceTransformChange={updateSourceTransform}
            onLiveSourceTransformChange={updateSourceTransformLive}
            onResetTone={resetTextureTone}
            onResetSource={resetSourceTransform}
            onResetEffects={resetTextureEffects}
            toneModified={textureToneModified}
            sourceModified={sourceTransformModified}
            effectsModified={textureEffectsModified}
            disabled={duotoneControlsDisabled}
          />

          <PlaygroundControlSection
            title="Background"
            testId="playground-section-background"
            modified={backgroundModified}
            onReset={resetBackground}
          >
            <div
              className={`flex items-center justify-between gap-2 text-sm ${backgroundCssActive ? "opacity-40" : ""}`}
            >
              <span className="flex items-center gap-1.5 text-neutral-600">
                <FieldHelp label="Color" description={PLAYGROUND_FIELD_HELP.backgroundColor} />
              </span>
              <HexColorPopover
                color={playgroundBackgroundColorToHex(backgroundColor)}
                disabled={backgroundCssActive}
                onChange={(hex) => {
                  const parsed = Number.parseInt(hex.replace(/^#/, ""), 16);
                  if (Number.isFinite(parsed)) {
                    setBackgroundColor(parsed & 0xffffff);
                  }
                }}
                ariaLabel="Canvas background color"
                align="right"
                triggerClassName="h-7 w-12 rounded border border-neutral-300"
                triggerStyle={{ backgroundColor: playgroundBackgroundColorToHex(backgroundColor) }}
              />
            </div>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-neutral-700">
              <span className="flex items-center gap-1.5">
                <FieldHelp label="Canvas CSS" description={PLAYGROUND_FIELD_HELP.canvasCss} />
              </span>
              <textarea
                className="min-h-[96px] resize-y rounded border border-neutral-300 px-2 py-1.5 font-mono text-[11px] font-normal text-neutral-700 focus:border-neutral-400 focus:outline-none"
                rows={5}
                value={backgroundCss}
                onChange={(event) => setBackgroundCss(event.target.value)}
                spellCheck={false}
                placeholder={[
                  "background: #D9D9D9;",
                  "background: color(display-p3 0.851 0.851 0.851);",
                  "background-image: linear-gradient(...);",
                ].join("\n")}
                aria-label="Canvas background CSS"
              />
            </label>
            <p className="m-0 text-[11px] leading-4 text-neutral-500">
              {backgroundCssActive
                ? "Canvas CSS overrides the color picker."
                : "Color applies when canvas CSS is empty. Paste CSS declarations to replace it."}
            </p>
          </PlaygroundControlSection>

          <PlaygroundGridControls
            config={gridConfig}
            onChange={updateGrid}
            onLiveChange={updateGridLive}
            onResetGrid={resetGridSection}
            onResetLetters={resetLettersSection}
            gridModified={gridSectionModified}
            lettersModified={lettersSectionModified}
            disabled={duotoneControlsDisabled}
          />

          <PlaygroundControlSection
            title="Stripes"
            testId="playground-section-stripes"
            modified={stripesModified}
            onReset={resetStripes}
          >
            <label className={`flex items-center gap-2 text-sm ${duotoneControlsDisabled ? "opacity-40" : ""}`}>
              <input
                type="checkbox"
                checked={stripesEnabled}
                disabled={duotoneControlsDisabled}
                onChange={(event) => setStripesEnabled(event.target.checked)}
                className="size-4 cursor-pointer rounded border-neutral-300 disabled:cursor-not-allowed"
                aria-label="Stripes enabled"
                aria-keyshortcuts="Shift+S"
              />
              <span className="flex flex-1 items-center justify-between gap-2 text-neutral-800">
                <span className="flex items-center gap-1.5">
                  <FieldHelp label="Stripes enabled" description={PLAYGROUND_FIELD_HELP.stripesEnabled} />
                </span>
                <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-neutral-500">
                  Shift S
                </kbd>
              </span>
            </label>
            <div className={`flex flex-col gap-1.5 ${stripeControlsDisabled ? "opacity-40" : ""}`}>
              {stripes.length === 0 ? (
                <p className="m-0 text-xs text-neutral-500">No stripes.</p>
              ) : (
                <div className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <FieldHelp label="Stripe color" description={PLAYGROUND_FIELD_HELP.stripeColor} />
                  </span>
                  <span className="flex items-center gap-1">
                    <FieldHelp label="Threshold" description={PLAYGROUND_FIELD_HELP.stripeThreshold} />
                  </span>
                  <span className="flex items-center gap-1">
                    <FieldHelp label="Stripe width" description={PLAYGROUND_FIELD_HELP.stripeWidth} />
                  </span>
                </div>
              )}
              {stripes.map((stripe) => (
                <div
                  key={stripe.id}
                  className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2"
                  data-testid="playground-stripe-row"
                >
                  <HexColorPopover
                    color={stripe.hex}
                    disabled={stripeControlsDisabled}
                    onChange={(hex) => onStripeColorChange(stripe.id, hex)}
                    ariaLabel="Stripe color"
                    triggerClassName="playground-stripe-swatch block h-7 w-7 overflow-hidden rounded border border-neutral-200"
                    triggerStyle={
                      {
                        ["--stripe-swatch-fallback" as string]: stripe.hex,
                        ["--stripe-swatch-p3" as string]: stripe.p3Css,
                      } as CSSProperties
                    }
                  />
                  <ControlValueInput
                    value={stripe.startFrom}
                    inputMin={STRIPE_START_FROM_MIN}
                    inputMax={STRIPE_START_FROM_MAX}
                    disabled={stripeControlsDisabled}
                    onChange={(value) => onStripeStartFromCommit(stripe.id, value)}
                    ariaLabel="Stripe start from luminance"
                    title="Start from (0–1 luminance)"
                    className={STRIPE_FIELD_INPUT_CLASS}
                  />
                  <ControlValueInput
                    value={stripe.width}
                    inputMin={STRIPE_WIDTH_MIN}
                    inputMax={STRIPE_WIDTH_STORAGE_MAX}
                    commitMin={STRIPE_WIDTH_MIN}
                    commitMax={STRIPE_WIDTH_STORAGE_MAX}
                    disabled={stripeControlsDisabled}
                    onChange={(value) => onStripeWidthCommit(stripe.id, value)}
                    ariaLabel="Stripe width in px"
                    title="Width (px)"
                    className={STRIPE_FIELD_INPUT_CLASS}
                  />
                </div>
              ))}
            </div>
            <PlaygroundNumberField
              label="Processing interval"
              value={gridConfig.gridUpdateIntervalMs}
              inputMin={0}
              inputMax={1000}
              sliderMin={0}
              sliderMax={300}
              step={1}
              ariaLabel="Stripe processing interval in milliseconds"
              disabled={stripeControlsDisabled}
              onChange={(value) => updateGrid({ gridUpdateIntervalMs: value })}
              onLiveChange={(value) => updateGridLive({ gridUpdateIntervalMs: value })}
              description={PLAYGROUND_FIELD_HELP.processingInterval}
            />
          </PlaygroundControlSection>

          <PlaygroundControlSection
            title="Sparkle Gaps"
            testId="playground-section-sparkle-gaps"
            modified={sparkleGapsModified}
            onReset={resetSparkleGaps}
          >
            <PlaygroundNumberField
              label="Active ratio"
              value={sparkleGapsActivePercent}
              inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.sparkleGapsActivePercent.min}
              inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.sparkleGapsActivePercent.max}
              sliderMin={PLAYGROUND_CONTROL_RANGES.sparkleGapsActivePercent.min}
              sliderMax={PLAYGROUND_CONTROL_RANGES.sparkleGapsActivePercent.max}
              step={PLAYGROUND_CONTROL_RANGES.sparkleGapsActivePercent.step}
              ariaLabel="Sparkle gaps active ratio"
              disabled={duotoneControlsDisabled}
              onChange={commitSparkleGapsActivePercent}
              onLiveChange={setSparkleGapsActivePercentLive}
              formatDisplay={(v) => v.toFixed(2)}
              description={PLAYGROUND_FIELD_HELP.sparkleGapsActiveRatio}
            />
            <PlaygroundNumberField
              label="Speed"
              value={sparkleGapsSpeed}
              inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.sparkleGapsSpeed.min}
              inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.sparkleGapsSpeed.max}
              sliderMin={PLAYGROUND_CONTROL_RANGES.sparkleGapsSpeed.min}
              sliderMax={PLAYGROUND_CONTROL_RANGES.sparkleGapsSpeed.max}
              step={PLAYGROUND_CONTROL_RANGES.sparkleGapsSpeed.step}
              commitMin={PLAYGROUND_CONTROL_RANGES.sparkleGapsSpeed.min}
              commitMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.sparkleGapsSpeed.max}
              ariaLabel="Sparkle gaps pulse speed"
              disabled={duotoneControlsDisabled || sparkleGapsActivePercent <= 0}
              onChange={commitSparkleGapsSpeed}
              onLiveChange={setSparkleGapsSpeedLive}
              formatDisplay={(v) => v.toFixed(2)}
              description={PLAYGROUND_FIELD_HELP.sparkleGapsSpeed}
            />
            <PlaygroundNumberField
              label="Gap period min"
              value={gridConfig.sparkleGapsPeriodMinSec}
              inputMin={0.01}
              inputMax={10}
              sliderMin={0.05}
              sliderMax={2}
              step={0.01}
              ariaLabel="Sparkle gap period minimum seconds"
              disabled={duotoneControlsDisabled}
              onChange={(value) => updateGrid({ sparkleGapsPeriodMinSec: value })}
              onLiveChange={(value) => updateGridLive({ sparkleGapsPeriodMinSec: value })}
              formatDisplay={(v) => v.toFixed(2)}
              description={PLAYGROUND_FIELD_HELP.gapPeriodMin}
            />
            <PlaygroundNumberField
              label="Gap period max"
              value={gridConfig.sparkleGapsPeriodMaxSec}
              inputMin={0.01}
              inputMax={10}
              sliderMin={0.05}
              sliderMax={2}
              step={0.01}
              ariaLabel="Sparkle gap period maximum seconds"
              disabled={duotoneControlsDisabled}
              onChange={(value) => updateGrid({ sparkleGapsPeriodMaxSec: value })}
              onLiveChange={(value) => updateGridLive({ sparkleGapsPeriodMaxSec: value })}
              formatDisplay={(v) => v.toFixed(2)}
              description={PLAYGROUND_FIELD_HELP.gapPeriodMax}
            />
          </PlaygroundControlSection>

          <PlaygroundControlSection
            title="Sparkle Width"
            testId="playground-section-sparkle-width"
            modified={sparkleWidthModified}
            onReset={resetSparkleWidth}
          >
            <PlaygroundNumberField
              label="Active ratio"
              value={sparkleWidthActivePercent}
              inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.sparkleWidthActivePercent.min}
              inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.sparkleWidthActivePercent.max}
              sliderMin={PLAYGROUND_CONTROL_RANGES.sparkleWidthActivePercent.min}
              sliderMax={PLAYGROUND_CONTROL_RANGES.sparkleWidthActivePercent.max}
              step={PLAYGROUND_CONTROL_RANGES.sparkleWidthActivePercent.step}
              ariaLabel="Sparkle width active ratio"
              disabled={duotoneControlsDisabled}
              onChange={commitSparkleWidthActivePercent}
              onLiveChange={setSparkleWidthActivePercentLive}
              formatDisplay={(v) => v.toFixed(2)}
              description={PLAYGROUND_FIELD_HELP.sparkleWidthActiveRatio}
            />
            <PlaygroundNumberField
              label="Speed"
              value={sparkleWidthSpeed}
              inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.sparkleWidthSpeed.min}
              inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.sparkleWidthSpeed.max}
              sliderMin={PLAYGROUND_CONTROL_RANGES.sparkleWidthSpeed.min}
              sliderMax={PLAYGROUND_CONTROL_RANGES.sparkleWidthSpeed.max}
              step={PLAYGROUND_CONTROL_RANGES.sparkleWidthSpeed.step}
              commitMin={PLAYGROUND_CONTROL_RANGES.sparkleWidthSpeed.min}
              commitMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.sparkleWidthSpeed.max}
              ariaLabel="Sparkle width pulse speed"
              disabled={duotoneControlsDisabled || sparkleWidthActivePercent <= 0}
              onChange={commitSparkleWidthSpeed}
              onLiveChange={setSparkleWidthSpeedLive}
              formatDisplay={(v) => v.toFixed(2)}
              description={PLAYGROUND_FIELD_HELP.sparkleWidthSpeed}
            />
            <PlaygroundNumberField
              label="Width swing"
              value={gridConfig.widthShuffleSwing}
              inputMin={0}
              inputMax={32}
              sliderMin={0}
              sliderMax={8}
              step={0.05}
              ariaLabel="Width shuffle swing in px"
              disabled={duotoneControlsDisabled}
              onChange={(value) => updateGrid({ widthShuffleSwing: value })}
              onLiveChange={(value) => updateGridLive({ widthShuffleSwing: value })}
              formatDisplay={(v) => v.toFixed(2)}
              description={PLAYGROUND_FIELD_HELP.widthSwing}
            />
            <PlaygroundNumberField
              label="Width period min"
              value={gridConfig.sparkleWidthPeriodMinSec}
              inputMin={0.01}
              inputMax={10}
              sliderMin={0.05}
              sliderMax={2}
              step={0.01}
              ariaLabel="Width shuffle period minimum seconds"
              disabled={duotoneControlsDisabled}
              onChange={(value) => updateGrid({ sparkleWidthPeriodMinSec: value })}
              onLiveChange={(value) => updateGridLive({ sparkleWidthPeriodMinSec: value })}
              formatDisplay={(v) => v.toFixed(2)}
              description={PLAYGROUND_FIELD_HELP.widthPeriodMin}
            />
            <PlaygroundNumberField
              label="Width period max"
              value={gridConfig.sparkleWidthPeriodMaxSec}
              inputMin={0.01}
              inputMax={10}
              sliderMin={0.05}
              sliderMax={2}
              step={0.01}
              ariaLabel="Width shuffle period maximum seconds"
              disabled={duotoneControlsDisabled}
              onChange={(value) => updateGrid({ sparkleWidthPeriodMaxSec: value })}
              onLiveChange={(value) => updateGridLive({ sparkleWidthPeriodMaxSec: value })}
              formatDisplay={(v) => v.toFixed(2)}
              description={PLAYGROUND_FIELD_HELP.widthPeriodMax}
            />
          </PlaygroundControlSection>

          <PlaygroundFlamesControls
            config={flamesConfig}
            onChange={updateFlamesConfig}
            onLiveChange={updateFlamesConfigLive}
            onReset={resetFlames}
            modified={flamesModified}
            disabled={duotoneControlsDisabled}
          />

          <div className="mt-4 flex flex-col gap-3 border-t border-neutral-200 px-4 pt-4">
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
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-4 overflow-hidden p-6">
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
            applyPlaygroundDrawingBufferColorSpace(context);
            return { context: context as WebGL2RenderingContext };
          }}
          initOptions={{
            preference: "webgl",
            background: 0x000000,
            antialias: false,
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
                disabled={!duotoneEnabled || !stripesEnabled}
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
