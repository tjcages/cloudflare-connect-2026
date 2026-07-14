import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createStripesEngine,
  createManualClock,
  createRealClock,
  normalizeEngineConfig,
  type StripesEngine,
  type PerfSnapshot,
  type EngineConfig,
} from "@necatikcl/stripes-engine";
import { LevaPanel } from "leva";
import { Play, Pause } from "lucide-react";
import { PerfOverlay } from "./PerfOverlay";
import { useEngineControls } from "./controls/levaSchema";
import { LAB_LEVA_THEME } from "./controls/levaTheme";
import {
  DEFAULT_LAB_SETTINGS,
  saveConfig,
  saveTextureId,
  importSettingsFile,
  deleteConfig,
  serializeConfigFile,
  loadLabSettings,
  saveLabSettings,
  factoryResetSettings,
  type LabSettings,
} from "./persistence";
import { DEFAULT_LAB_TEXTURE_ID, LAB_TEXTURES, findTextureEntry, loadFileSource, loadTextureSource } from "./textures";
import type { LabTextureKind, LoadedTextureSource } from "./textures";
import { addUpload, loadManifest, removeUpload, saveManifest } from "./uploads";
import { addPreset, loadPresets, removePreset, savePresets, type ConfigPreset } from "./presets";
import { putTextureBlob, deleteTextureBlob, clearTextureBlobs } from "./textureStore";
import { cellGridToSvg, downloadSvg } from "./export/cellGridToSvg";
import { exportLabVideo } from "./export/videoExport";
import { CONTROL_DRAWER_IDS, saveControlDrawerOpen, saveControlDrawerSnapshot } from "./controls/drawerState";
import { DEFAULT_LAB_ENGINE_CONFIG } from "./defaultLabConfig";
import { intToHex } from "./lib/color";

function num(params: URLSearchParams, key: string, dflt: number): number {
  const v = params.get(key);
  return v == null ? dflt : Number(v);
}

/** HUD (perf overlay, sidebar, bottom bar) is on unless `?hud=0` — `?hud=0` renders only the bare canvas for visual goldens. */
function hudEnabled(): boolean {
  return new URLSearchParams(window.location.search).get("hud") !== "0";
}

function formatTime(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const LUMINANCE_SAMPLE_MAX_SIDE = 192;
const VIDEO_LUMINANCE_SAMPLE_COUNT = 16;
const CANVAS_PREVIEW_ZOOM_MIN = 0.25;
const CANVAS_PREVIEW_ZOOM_MAX = 4;
const CANVAS_PREVIEW_ZOOM_STEP = 0.1;
const CONTROL_DRAWER_ID_SET = new Set<string>(CONTROL_DRAWER_IDS);

function clampPreviewZoom(value: number): number {
  return Math.min(CANVAS_PREVIEW_ZOOM_MAX, Math.max(CANVAS_PREVIEW_ZOOM_MIN, Number(value.toFixed(2))));
}

function findLevaFolderTitle(target: EventTarget | null): HTMLElement | null {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    const label = el.children[1]?.textContent?.trim();
    if (el.children[0]?.tagName.toLowerCase() === "svg" && label && CONTROL_DRAWER_ID_SET.has(label))
      return el as HTMLElement;
    el = el.parentElement;
  }
  return null;
}

function isLevaFolderOpen(title: HTMLElement): boolean {
  const wrapper = title.nextElementSibling as HTMLElement | null;
  if (!wrapper) return false;
  return wrapper.style.height !== "0px";
}

function computeCanvasSize(srcW: number, srcH: number): { cssW: number; cssH: number } {
  if (srcW <= 0 || srcH <= 0) return { cssW: 400, cssH: 300 };
  return { cssW: Math.round(srcW), cssH: Math.round(srcH) };
}

function computeLabCanvasSize(srcW: number, srcH: number, settings: LabSettings): { cssW: number; cssH: number } {
  const base = computeCanvasSize(srcW, srcH);
  const scale = Number.isFinite(settings.canvasScale) ? Math.max(0.1, Math.min(8, settings.canvasScale)) : 1;
  return {
    cssW: Math.max(1, Math.round(base.cssW * scale)),
    cssH: Math.max(1, Math.round(base.cssH * scale)),
  };
}

function pointerToEnginePoint(canvas: HTMLCanvasElement, e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const engineW = Number.parseFloat(canvas.style.width) || rect.width || 1;
  const engineH = Number.parseFloat(canvas.style.height) || rect.height || 1;
  return {
    x: ((e.clientX - rect.left) * engineW) / Math.max(1, rect.width),
    y: ((e.clientY - rect.top) * engineH) / Math.max(1, rect.height),
  };
}

function sourceDimensions(
  source: LoadedTextureSource["source"],
  video: HTMLVideoElement | null,
): { w: number; h: number } {
  if (video) return { w: video.videoWidth || 0, h: video.videoHeight || 0 };
  if (source instanceof HTMLImageElement)
    return { w: source.naturalWidth || source.width || 0, h: source.naturalHeight || source.height || 0 };
  if (source instanceof HTMLCanvasElement) return { w: source.width || 0, h: source.height || 0 };
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap)
    return { w: source.width || 0, h: source.height || 0 };
  return { w: 0, h: 0 };
}

type LuminanceRange = { blackPoint: number; whitePoint: number };
type LuminanceAccumulator = { min: number; max: number; seen: number };

function createLuminanceAccumulator(): LuminanceAccumulator {
  return { min: 1, max: 0, seen: 0 };
}

function finalizeLuminanceRange(range: LuminanceAccumulator): LuminanceRange | null {
  if (range.seen === 0) return null;
  if (range.max - range.min < 0.01) return { blackPoint: 0, whitePoint: 1 };
  return {
    blackPoint: Math.max(0, Math.min(0.99, Number(range.min.toFixed(3)))),
    whitePoint: Math.max(0.01, Math.min(1, Number(range.max.toFixed(3)))),
  };
}

function accumulateCanvasLuminance(pixels: Uint8ClampedArray, range: LuminanceAccumulator): void {
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] ?? 255;
    if (alpha < 8) continue;
    const r = (pixels[i] ?? 0) / 255;
    const g = (pixels[i + 1] ?? 0) / 255;
    const b = (pixels[i + 2] ?? 0) / 255;
    const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
    range.min = Math.min(range.min, luminance);
    range.max = Math.max(range.max, luminance);
    range.seen++;
  }
}

function createLuminanceSampler(dims: { w: number; h: number }): {
  sample(source: CanvasImageSource, range: LuminanceAccumulator): void;
} | null {
  if (dims.w <= 0 || dims.h <= 0) return null;

  const scale = Math.min(1, LUMINANCE_SAMPLE_MAX_SIDE / Math.max(dims.w, dims.h));
  const w = Math.max(1, Math.round(dims.w * scale));
  const h = Math.max(1, Math.round(dims.h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  return {
    sample(source: CanvasImageSource, range: LuminanceAccumulator) {
      ctx.drawImage(source, 0, 0, w, h);
      accumulateCanvasLuminance(ctx.getImageData(0, 0, w, h).data, range);
    },
  };
}

function waitForVideoSeek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, 750);
    video.addEventListener("seeked", finish, { once: true });
    video.currentTime = time;
    if (Math.abs(video.currentTime - time) < 0.02 && video.readyState >= 2) finish();
  });
}

async function detectSourceLuminanceRange(loaded: LoadedTextureSource): Promise<LuminanceRange | null> {
  const dims =
    loaded.width > 0 && loaded.height > 0
      ? { w: loaded.width, h: loaded.height }
      : sourceDimensions(loaded.source, loaded.video);
  const sampler = createLuminanceSampler(dims);
  if (!sampler) return null;

  const range = createLuminanceAccumulator();
  const video = loaded.video;

  try {
    if (!video) {
      sampler.sample(loaded.source as CanvasImageSource, range);
      return finalizeLuminanceRange(range);
    }

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const wasPaused = video.paused;
    const previousTime = video.currentTime || 0;
    const maxTime = Math.max(0, duration - 0.05);
    video.pause();

    try {
      const sampleCount = duration > 0 ? VIDEO_LUMINANCE_SAMPLE_COUNT : 1;
      for (let i = 0; i < sampleCount; i++) {
        const t = sampleCount <= 1 ? previousTime : (maxTime * i) / (sampleCount - 1);
        await waitForVideoSeek(video, t);
        sampler.sample(video, range);
      }
    } finally {
      await waitForVideoSeek(video, Math.max(0, Math.min(previousTime, maxTime || previousTime)));
      if (!wasPaused) void video.play().catch(() => {});
    }

    return finalizeLuminanceRange(range);
  } catch {
    return null;
  }
}

function downloadTextFile(text: string, filename: string, type = "application/json"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function settingsFilename(textureId: string): string {
  const safeId = textureId.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "texture";
  return `stripes-settings-${safeId}.json`;
}

function LabCanvasSizeControls({
  sourceWidth,
  sourceHeight,
  settings,
  onSettings,
}: {
  sourceWidth: number;
  sourceHeight: number;
  settings: LabSettings;
  onSettings: (next: Partial<LabSettings>) => void;
}) {
  const { cssW, cssH } = computeLabCanvasSize(sourceWidth, sourceHeight, settings);
  const disabled = sourceWidth <= 0 || sourceHeight <= 0;
  const scaleOptions = [0.25, 0.5, 1, 2, 3];
  const activeScale = Number.isFinite(settings.canvasScale) ? settings.canvasScale : 1;

  return (
    <section className="playground-canvas-size-controls">
      <div className="playground-canvas-size-row">
        <div>
          <span className="playground-canvas-scale-label">Canvas scale</span>
        </div>
        <div className="playground-canvas-scale-controls">
          <div className="playground-canvas-scale-buttons">
            {scaleOptions.map((scale) => (
              <button
                key={scale}
                type="button"
                className={Math.abs(activeScale - scale) < 0.001 ? "is-active" : ""}
                disabled={disabled}
                onClick={() => onSettings({ canvasMode: "scale", canvasScale: scale })}
              >
                {scale}x
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="playground-canvas-size-row">
        <div>
          <span className="playground-canvas-scale-label">Canvas size</span>
        </div>
        <div>
          <span className="playground-canvas-source-size">{disabled ? "— × —" : `${cssW} × ${cssH}`}</span>
        </div>
      </div>
    </section>
  );
}

function LabExportControls({
  videoEl,
  settings,
  onSettings,
}: {
  videoEl: HTMLVideoElement | null;
  settings: LabSettings;
  onSettings: (next: Partial<LabSettings>) => void;
}) {
  const videoDuration = videoEl?.duration && Number.isFinite(videoEl.duration) ? videoEl.duration : 0;
  const setNumber = (key: keyof Pick<LabSettings, "exportStartSec" | "exportDurationSec">, value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    onSettings({ [key]: parsed } as Partial<LabSettings>);
  };

  return (
    <section className="playground-canvas-size-controls">
      <div className="playground-canvas-size-row">
        <div>
          <span className="playground-canvas-scale-label">Export video</span>
        </div>
        <div>
          <span className="playground-canvas-scale-label">
            {videoEl ? `Source ${formatTime(videoDuration)}` : "Image loop"}
          </span>
        </div>
      </div>
      {videoEl ? (
        <div className="playground-canvas-size-row">
          <div>
            <span className="playground-canvas-scale-label">Start second</span>
          </div>
          <div>
            <input
              className="lab-input"
              type="number"
              min={0}
              max={Math.max(0, videoDuration)}
              step={0.1}
              value={settings.exportStartSec}
              onChange={(e) => setNumber("exportStartSec", e.target.value)}
            />
          </div>
        </div>
      ) : null}
      <div className="playground-canvas-size-row">
        <div>
          <span className="playground-canvas-scale-label">Duration second</span>
        </div>
        <div>
          <input
            className="lab-input"
            type="number"
            min={0.1}
            max={videoEl ? Math.max(0.1, videoDuration) : 3600}
            step={0.1}
            value={settings.exportDurationSec}
            onChange={(e) => setNumber("exportDurationSec", e.target.value)}
          />
        </div>
      </div>
    </section>
  );
}

function LabBottomBar({ videoEl }: { videoEl: HTMLVideoElement | null }) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!videoEl) {
      setPlaying(false);
      setCurrent(0);
      setDuration(0);
      return;
    }
    const onTime = () => setCurrent(videoEl.currentTime);
    const onMeta = () => setDuration(videoEl.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    videoEl.addEventListener("timeupdate", onTime);
    videoEl.addEventListener("loadedmetadata", onMeta);
    videoEl.addEventListener("play", onPlay);
    videoEl.addEventListener("pause", onPause);
    setDuration(videoEl.duration || 0);
    setCurrent(videoEl.currentTime);
    setPlaying(!videoEl.paused);
    return () => {
      videoEl.removeEventListener("timeupdate", onTime);
      videoEl.removeEventListener("loadedmetadata", onMeta);
      videoEl.removeEventListener("play", onPlay);
      videoEl.removeEventListener("pause", onPause);
    };
  }, [videoEl]);

  return (
    <footer className="lab-bottom-bar">
      <div className="lab-bottom-grid">
        <div aria-hidden />
        {videoEl ? (
          <div className="lab-playback">
            <button
              className="lab-btn"
              style={{ width: 32, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => {
                if (videoEl.paused) void videoEl.play();
                else videoEl.pause();
              }}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <span className="lab-time" style={{ textAlign: "right" }}>
              {formatTime(current)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={current}
              onChange={(e) => {
                videoEl.currentTime = Number(e.target.value);
              }}
              aria-label="Texture timeline"
            />
            <span className="lab-time">{formatTime(duration)}</span>
          </div>
        ) : (
          <div />
        )}
        <div aria-hidden />
      </div>
    </footer>
  );
}

function LabInner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const configFileInputRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<StripesEngine | null>(null);
  const manualRef = useRef(false);
  const uploadObjectUrlRef = useRef<string | null>(null);
  const prevVideoRef = useRef<HTMLVideoElement | null>(null);
  const textureLoadSeqRef = useRef(0);
  const [snap, setSnap] = useState<PerfSnapshot>({
    fps: 0,
    frameMs: { p50: 0, p95: 0, p99: 0 },
    passMs: {},
    sampleCount: 0,
  });
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  videoElRef.current = videoEl;
  const [sourcePreview, setSourcePreview] = useState<LoadedTextureSource | null>(null);
  const [sourceSize, setSourceSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [labSettings, setLabSettings] = useState<LabSettings>(() => ({
    ...loadLabSettings(),
    canvasScale: DEFAULT_LAB_SETTINGS.canvasScale,
  }));
  const [previewZoom, setPreviewZoom] = useState(1);
  const [mouseZoomEnabled, setMouseZoomEnabled] = useState(true);
  const [presets, setPresets] = useState<ConfigPreset[]>(() => loadPresets());
  const [selectedPreset, setSelectedPreset] = useState("");
  const sourceSizeRef = useRef(sourceSize);
  sourceSizeRef.current = sourceSize;
  const labSettingsRef = useRef(labSettings);
  labSettingsRef.current = labSettings;

  useEffect(() => {
    const onFolderClick = (event: MouseEvent) => {
      const title = findLevaFolderTitle(event.target);
      if (!title) return;
      const label = title.children[1]?.textContent?.trim();
      if (!label) return;
      window.setTimeout(() => {
        saveControlDrawerOpen(label, isLevaFolderOpen(title));
      }, 100);
    };

    document.addEventListener("click", onFolderClick, true);
    return () => document.removeEventListener("click", onFolderClick, true);
  }, []);

  const updateLabSettings = useCallback((next: Partial<LabSettings>) => {
    setLabSettings((prev) => {
      const merged = { ...prev, ...next };
      saveLabSettings(merged);
      return { ...loadLabSettings(), canvasScale: merged.canvasScale };
    });
  }, []);

  const updatePreviewZoom = useCallback((next: number | ((current: number) => number)) => {
    setPreviewZoom((current) => clampPreviewZoom(typeof next === "function" ? next(current) : next));
  }, []);

  useEffect(() => {
    const area = canvasAreaRef.current;
    if (!area) return;
    const onWheel = (event: WheelEvent) => {
      if (!mouseZoomEnabled) return;
      event.preventDefault();
      updatePreviewZoom(
        (current) => current + (event.deltaY < 0 ? CANVAS_PREVIEW_ZOOM_STEP : -CANVAS_PREVIEW_ZOOM_STEP),
      );
    };
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  }, [mouseZoomEnabled, updatePreviewZoom]);

  const hud = hudEnabled();
  const manual = useMemo(() => new URLSearchParams(window.location.search).get("manual") === "1", []);
  const shell = hud && !manual;

  const onReplayRef = useRef<() => void>(() => {});
  const onReplay = useCallback(() => onReplayRef.current(), []);
  const onExportSvgRef = useRef<() => void>(() => {});
  const onExportSvg = useCallback(() => onExportSvgRef.current(), []);
  const onExportVideoRef = useRef<() => void>(() => {});
  const onExportVideo = useCallback(() => onExportVideoRef.current(), []);
  const exportingVideoRef = useRef(false);
  const videoExportAbortRef = useRef<AbortController | null>(null);
  const {
    config: controls,
    backgroundFillMode,
    setControl,
    getLabSettingsSnapshot,
    textureId,
    setTextureId,
    textureOptions,
    textureStore,
    shaderStore,
  } = useEngineControls(onReplay);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const setControlRef = useRef(setControl);
  setControlRef.current = setControl;
  const textureIdRef = useRef(textureId);
  textureIdRef.current = textureId;
  const selectedEntry = useMemo(() => findTextureEntry(textureId, loadManifest()), [textureId]);
  const canDeleteTexture = selectedEntry?.origin === "upload";

  function handleDeleteTexture() {
    const manifest = loadManifest();
    const entry = findTextureEntry(textureId, manifest);
    if (!entry || entry.origin !== "upload") return;
    saveManifest(removeUpload(manifest, entry.id));
    void deleteTextureBlob(entry.id);
    deleteConfig(entry.id);
    saveTextureId(DEFAULT_LAB_TEXTURE_ID);
    window.location.reload();
  }

  const stripesEnabledRef = useRef(controls.stripesEnabled);
  stripesEnabledRef.current = controls.stripesEnabled;
  const revealEnabledRef = useRef(controls.reveal.enabled);
  revealEnabledRef.current = controls.reveal.enabled;

  const applyCanvasSize = useCallback(
    (engine: StripesEngine, canvas: HTMLCanvasElement, src: { w: number; h: number }, settings: LabSettings) => {
      if (src.w <= 0 || src.h <= 0) return;
      const { cssW, cssH } = computeLabCanvasSize(src.w, src.h, settings);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      engine.resize(cssW, cssH);
    },
    [],
  );

  const loadTextureById = useCallback(
    (id: string) => {
      if (manualRef.current) return;
      const engine = engineRef.current;
      if (!engine) return;
      const seq = ++textureLoadSeqRef.current;
      if (prevVideoRef.current) {
        prevVideoRef.current.pause();
        prevVideoRef.current = null;
      }
      const entry = findTextureEntry(id, loadManifest()) ?? LAB_TEXTURES[0];
      loadTextureSource(entry)
        .then((loaded) => {
          if (seq !== textureLoadSeqRef.current) {
            if (loaded.video) loaded.video.pause();
            if (loaded.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
            return;
          }
          try {
            applyLoadedSource(loaded);
            if (revealEnabledRef.current) engine.triggerReveal();
          } catch (error) {
            console.error("Failed to apply texture.", error);
          }
        })
        .catch((error) => {
          console.error("Failed to load texture.", error);
          if (seq !== textureLoadSeqRef.current) return;
          if (id !== DEFAULT_LAB_TEXTURE_ID) {
            saveManifest(removeUpload(loadManifest(), id));
            saveTextureId(DEFAULT_LAB_TEXTURE_ID);
            setTextureId(DEFAULT_LAB_TEXTURE_ID);
          }
        });
    },
    [setTextureId],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const params = new URLSearchParams(window.location.search);
    manualRef.current = manual;
    const clock = manual ? createManualClock(0) : createRealClock();

    const engine: StripesEngine = createStripesEngine(canvas, {
      clock,
      seed: num(params, "seed", 1),
      dpr: params.has("dpr") ? num(params, "dpr", 1) : undefined,
      fieldScale: params.has("fieldScale") ? num(params, "fieldScale", 0.5) : undefined,
    });
    engineRef.current = engine;

    if (!shell) {
      const cssW = num(params, "w", window.innerWidth);
      const cssH = num(params, "h", window.innerHeight);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      engine.resize(cssW, cssH);
    }

    onReplayRef.current = () => engine.triggerReveal();

    const buildExportSvg = (): string => {
      const cfg = controlsRef.current;
      const readback = engine.readCellGrid();
      const canvasWidthPx = Math.round(Number.parseFloat(canvas.style.width) || canvas.clientWidth || canvas.width);
      const canvasHeightPx = Math.round(Number.parseFloat(canvas.style.height) || canvas.clientHeight || canvas.height);
      const stripes = cfg.stripes.map((s) => ({
        hex: intToHex(s.color),
        startFrom: s.startFrom,
        width: s.width,
        opacity: s.opacity,
      }));
      return cellGridToSvg(readback, stripes, {
        cellWidthPx: cfg.grid.cellWidth,
        cellHeightPx: cfg.grid.cellHeight,
        gapX: cfg.grid.gapX,
        gapY: cfg.grid.gapY,
        useCellColors: readback.colors !== null,
        orientation: cfg.grid.orientation,
        angleDeg: cfg.grid.angleDeg,
        rotationMode: cfg.grid.rotationMode,
        backgroundHex:
          cfg.background.transparent || cfg.background.gradient.enabled ? undefined : intToHex(cfg.background.color),
        letters: cfg.letters,
        blendMode: cfg.colors.stripeBlendMode,
        backgroundGradient:
          !cfg.background.transparent && cfg.background.gradient.enabled
            ? {
                direction: cfg.background.gradient.direction,
                stopCount: cfg.background.gradient.stopCount,
                stops: cfg.background.gradient.stops.map(intToHex),
              }
            : undefined,
        canvasWidthPx,
        canvasHeightPx,
      });
    };
    onExportSvgRef.current = () => {
      const cfg = controlsRef.current;
      if (!cfg.stripesEnabled) {
        window.alert("Enable stripes before exporting an SVG.");
        return;
      }
      downloadSvg(buildExportSvg());
    };

    onExportVideoRef.current = () => {
      const targetCanvas = canvasRef.current;
      if (!targetCanvas) return;
      if (exportingVideoRef.current) return;
      const video = videoElRef.current;
      const requestedStart = labSettingsRef.current.exportStartSec;
      const requestedDuration = labSettingsRef.current.exportDurationSec;
      const videoDuration = video?.duration && Number.isFinite(video.duration) ? video.duration : 0;
      const exportStartSec = video ? Math.min(requestedStart, Math.max(0, videoDuration - 0.1)) : 0;
      const durationSec = video
        ? Math.max(0.1, Math.min(requestedDuration, Math.max(0.1, videoDuration - exportStartSec)))
        : requestedDuration;
      if (durationSec > 60 && !window.confirm(`Export ~${Math.round(durationSec)}s of video? This may take a while.`)) {
        return;
      }
      const controller = new AbortController();
      videoExportAbortRef.current = controller;
      exportingVideoRef.current = true;
      void exportLabVideo({
        canvas: targetCanvas,
        sourceKind: video ? "video" : "image",
        video: video ?? undefined,
        backgroundColor: controlsRef.current.background.transparent ? undefined : controlsRef.current.background.color,
        startTimeSec: exportStartSec,
        durationSec,
        signal: controller.signal,
      })
        .catch(() => {})
        .finally(() => {
          exportingVideoRef.current = false;
          videoExportAbortRef.current = null;
        });
    };

    (window as unknown as { __lab: unknown }).__lab = {
      engine,
      clock,
      exportSvg: () => buildExportSvg(),
      renderAt: (ms: number) => {
        if (manual && "set" in clock) (clock as { set(n: number): void }).set(ms);
        engine.renderFrame();
      },
      snapshot: () => engine.getPerf(),
      setConfig: (c: Partial<EngineConfig>) => {
        engine.setConfig(c);
        if (manual) engine.renderFrame();
      },
      cursorTo: (x: number | null, y?: number) => engine.setCursor(x, y),
      clickAt: (x: number, y?: number) => engine.click(x, y),
      triggerReveal: () => engine.triggerReveal(),
    };

    let raf = 0;
    if (!manual) {
      engine.start();
      loadTextureById(textureIdRef.current);
      const tick = () => {
        setSnap(engine.getPerf());
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      engine.renderFrame();
      setSnap(engine.getPerf());
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (!e.shiftKey) return;
      if (e.key !== "s" && e.key !== "S") return;
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable)
        return;
      e.preventDefault();
      setControlRef.current({ stripesEnabled: !stripesEnabledRef.current });
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (uploadObjectUrlRef.current) {
        URL.revokeObjectURL(uploadObjectUrlRef.current);
        uploadObjectUrlRef.current = null;
      }
      textureLoadSeqRef.current++;
      engine.dispose();
      engineRef.current = null;
      (window as unknown as { __lab?: unknown }).__lab = undefined;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!shell) return;
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    applyCanvasSize(engine, canvas, sourceSizeRef.current, labSettings);
  }, [labSettings, shell, applyCanvasSize]);

  useEffect(() => {
    if (manual) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e: PointerEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const point = pointerToEnginePoint(canvas, e);
      engine.setCursor(point.x, point.y);
    };
    const onLeave = () => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setCursor(null);
    };
    const onDown = (e: PointerEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const point = pointerToEnginePoint(canvas, e);
      engine.click(point.x, point.y);
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [manual]);

  const lastSavedConfigRef = useRef<string | null>(null);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const configToApply = manualRef.current
      ? { ...controls, reveal: { ...controls.reveal, enabled: false } }
      : controls;
    engine.setConfig(configToApply);
    const saveKey = `${textureId}\n${JSON.stringify(controls)}`;
    if (lastSavedConfigRef.current !== saveKey) {
      lastSavedConfigRef.current = saveKey;
      saveConfig(textureId, controls);
    }
    if (manualRef.current) engine.renderFrame();
  }, [controls, textureId]);

  useEffect(() => {
    setLabSettings((prev) => {
      const backgroundColor = controls.background.transparent ? null : controls.background.color;
      const uiSnapshot = getLabSettingsSnapshot();
      const next = { ...prev, ...uiSnapshot, backgroundColor };
      const unchanged = JSON.stringify({ ...prev, ...uiSnapshot, backgroundColor }) === JSON.stringify(prev);
      if (unchanged) return prev;
      saveLabSettings(next);
      return { ...loadLabSettings(), canvasScale: next.canvasScale };
    });
  }, [controls.background.color, controls.background.transparent, getLabSettingsSnapshot]);

  useEffect(() => {
    saveTextureId(textureId);
    saveLabSettings({ ...labSettingsRef.current, ...getLabSettingsSnapshot(), textureId });
    loadTextureById(textureId);
  }, [textureId, getLabSettingsSnapshot, loadTextureById]);

  function applyLoadedSource(loaded: LoadedTextureSource) {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine) return;
    if (uploadObjectUrlRef.current) URL.revokeObjectURL(uploadObjectUrlRef.current);
    uploadObjectUrlRef.current = loaded.objectUrl;
    engine.setSource(loaded.source);
    prevVideoRef.current = loaded.video;
    setVideoEl(loaded.video);
    setSourcePreview(loaded);
    if (shell) {
      const { w: srcW, h: srcH } =
        loaded.width > 0 && loaded.height > 0
          ? { w: loaded.width, h: loaded.height }
          : sourceDimensions(loaded.source, loaded.video);
      if (srcW > 0 && srcH > 0) {
        const src = { w: srcW, h: srcH };
        setSourceSize(src);
        if (canvas) applyCanvasSize(engine, canvas, src, labSettingsRef.current);
      }
    }
    const levelsSeq = textureLoadSeqRef.current;
    void detectSourceLuminanceRange(loaded).then((luminanceRange) => {
      if (levelsSeq !== textureLoadSeqRef.current || !luminanceRange) return;
      try {
        setControlRef.current(luminanceRange);
        if (manualRef.current) engine.renderFrame();
      } catch (error) {
        console.warn("Couldn't apply detected texture levels.", error);
      }
    });
    if (manualRef.current) engine.renderFrame();
  }

  function fullLabSettingsSnapshot(): Partial<LabSettings> {
    return { ...labSettingsRef.current, ...getLabSettingsSnapshot() };
  }

  function applyImportedSettings(text: string): void {
    const imported = importSettingsFile(text);
    const importedTextureId = imported.lab?.textureId;
    const targetTextureId =
      importedTextureId && findTextureEntry(importedTextureId, loadManifest())
        ? importedTextureId
        : textureIdRef.current;
    saveConfig(targetTextureId, normalizeEngineConfig(imported.config));
    if (imported.lab) {
      saveLabSettings(imported.lab);
      saveControlDrawerSnapshot(imported.lab.drawerOpen);
      if (targetTextureId !== textureIdRef.current || importedTextureId) saveTextureId(targetTextureId);
    }
  }

  function handleExport() {
    void navigator.clipboard.writeText(serializeConfigFile(controls, fullLabSettingsSnapshot()));
  }

  function handleDownloadConfig() {
    downloadTextFile(serializeConfigFile(controls, fullLabSettingsSnapshot()), settingsFilename(textureIdRef.current));
  }

  function handleImport() {
    const text = window.prompt("Paste config JSON:");
    if (!text) return;
    try {
      applyImportedSettings(text);
      window.location.reload();
    } catch {
      window.alert("Invalid config JSON.");
    }
  }

  async function handleConfigFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      applyImportedSettings(text);
      window.location.reload();
    } catch {
      window.alert("Invalid config JSON.");
    }
  }

  function handleResetSettings() {
    if (!window.confirm("Reset settings for this texture?")) return;
    deleteConfig(textureIdRef.current);
    saveConfig(textureIdRef.current, DEFAULT_LAB_ENGINE_CONFIG, { updateStickyBackground: false });
    saveLabSettings({ ...DEFAULT_LAB_SETTINGS, backgroundColor: labSettingsRef.current.backgroundColor });
    saveTextureId(textureIdRef.current);
    window.location.reload();
  }

  async function handleFactoryResetSettings() {
    if (
      !window.confirm(
        "Factory reset all settings to defaults? This will clear saved configs, UI settings, and uploaded textures.",
      )
    )
      return;
    factoryResetSettings();
    saveManifest([]);
    saveTextureId(DEFAULT_LAB_TEXTURE_ID);
    saveControlDrawerSnapshot(DEFAULT_LAB_SETTINGS.drawerOpen);
    try {
      await clearTextureBlobs();
    } catch {
      // Reload anyway; manifest and selected texture are already reset.
    }
    window.location.reload();
  }

  function handleSavePreset() {
    const name = window.prompt("Preset name:")?.trim();
    if (!name) return;
    if (presets.some((p) => p.name === name) && !window.confirm(`Overwrite preset "${name}"?`)) return;
    const next = addPreset(presets, { name, config: controls });
    savePresets(next);
    setPresets(next);
    setSelectedPreset(name);
  }

  function handleApplyPreset() {
    const preset = presets.find((p) => p.name === selectedPreset);
    if (!preset) return;
    saveConfig(textureIdRef.current, normalizeEngineConfig(preset.config));
    window.location.reload();
  }

  function handleDeletePreset() {
    if (!selectedPreset) return;
    const next = removePreset(presets, selectedPreset);
    savePresets(next);
    setPresets(next);
    setSelectedPreset("");
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const kind: LabTextureKind = file.type.startsWith("video/") ? "video" : "image";
    const id = `upload-${crypto.randomUUID()}`;
    try {
      await putTextureBlob(id, file, file.type);
    } catch {
      window.alert("Couldn't save this upload (storage full). It will show for this session but won't persist.");
      loadFileSource(file)
        .then((loaded) => {
          if (engineRef.current) {
            applyLoadedSource(loaded);
          } else if (loaded.objectUrl) {
            URL.revokeObjectURL(loaded.objectUrl);
          }
        })
        .catch(() => {});
      return;
    }
    saveManifest(addUpload(loadManifest(), { id, label: file.name, kind, defaultScale: 1, createdAt: Date.now() }));
    saveConfig(id, controlsRef.current);
    saveTextureId(id);
    window.location.reload();
  }

  if (!shell) {
    return <canvas ref={canvasRef} style={{ display: "block" }} />;
  }

  const showSourceBackground = backgroundFillMode === "source" && sourcePreview !== null;
  const sourceObjectFit = controls.transform.fit === "contain" ? "contain" : "cover";

  return (
    <div className="lab-shell">
      <aside className="lab-sidebar lab-sidebar-texture">
        <div className="lab-sidebar-scroll playground-leva-panel texture-config-panel ui-scroll-hidden">
          <img className="lab-sidebar-logo" src="/cf-logo-dev.svg" alt="Cloudflare Stripes" />
          <div className="playground-workflow-controls">
            <div className="wf-field">
              <span className="wf-field-label">Texture</span>
              <select className="lab-btn" value={textureId} onChange={(e) => setTextureId(e.target.value)}>
                {textureOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="wf-row">
              <label className="lab-btn wf-upload">
                Upload texture
                <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFileChange} />
              </label>
              <button className="lab-btn" onClick={handleDeleteTexture} disabled={!canDeleteTexture}>
                Delete texture
              </button>
            </div>
            <hr className="wf-divider" />
            <div className="wf-field wf-config">
              <span className="wf-field-label">Config</span>
              <div className="wf-row">
                <button className="lab-btn" onClick={handleExport}>
                  Copy config
                </button>
                <button className="lab-btn" onClick={handleImport}>
                  Import config
                </button>
              </div>
              <div className="wf-row">
                <button className="lab-btn" onClick={handleDownloadConfig}>
                  Download JSON
                </button>
                <button className="lab-btn" onClick={() => configFileInputRef.current?.click()}>
                  Upload JSON
                </button>
              </div>
              <input
                ref={configFileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={handleConfigFileChange}
              />
              <button className="lab-btn wf-reset" onClick={handleResetSettings}>
                Reset settings
              </button>
              <button className="lab-btn wf-reset" onClick={handleFactoryResetSettings}>
                Factory reset
              </button>
            </div>
            <hr className="wf-divider" />
            <div className="wf-field">
              <span className="wf-field-label">Presets</span>
              <select className="lab-btn" value={selectedPreset} onChange={(e) => setSelectedPreset(e.target.value)}>
                <option value="">No preset selected</option>
                {presets.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="wf-row">
              <button className="lab-btn" onClick={handleApplyPreset} disabled={!selectedPreset}>
                Apply
              </button>
              <button className="lab-btn" onClick={handleSavePreset}>
                Save
              </button>
              <button className="lab-btn" onClick={handleDeletePreset} disabled={!selectedPreset}>
                Delete
              </button>
            </div>
            <hr className="wf-divider" />
            <div className="wf-field">
              <span className="wf-field-label">Export</span>
              <div className="wf-row">
                <button className="lab-btn" onClick={onExportVideo}>
                  Export Video
                </button>
                <button className="lab-btn" onClick={onExportSvg}>
                  Export SVG
                </button>
              </div>
            </div>
          </div>
          <LabCanvasSizeControls
            sourceWidth={sourceSize.w}
            sourceHeight={sourceSize.h}
            settings={labSettings}
            onSettings={updateLabSettings}
          />
          <LabExportControls videoEl={videoEl} settings={labSettings} onSettings={updateLabSettings} />
          <LevaPanel store={textureStore} theme={LAB_LEVA_THEME} fill flat titleBar={false} />
        </div>
      </aside>
      <div className="lab-main">
        <div className="lab-canvas-area" ref={canvasAreaRef}>
          <div className="lab-canvas-stage">
            <div
              className="lab-canvas-stack"
              style={{
                transform: `scale(${previewZoom})`,
                transformOrigin: "center center",
              }}
            >
              {showSourceBackground && sourcePreview.video ? (
                <video
                  className="lab-canvas-source-background"
                  src={sourcePreview.video.currentSrc || sourcePreview.video.src}
                  muted
                  loop
                  autoPlay
                  playsInline
                  style={{ objectFit: sourceObjectFit }}
                />
              ) : showSourceBackground && sourcePreview.source instanceof HTMLImageElement ? (
                <img
                  className="lab-canvas-source-background"
                  src={sourcePreview.source.currentSrc || sourcePreview.source.src}
                  alt=""
                  aria-hidden="true"
                  style={{ objectFit: sourceObjectFit }}
                />
              ) : null}
              <canvas
                ref={canvasRef}
                style={{
                  display: "block",
                  opacity: 1,
                }}
              />
            </div>
          </div>
          <div className="lab-canvas-zoom-controls" aria-label="Canvas preview zoom controls">
            <button
              className="lab-btn"
              type="button"
              onClick={() => updatePreviewZoom((current) => current - CANVAS_PREVIEW_ZOOM_STEP)}
            >
              −
            </button>
            <button className="lab-btn" type="button" onClick={() => updatePreviewZoom(1)}>
              Reset
            </button>
            <button
              className="lab-btn"
              type="button"
              onClick={() => updatePreviewZoom((current) => current + CANVAS_PREVIEW_ZOOM_STEP)}
            >
              +
            </button>
            <button
              className="lab-btn"
              type="button"
              onClick={() => setMouseZoomEnabled((enabled) => !enabled)}
              aria-pressed={mouseZoomEnabled}
            >
              Mouse {mouseZoomEnabled ? "On" : "Off"}
            </button>
            <span className="lab-canvas-zoom-value">{Math.round(previewZoom * 100)}%</span>
          </div>
        </div>
        <LabBottomBar videoEl={videoEl} />
      </div>
      <aside className="lab-sidebar lab-sidebar-shader">
        <div className="lab-sidebar-scroll playground-leva-panel shader-config-panel ui-scroll-hidden">
          <LevaPanel store={shaderStore} theme={LAB_LEVA_THEME} fill flat titleBar={false} />
        </div>
      </aside>
      <PerfOverlay snap={snap} />
    </div>
  );
}

export function LabApp() {
  return <LabInner />;
}
