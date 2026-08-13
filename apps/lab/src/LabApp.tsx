import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";
import {
  createStripesEngine,
  createManualClock,
  createRealClock,
  effectiveStripes,
  normalizeEngineConfig,
  resolveThemedConfig,
  diffEngineConfig,
  sanitizeThemedConfig,
  serializeProductionConfig,
  type StripesEngine,
  type PerfSnapshot,
  type EngineConfig,
  type ThemedEngineConfig,
  type DeepPartial,
} from "@necatikcl/stripes-engine";
import { LevaPanel } from "leva";
import { Play, Pause, PanelLeftClose, PanelLeft, PanelRightClose, PanelRight, RotateCcw } from "lucide-react";
import { PerfOverlay } from "./PerfOverlay";
import { useEngineControls } from "./controls/levaSchema";
import { LAB_LEVA_THEME } from "./controls/levaTheme";
import {
  DEFAULT_LAB_SETTINGS,
  stagePendingConfig,
  saveConfig,
  deleteConfig,
  saveTextureId,
  importSettingsFile,
  markImportedConfigPristine,
  serializeConfigFile,
  loadLabSettings,
  saveLabSettings,
  factoryResetSettings,
  saveEditTheme,
  type LabSettings,
  type LabTextureSourceMode,
  type LabEditTheme,
} from "./persistence";
import { DEFAULT_LAB_TEXTURE_ID, LAB_TEXTURES, findTextureEntry, loadFileSource, loadTextureSource } from "./textures";
import type { LabTextureKind, LoadedTextureSource } from "./textures";
import { addUpload, loadManifest, removeUpload, saveManifest, setDarkUpload } from "./uploads";
import {
  addPreset,
  applyPresetToStorage,
  consumeBootPresetName,
  createPreset,
  loadDefaultPreset,
  loadPresets,
  removePreset,
  savePresets,
  type ConfigPreset,
} from "./presets";
import {
  applyClientLayout,
  listSavedLayouts,
  loadActiveClientLayoutName,
  loadBannerLayout,
  saveActiveClientLayoutName,
} from "./client/savedLayouts";
import {
  resolveClientGraphicMode,
  clientGraphicFlags,
  resolveClientSvgExportLayers,
  withClientRainFxVisibility,
  type ClientGraphicMode,
} from "./client/clientPresets";
import { putTextureBlob, deleteTextureBlob, clearTextureBlobs } from "./textureStore";
import { cellGridToSvg, downloadSvg } from "./export/cellGridToSvg";
import { resolveSvgExportBackground } from "./export/svgExportBackground";
import { twizzlerToSvgLayer } from "./export/twizzlerToSvg";
import { exportLabVideo, formatVideoExportStatusLabel, type LabVideoExportPhase } from "./export/videoExport";
import { resolveLabVideoExportLayers } from "./export/resolveLabVideoExportLayers";
import { CONTROL_DRAWER_IDS, saveControlDrawerOpen, saveControlDrawerSnapshot } from "./controls/drawerState";
import { DEFAULT_LAB_ENGINE_CONFIG } from "./defaultLabConfig";
import {
  createShaderTextureRenderer,
  DEFAULT_SHADER_TEXTURE_SOURCE,
  type ShaderTextureRenderer,
} from "./shaderTextureSource";
import { normalizeShaderViewState, type ShaderViewState } from "./shaderView";
import { resolveShaderConfigKind } from "./shaderConfig";
import {
  CONNECT_SHADER_PRESET_ID,
  CUSTOM_SHADER_PRESET_ID,
  DEFAULT_SHADER_PRESET_ID,
  findShaderLibraryEntry,
  isCometLogoShaderPreset,
  isSpiralShaderPreset,
  isTwizzlerMapShaderPreset,
  isTwizzlerSineShaderPreset,
  NEBULA_SHADER_PRESET_ID,
  SHADER_LIBRARY,
} from "./shaderLibrary";
import { TWIZZLER_SINE_SHADER_SOURCE, shouldUseTwizzlerSineShader, twizzlerSineUniforms } from "./twizzlerSineShader";
import {
  CONNECT_SHAPE_OPTIONS,
  createConnectTextureRenderer,
  type ConnectCameraState,
  type ConnectShapeType,
  type ConnectTextureRenderer,
} from "./connectShader";
import { createUnderlayIntroController, resolveUnderlayIntroDelayMs } from "./connectShader/underlayIntro";
import { canvasStackBackgroundCss } from "./canvasStackBackground";
import { clampPreviewZoom, computeFitPreviewZoom, estimateCanvasViewportSize } from "./canvasFitPreviewZoom";
import { clearTwizzler, renderTwizzler } from "./twizzler";
import { shouldShowTwizzlerOverlay } from "./twizzlerVisibility";
import { createTwizzlerMapRenderer, type TwizzlerMapRenderer } from "./twizzlerMapSource";
import { createCometLogoTextureRenderer, type CometLogoTextureRenderer } from "@necatikcl/stripes-engine";
import { steppedTransportTime, TimeTransport, type TimeTransportController } from "./components/TimeTransport";
import {
  buildFrameGroups,
  clearFramesOverlay,
  framesOverlayToSvg,
  renderFramesOverlay,
  type FrameGroup,
} from "./framesOverlay";
import { SurfacePanel } from "./components/SurfacePanel";
import { SurfaceCanvasOverlay } from "./components/SurfaceCanvasOverlay";
import {
  createSurfaceArea,
  EMPTY_SURFACE_WORKSPACE,
  findSurfaceAreaAtPoint,
  loadSurfaceWorkspace,
  normalizeSurfaceAreaPoints,
  saveSurfaceWorkspace,
  type SurfaceArea,
  type SurfaceAreaKind,
  type SurfaceMode,
  type SurfacePoint,
  type SurfaceWorkspace,
} from "./surfaceWorkspace";

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
const CANVAS_PREVIEW_ZOOM_STEP = 0.05;
const CANVAS_PREVIEW_ZOOM_WHEEL_SENSITIVITY = 0.001;
const CANVAS_AREA_PADDING_PX = 48;
const LAB_BOTTOM_BAR_HEIGHT_PX = 52;
const SIDEBAR_WIDTH_MIN = 240;
const SIDEBAR_WIDTH_MAX = 640;
const WIDE_SCREEN_MIN_PX = 1800;
const DEFAULT_SIDEBAR_WIDTH = 272;
const WIDE_SHADER_SIDEBAR_WIDTH = 372;
const CONTROL_DRAWER_ID_SET = new Set<string>(CONTROL_DRAWER_IDS);

function clampSidebarWidth(value: number): number {
  return Math.round(Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, value)));
}

function initialFitPreviewZoom(settings: LabSettings): number {
  if (typeof window === "undefined") return 1;
  const srcW =
    settings.textureSourceMode === "shader"
      ? Math.max(1, Math.round(settings.shaderSourceWidth))
      : Math.max(1, Math.round(settings.canvasWidth));
  const srcH =
    settings.textureSourceMode === "shader"
      ? Math.max(1, Math.round(settings.shaderSourceHeight))
      : Math.max(1, Math.round(settings.canvasHeight));
  const { cssW, cssH } = computeLabCanvasSize(srcW, srcH, settings);
  const viewport = estimateCanvasViewportSize({
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    textureSidebarOpen: settings.textureSidebarOpen,
    textureSidebarWidth: settings.textureSidebarWidth,
    shaderSidebarOpen: settings.shaderSidebarOpen,
    shaderSidebarWidth: settings.shaderSidebarWidth,
    areaPaddingX: CANVAS_AREA_PADDING_PX,
    areaPaddingY: CANVAS_AREA_PADDING_PX,
    bottomBarHeight: LAB_BOTTOM_BAR_HEIGHT_PX,
  });
  return computeFitPreviewZoom({
    canvasWidth: cssW,
    canvasHeight: cssH,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  });
}

function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-pixels * CANVAS_PREVIEW_ZOOM_WHEEL_SENSITIVITY);
}

function connectCameraFromSettings(settings: LabSettings): ConnectCameraState {
  return {
    distance: settings.connectCameraDistance,
    rotateXDeg: settings.connectCameraRotateX,
    rotateYDeg: settings.connectCameraRotateY,
    rotateZDeg: settings.connectCameraRotateZ,
    panX: settings.connectCameraPanX,
    panY: settings.connectCameraPanY,
    fov: settings.connectCameraFov,
  };
}

function connectCameraToSettingsPatch(camera: ConnectCameraState): Partial<LabSettings> {
  return {
    connectCameraDistance: camera.distance,
    connectCameraRotateX: camera.rotateXDeg,
    connectCameraRotateY: camera.rotateYDeg,
    connectCameraRotateZ: camera.rotateZDeg,
    connectCameraPanX: camera.panX,
    connectCameraPanY: camera.panY,
    connectCameraFov: camera.fov,
  };
}

function shaderViewFromSettings(settings: LabSettings): ShaderViewState {
  return normalizeShaderViewState({
    distance: settings.shaderViewDistance,
    rotateXDeg: settings.shaderViewRotateX,
    rotateYDeg: settings.shaderViewRotateY,
    rotateZDeg: settings.shaderViewRotateZ,
    panX: settings.shaderViewPanX,
    panY: settings.shaderViewPanY,
    fov: settings.shaderViewFov,
  });
}

function shaderViewToSettingsPatch(view: ShaderViewState): Partial<LabSettings> {
  return {
    shaderViewDistance: view.distance,
    shaderViewRotateX: view.rotateXDeg,
    shaderViewRotateY: view.rotateYDeg,
    shaderViewRotateZ: view.rotateZDeg,
    shaderViewPanX: view.panX,
    shaderViewPanY: view.panY,
    shaderViewFov: view.fov,
  };
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
  if (settings.canvasMode === "original") return computeCanvasSize(srcW, srcH);
  if (settings.canvasMode === "manual") {
    return {
      cssW: Math.max(1, Math.round(settings.canvasWidth)),
      cssH: Math.max(1, Math.round(settings.canvasHeight)),
    };
  }
  const base = computeCanvasSize(srcW, srcH);
  const scale = Number.isFinite(settings.canvasScale) ? Math.max(0.1, Math.min(8, settings.canvasScale)) : 1;
  return {
    cssW: Math.max(1, Math.round(base.cssW * scale)),
    cssH: Math.max(1, Math.round(base.cssH * scale)),
  };
}

/** Known source size before async texture/shader init finishes. */
function expectedSourceSize(settings: LabSettings, textureSourceMode: LabTextureSourceMode): { w: number; h: number } {
  if (textureSourceMode === "shader") {
    return {
      w: Math.max(1, Math.round(settings.shaderSourceWidth)),
      h: Math.max(1, Math.round(settings.shaderSourceHeight)),
    };
  }
  return { w: 0, h: 0 };
}

function applyCanvasCssSize(
  canvas: HTMLCanvasElement,
  src: { w: number; h: number },
  settings: LabSettings,
): { cssW: number; cssH: number } | null {
  if (src.w <= 0 || src.h <= 0) return null;
  const size = computeLabCanvasSize(src.w, src.h, settings);
  canvas.style.width = `${size.cssW}px`;
  canvas.style.height = `${size.cssH}px`;
  return size;
}

function shaderOriginalSize(settings: LabSettings): { w: number; h: number } {
  return {
    w: Math.max(1, Math.round(settings.shaderSourceWidth)),
    h: Math.max(1, Math.round(settings.shaderSourceHeight)),
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

function pointerToShaderMouse(
  canvas: HTMLCanvasElement,
  renderer: ShaderTextureRenderer,
  e: PointerEvent,
  down: boolean,
): { x: number; y: number; down: boolean; hovered: boolean } {
  return pointerToTextureMouse(canvas, renderer.width, renderer.height, e, down);
}

function pointerToTextureMouse(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  e: PointerEvent,
  down: boolean,
): { x: number; y: number; down: boolean; hovered: boolean } {
  const point = pointerToEnginePoint(canvas, e);
  const engineW = Number.parseFloat(canvas.style.width) || canvas.clientWidth || 1;
  const engineH = Number.parseFloat(canvas.style.height) || canvas.clientHeight || 1;
  return {
    x: (point.x / Math.max(1, engineW)) * width,
    y: (1 - point.y / Math.max(1, engineH)) * height,
    down,
    hovered: true,
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
    blackPoint: 0,
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

function productionConfigFilename(textureId: string): string {
  const safeId = textureId.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "texture";
  return `stripes-production-${safeId}.json`;
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
  const isOriginal = settings.canvasMode === "original";
  const isCustom = settings.canvasMode === "manual";
  const aspect = Math.max(1, cssW) / Math.max(1, cssH);
  const applyOriginal = () => {
    const base = computeCanvasSize(sourceWidth, sourceHeight);
    onSettings({ canvasMode: "original", canvasScale: 1, canvasWidth: base.cssW, canvasHeight: base.cssH });
  };
  const applyCustom = () => {
    onSettings({ canvasMode: "manual", canvasWidth: cssW, canvasHeight: cssH });
  };
  const setCanvasWidth = (value: string) => {
    const width = Math.max(1, Math.min(8192, Math.round(Number(value))));
    if (!Number.isFinite(width)) return;
    onSettings({
      canvasMode: "manual",
      canvasWidth: width,
      ...(settings.canvasAspectLocked ? { canvasHeight: Math.max(1, Math.min(8192, Math.round(width / aspect))) } : {}),
    });
  };
  const setCanvasHeight = (value: string) => {
    const height = Math.max(1, Math.min(8192, Math.round(Number(value))));
    if (!Number.isFinite(height)) return;
    onSettings({
      canvasMode: "manual",
      canvasHeight: height,
      ...(settings.canvasAspectLocked ? { canvasWidth: Math.max(1, Math.min(8192, Math.round(height * aspect))) } : {}),
    });
  };
  const applyScale = (scale: number) => {
    const base = computeCanvasSize(sourceWidth, sourceHeight);
    onSettings({
      canvasMode: "scale",
      canvasScale: scale,
      canvasWidth: Math.max(1, Math.round(base.cssW * scale)),
      canvasHeight: Math.max(1, Math.round(base.cssH * scale)),
    });
  };

  return (
    <section className="playground-canvas-size-controls">
      <div className="playground-canvas-size-row">
        <span className="playground-canvas-scale-label">Canvas size</span>
        <div className="playground-canvas-scale-controls">
          <div className="playground-canvas-scale-buttons">
            <button type="button" className={isOriginal ? "is-active" : ""} disabled={disabled} onClick={applyOriginal}>
              Original
            </button>
            <button type="button" className={isCustom ? "is-active" : ""} disabled={disabled} onClick={applyCustom}>
              Custom
            </button>
          </div>
        </div>
      </div>
      <div className="playground-canvas-size-row">
        <span className="playground-canvas-scale-label">Canvas scale</span>
        <div className="playground-canvas-scale-controls">
          <div className="playground-canvas-scale-buttons">
            {scaleOptions.map((scale) => (
              <button
                key={scale}
                type="button"
                className={settings.canvasMode === "scale" && Math.abs(activeScale - scale) < 0.001 ? "is-active" : ""}
                disabled={disabled}
                onClick={() => applyScale(scale)}
              >
                {scale}x
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="playground-canvas-size-row">
        <span className="playground-canvas-scale-label">Custom size</span>
        <div className="playground-canvas-dimension-controls">
          <input
            type="number"
            min={1}
            max={8192}
            step={1}
            disabled={disabled || !isCustom}
            value={disabled ? "" : cssW}
            onChange={(event) => setCanvasWidth(event.currentTarget.value)}
            aria-label="Canvas width"
          />
          <button
            type="button"
            className={settings.canvasAspectLocked ? "is-active" : ""}
            disabled={disabled || !isCustom}
            onClick={() => onSettings({ canvasAspectLocked: !settings.canvasAspectLocked })}
            aria-label={settings.canvasAspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
            title={settings.canvasAspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
          >
            {settings.canvasAspectLocked ? "🔒" : "🔓"}
          </button>
          <input
            type="number"
            min={1}
            max={8192}
            step={1}
            disabled={disabled || !isCustom}
            value={disabled ? "" : cssH}
            onChange={(event) => setCanvasHeight(event.currentTarget.value)}
            aria-label="Canvas height"
          />
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
    <div className="playground-export-controls">
      {videoEl ? (
        <>
          <div className="playground-canvas-size-row-header">
            <span className="playground-canvas-scale-meta">Source {formatTime(videoDuration)}</span>
          </div>
          <div className="playground-canvas-size-inline">
            <span className="playground-canvas-scale-label">Start second</span>
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
        </>
      ) : null}
      <div className="playground-canvas-size-inline">
        <span className="playground-canvas-scale-label">Video duration</span>
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
  );
}

function LabBottomBar({
  videoEl,
  editTheme,
  onSelectTheme,
  onResetTheme,
}: {
  videoEl: HTMLVideoElement | null;
  editTheme: LabEditTheme;
  onSelectTheme: (t: LabEditTheme) => void;
  onResetTheme: (t: LabEditTheme) => void;
}) {
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
        <fieldset className="lab-theme-switch" aria-label="Config theme">
          {(["light", "dark"] as const).map((t) => (
            <div key={t} className={`lab-theme-option${editTheme === t ? " is-active" : ""}`}>
              <button type="button" className="lab-theme-btn" onClick={() => onSelectTheme(t)}>
                {t === "light" ? "Light" : "Dark"}
              </button>
              <button
                type="button"
                className="lab-theme-reset"
                aria-label={t === "light" ? "Reset light to dark's config" : "Reset dark to light's config"}
                title={t === "light" ? "Reset light to dark's config" : "Reset dark to light's config"}
                onClick={() => onResetTheme(t)}
              >
                <RotateCcw size={11} />
              </button>
            </div>
          ))}
        </fieldset>
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

type LabInnerProps = {
  clientMode?: boolean;
  surfaceWorkspace: SurfaceWorkspace;
  surfaceEditorRevision: number;
  initialConfig?: ThemedEngineConfig;
  onSurfaceModeChange: (mode: SurfaceMode, currentConfig: ThemedEngineConfig) => void;
  onAddSurfaceArea: (kind: SurfaceAreaKind, points: SurfacePoint[], config: ThemedEngineConfig) => void;
  onSelectSurfaceArea: (id: string | null) => void;
  onPreviewSurfaceAreaPoints: (id: string, points: SurfacePoint[]) => void;
  onUpdateSurfaceAreaPoints: (id: string, points: SurfacePoint[]) => void;
  onUpdateSurfaceAreaConfig: (id: string, config: ThemedEngineConfig) => void;
  onToggleSurfaceArea: (id: string) => void;
  onDeleteSurfaceArea: (id: string) => void;
  onResetSurfaceArea: (id: string) => void;
};

type SurfaceAreaConfigEditorProps = {
  area: SurfaceArea;
  onChange: (id: string, config: ThemedEngineConfig) => void;
};

function SurfaceAreaConfigEditor({ area, onChange }: SurfaceAreaConfigEditorProps) {
  const replay = useCallback(() => {}, []);
  const { config, initialThemed, textureStore, shaderStore } = useEngineControls(replay, {
    initialConfig: area.config,
    configScope: "surface",
  });
  const editTheme = initialThemed.editTheme;
  const lightBaseRef = useRef<Partial<EngineConfig>>(initialThemed.lightBase);
  const darkDiffRef = useRef<DeepPartial<EngineConfig>>(initialThemed.darkDiff);
  const lastSentConfigRef = useRef(JSON.stringify(sanitizeThemedConfig(area.config)));

  const composeAreaConfig = useCallback((): ThemedEngineConfig => {
    if (editTheme === "dark") {
      const base = normalizeEngineConfig(lightBaseRef.current);
      const dark = diffEngineConfig(base, config);
      darkDiffRef.current = dark;
      return Object.keys(dark).length > 0 ? { ...base, dark } : { ...base };
    }
    lightBaseRef.current = config;
    const dark = darkDiffRef.current;
    return Object.keys(dark).length > 0 ? { ...config, dark } : { ...config };
  }, [config, editTheme]);

  useEffect(() => {
    const next = sanitizeThemedConfig(composeAreaConfig());
    const serialized = JSON.stringify(next);
    if (serialized === lastSentConfigRef.current) return;
    lastSentConfigRef.current = serialized;
    onChange(area.id, next);
  }, [area.id, composeAreaConfig, onChange]);

  return (
    <>
      <LevaPanel store={textureStore} theme={LAB_LEVA_THEME} fill flat titleBar={false} />
      <LevaPanel store={shaderStore} theme={LAB_LEVA_THEME} fill flat titleBar={false} />
    </>
  );
}

function LabInner({
  clientMode = false,
  surfaceWorkspace,
  surfaceEditorRevision,
  initialConfig,
  onSurfaceModeChange,
  onAddSurfaceArea,
  onSelectSurfaceArea,
  onPreviewSurfaceAreaPoints,
  onUpdateSurfaceAreaPoints,
  onUpdateSurfaceAreaConfig,
  onToggleSurfaceArea,
  onDeleteSurfaceArea,
  onResetSurfaceArea,
}: LabInnerProps) {
  const startupPreset = useMemo(() => loadDefaultPreset(), []);
  const clientModeRef = useRef(clientMode);
  clientModeRef.current = clientMode;
  const startupLabSettings = useMemo(() => {
    const stored = loadLabSettings();
    if (clientMode) {
      // Live localStorage already holds the session (or boot seeded Banner once).
      // Rain apply sets textureSidebarOpen so Camera / Tone stay reachable.
      return {
        ...stored,
        canvasMode: "manual" as const,
        canvasAspectLocked: true,
        textureSidebarOpen: stored.textureSidebarOpen ?? false,
        shaderSidebarOpen: true,
        textureSourceMode: "shader" as const,
        shaderPresetId: stored.shaderPresetId || "twizzler-map",
        twizzlerEnabled: stored.twizzlerEnabled ?? true,
      };
    }
    return {
      ...stored,
      ...(startupPreset?.lab ?? {}),
    };
  }, [clientMode, startupPreset]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const twizzlerCanvasRef = useRef<HTMLCanvasElement>(null);
  const framesCanvasRef = useRef<HTMLCanvasElement>(null);
  const partialCompositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const shaderPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const connectUnderlayHostRef = useRef<HTMLDivElement>(null);
  const underlayIntroRef = useRef(createUnderlayIntroController());
  const revealStartedAtRef = useRef<number | null>(null);
  const underlayIntroArmedRef = useRef(false);
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
  const [labSettings, setLabSettings] = useState<LabSettings>(() => ({
    ...startupLabSettings,
    canvasScale: DEFAULT_LAB_SETTINGS.canvasScale,
  }));
  /** Client preview only: Default = curated folders, Advanced = full authoring folders. */
  const [clientPanelMode, setClientPanelMode] = useState<"default" | "advanced">("default");
  const [textureSourceMode, setTextureSourceMode] = useState<LabTextureSourceMode>(() => labSettings.textureSourceMode);
  const [sourceSize, setSourceSize] = useState<{ w: number; h: number }>(() =>
    expectedSourceSize(labSettings, labSettings.textureSourceMode),
  );
  const [shaderSourceCode, setShaderSourceCode] = useState(() => {
    const presetSource = findShaderLibraryEntry(labSettings.shaderPresetId)?.source;
    return presetSource || labSettings.shaderSourceCode || DEFAULT_SHADER_TEXTURE_SOURCE;
  });
  const [shaderSourceError, setShaderSourceError] = useState<string | null>(null);
  const [shaderPresetId, setShaderPresetId] = useState(() => labSettings.shaderPresetId || DEFAULT_SHADER_PRESET_ID);
  const [shaderPlaying, setShaderPlaying] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(() => labSettings.previewZoom ?? initialFitPreviewZoom(labSettings));
  const [previewZoomReady, setPreviewZoomReady] = useState(false);
  const hasAutoFittedPreviewZoomRef = useRef(false);
  const hasStoredPreviewZoomRef = useRef(labSettings.previewZoom != null);
  const previewZoomTouchedRef = useRef(false);
  const [presets, setPresets] = useState<ConfigPreset[]>(() => loadPresets());
  const [selectedPreset, setSelectedPreset] = useState(
    () => consumeBootPresetName() ?? (clientMode ? loadActiveClientLayoutName() : null) ?? startupPreset?.name ?? "",
  );
  const sourceSizeRef = useRef(sourceSize);
  sourceSizeRef.current = sourceSize;
  const textureSourceModeRef = useRef(textureSourceMode);
  textureSourceModeRef.current = textureSourceMode;
  const shaderSourceCodeRef = useRef(shaderSourceCode);
  shaderSourceCodeRef.current = shaderSourceCode;
  const shaderRendererRef = useRef<ShaderTextureRenderer | null>(null);
  const twizzlerSineRendererRef = useRef<ShaderTextureRenderer | null>(null);
  const connectRendererRef = useRef<ConnectTextureRenderer | null>(null);
  const twizzlerMapRendererRef = useRef<TwizzlerMapRenderer | null>(null);
  const cometLogoRendererRef = useRef<CometLogoTextureRenderer | null>(null);
  const shaderPresetIdRef = useRef(shaderPresetId);
  shaderPresetIdRef.current = shaderPresetId;
  const shaderPlayingRef = useRef(shaderPlaying);
  shaderPlayingRef.current = shaderPlaying;
  const shaderTimeSecRef = useRef(0);
  const [twizzlerPlaying, setTwizzlerPlaying] = useState(true);
  const twizzlerPlayingRef = useRef(twizzlerPlaying);
  twizzlerPlayingRef.current = twizzlerPlaying;
  const twizzlerTimeSecRef = useRef(0);
  const shaderLastTickMsRef = useRef(performance.now());
  const shaderMouseRef = useRef({ x: 0, y: 0, down: false, hovered: false });
  const labSettingsRef = useRef(labSettings);
  labSettingsRef.current = labSettings;
  const surfaceWorkspaceRef = useRef(surfaceWorkspace);
  surfaceWorkspaceRef.current = surfaceWorkspace;
  const [drawingSurfaceAreaKind, setDrawingSurfaceAreaKind] = useState<SurfaceAreaKind | null>(null);
  const drawingSurfaceAreaKindRef = useRef(drawingSurfaceAreaKind);
  drawingSurfaceAreaKindRef.current = drawingSurfaceAreaKind;
  const onSelectSurfaceAreaRef = useRef(onSelectSurfaceArea);
  onSelectSurfaceAreaRef.current = onSelectSurfaceArea;

  useEffect(() => {
    setLabSettings((prev) =>
      prev.textureSourceMode === textureSourceMode &&
      prev.shaderSourceCode === shaderSourceCode &&
      prev.shaderPresetId === shaderPresetId
        ? prev
        : { ...prev, textureSourceMode, shaderSourceCode, shaderPresetId },
    );
  }, [textureSourceMode, shaderSourceCode, shaderPresetId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia(`(min-width: ${WIDE_SCREEN_MIN_PX}px)`).matches) return;
    setLabSettings((prev) => {
      if (prev.shaderSidebarWidth !== DEFAULT_SIDEBAR_WIDTH) return prev;
      const next = { ...prev, shaderSidebarWidth: WIDE_SHADER_SIDEBAR_WIDTH };
      saveLabSettings(next);
      return next;
    });
  }, []);

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
      return loadLabSettings();
    });
  }, []);

  const [sidebarResizing, setSidebarResizing] = useState<"texture" | "shader" | null>(null);
  const sidebarDragWidthRef = useRef(0);

  const startSidebarResize = useCallback((side: "texture" | "shader", event: ReactPointerEvent<HTMLDivElement>) => {
    if (side === "texture" && !labSettingsRef.current.textureSidebarOpen) return;
    if (side === "shader" && !labSettingsRef.current.shaderSidebarOpen) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth =
      side === "texture" ? labSettingsRef.current.textureSidebarWidth : labSettingsRef.current.shaderSidebarWidth;
    sidebarDragWidthRef.current = startWidth;
    setSidebarResizing(side);
    document.body.classList.add("lab-sidebar-resizing");

    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = clampSidebarWidth(side === "texture" ? startWidth + delta : startWidth - delta);
      sidebarDragWidthRef.current = nextWidth;
      setLabSettings((prev) =>
        side === "texture" ? { ...prev, textureSidebarWidth: nextWidth } : { ...prev, shaderSidebarWidth: nextWidth },
      );
    };

    const onUp = () => {
      document.body.classList.remove("lab-sidebar-resizing");
      setSidebarResizing(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const nextWidth = sidebarDragWidthRef.current;
      saveLabSettings(side === "texture" ? { textureSidebarWidth: nextWidth } : { shaderSidebarWidth: nextWidth });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const updatePreviewZoom = useCallback((next: number | ((current: number) => number)) => {
    previewZoomTouchedRef.current = true;
    setPreviewZoom((current) => clampPreviewZoom(typeof next === "function" ? next(current) : next));
  }, []);

  useEffect(() => {
    if (!previewZoomTouchedRef.current) return;
    const id = window.setTimeout(() => updateLabSettings({ previewZoom }), 250);
    return () => window.clearTimeout(id);
  }, [previewZoom, updateLabSettings]);

  const handlePreviewWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const factor = wheelZoomFactor(event.deltaY, event.deltaMode);
      updatePreviewZoom((current) => current * factor);
    },
    [updatePreviewZoom],
  );

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
  const videoExportGenerationRef = useRef(0);
  const [videoExportPhase, setVideoExportPhase] = useState<LabVideoExportPhase>("idle");
  const [videoExportRecording, setVideoExportRecording] = useState({ elapsedMs: 0, totalMs: 0 });
  const [videoExportTranscodePercent, setVideoExportTranscodePercent] = useState<number | null>(null);
  const [videoExportTranscodeElapsedMs, setVideoExportTranscodeElapsedMs] = useState(0);
  const videoExportUiRef = useRef({
    setPhase: setVideoExportPhase,
    setRecording: setVideoExportRecording,
    setTranscodePercent: setVideoExportTranscodePercent,
    setTranscodeElapsed: setVideoExportTranscodeElapsedMs,
  });
  videoExportUiRef.current = {
    setPhase: setVideoExportPhase,
    setRecording: setVideoExportRecording,
    setTranscodePercent: setVideoExportTranscodePercent,
    setTranscodeElapsed: setVideoExportTranscodeElapsedMs,
  };
  // Disabled from first click through the brief done/failed flash, until idle again.
  const videoExportBusy = videoExportPhase !== "idle";
  const videoExportLabel = formatVideoExportStatusLabel(
    videoExportPhase,
    videoExportRecording,
    videoExportTranscodePercent,
    videoExportTranscodeElapsedMs,
  );
  const shaderTransport = useMemo<TimeTransportController>(
    () => ({
      getTime: () => shaderTimeSecRef.current,
      isPlaying: () => shaderPlayingRef.current,
      toggle: () => {
        const next = !shaderPlayingRef.current;
        shaderPlayingRef.current = next;
        shaderLastTickMsRef.current = performance.now();
        setShaderPlaying(next);
      },
      step: (seconds) => {
        shaderPlayingRef.current = false;
        setShaderPlaying(false);
        shaderTimeSecRef.current = steppedTransportTime(shaderTimeSecRef.current, seconds);
        shaderLastTickMsRef.current = performance.now();
      },
      reset: () => {
        shaderTimeSecRef.current = 0;
        shaderLastTickMsRef.current = performance.now();
      },
    }),
    [],
  );
  const twizzlerTransport = useMemo<TimeTransportController>(
    () => ({
      getTime: () => twizzlerTimeSecRef.current,
      isPlaying: () => twizzlerPlayingRef.current,
      toggle: () => {
        const next = !twizzlerPlayingRef.current;
        twizzlerPlayingRef.current = next;
        setTwizzlerPlaying(next);
      },
      step: (seconds) => {
        twizzlerPlayingRef.current = false;
        setTwizzlerPlaying(false);
        twizzlerTimeSecRef.current = steppedTransportTime(twizzlerTimeSecRef.current, seconds);
      },
      reset: () => {
        twizzlerTimeSecRef.current = 0;
      },
    }),
    [],
  );
  const onClientGraphicPersistRef = useRef<(mode: ClientGraphicMode) => void>(() => {});
  const {
    config: controls,
    backgroundSourceOpacity,
    setControl,
    getLabSettingsSnapshot,
    textureId,
    setTextureId,
    textureOptions,
    textureStore,
    shaderStore,
    connectCamera,
    connectShaderParams,
    connectGradientUnderlay,
    twizzler,
    twizzlerMap,
    cometLogo,
    shaderView,
    initialThemed,
    clientCanvasSize,
    clientGraphicMode,
    clientRainShaderPreset,
  } = useEngineControls(onReplay, {
    showShaderCamera:
      (!clientMode || clientPanelMode === "advanced") &&
      textureSourceMode === "shader" &&
      !isTwizzlerMapShaderPreset(shaderPresetId) &&
      !isCometLogoShaderPreset(shaderPresetId),
    showConnectCamera: textureSourceMode === "shader" && isSpiralShaderPreset(shaderPresetId),
    activeShaderConfig: resolveShaderConfigKind(textureSourceMode, shaderPresetId),
    showTwizzlerRibbon: textureSourceMode === "shader",
    twizzlerTransport: clientMode ? undefined : twizzlerTransport,
    // Client boot wrote the active layout into storage — let controls load it.
    initialConfig: clientMode ? undefined : initialConfig,
    clientMode,
    clientPanelMode: clientMode ? clientPanelMode : undefined,
    onClientGraphicModeChange: clientMode
      ? (mode) => {
          onClientGraphicPersistRef.current(mode);
        }
      : undefined,
  });
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const backgroundSourceOpacityRef = useRef(backgroundSourceOpacity);
  backgroundSourceOpacityRef.current = backgroundSourceOpacity;
  const twizzlerRef = useRef(twizzler);
  twizzlerRef.current = twizzler;
  const clientGraphicModeRef = useRef(clientGraphicMode);
  clientGraphicModeRef.current = clientGraphicMode;
  const twizzlerMapRef = useRef(twizzlerMap);
  twizzlerMapRef.current = twizzlerMap;
  const cometLogoRef = useRef(cometLogo);
  cometLogoRef.current = cometLogo;
  const setControlRef = useRef(setControl);
  setControlRef.current = setControl;
  const textureIdRef = useRef(textureId);
  textureIdRef.current = textureId;
  const lastSavedConfigJsonRef = useRef<string | null>(null);
  const lastEngineConfigJsonRef = useRef<string | null>(null);
  const getLabSettingsSnapshotRef = useRef(getLabSettingsSnapshot);
  getLabSettingsSnapshotRef.current = getLabSettingsSnapshot;

  useEffect(() => {
    if (!clientMode || !clientCanvasSize) return;
    const { width, height } = clientCanvasSize;
    setLabSettings((current) => {
      if (current.canvasMode === "manual" && current.canvasWidth === width && current.canvasHeight === height) {
        return current;
      }
      return {
        ...current,
        canvasMode: "manual",
        canvasWidth: width,
        canvasHeight: height,
        canvasAspectLocked: true,
      };
    });
  }, [clientCanvasSize, clientMode]);

  const editTheme = initialThemed.editTheme;
  const lightBaseRef = useRef<Partial<EngineConfig>>(initialThemed.lightBase);
  const darkDiffRef = useRef<DeepPartial<EngineConfig>>(initialThemed.darkDiff);

  const composeThemedConfig = useCallback((): ThemedEngineConfig => {
    const current = controlsRef.current;
    if (editTheme === "dark") {
      const base = normalizeEngineConfig(lightBaseRef.current);
      const dark = diffEngineConfig(base, current);
      darkDiffRef.current = dark;
      return Object.keys(dark).length > 0 ? { ...base, dark } : { ...base };
    }
    lightBaseRef.current = current;
    const dark = darkDiffRef.current;
    return Object.keys(dark).length > 0 ? { ...current, dark } : { ...current };
  }, [editTheme]);
  const composeThemedConfigRef = useRef(composeThemedConfig);
  composeThemedConfigRef.current = composeThemedConfig;

  /** Persist live Leva + lab knobs without clobbering Twizzler from a stale React state ref. */
  const flushLiveLabPersistence = useCallback(() => {
    const { enabled, ...twizzlerSettings } = twizzlerRef.current;
    saveLabSettings({
      ...labSettingsRef.current,
      ...getLabSettingsSnapshotRef.current(),
      textureId: textureIdRef.current,
      textureSourceMode: textureSourceModeRef.current,
      shaderSourceCode: shaderSourceCodeRef.current,
      shaderPresetId: shaderPresetIdRef.current,
      twizzlerEnabled: enabled,
      twizzler: twizzlerSettings,
      twizzlerMap: twizzlerMapRef.current,
    });
    if (surfaceWorkspaceRef.current.mode === "partial") return;
    const themed = composeThemedConfigRef.current();
    const id = textureIdRef.current;
    const key = `${id}:${JSON.stringify(themed)}`;
    lastSavedConfigJsonRef.current = key;
    saveConfig(id, themed);
  }, []);

  useEffect(() => {
    const onHide = () => flushLiveLabPersistence();
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, [flushLiveLabPersistence]);

  // Persist Graphic immediately (not only on pagehide) so Rain survives refresh (CF-67).
  onClientGraphicPersistRef.current = (mode) => {
    const flags = clientGraphicFlags(mode);
    const { enabled: _ignored, ...twizzlerSettings } = twizzlerRef.current;
    saveLabSettings({
      ...labSettingsRef.current,
      ...getLabSettingsSnapshotRef.current(),
      textureId: textureIdRef.current,
      textureSourceMode: textureSourceModeRef.current,
      shaderSourceCode: shaderSourceCodeRef.current,
      shaderPresetId: shaderPresetIdRef.current,
      twizzlerEnabled: flags.twizzlerEnabled,
      twizzler: twizzlerSettings,
      twizzlerMap: twizzlerMapRef.current,
    });
    const persistConfig = () => {
      const themed = composeThemedConfigRef.current();
      const gaps = themed.sparkle?.gaps ?? { enabled: false, coverage: 0, speed: 1 };
      const nextGaps = {
        ...gaps,
        enabled: flags.rainEnabled,
        coverage: flags.rainEnabled && (gaps.coverage ?? 1) >= 0.999 ? 0 : gaps.coverage,
      };
      const next = {
        ...themed,
        sparkle: {
          ...themed.sparkle,
          gaps: nextGaps,
        },
      };
      const id = textureIdRef.current;
      lastSavedConfigJsonRef.current = `${id}:${JSON.stringify(next)}`;
      saveConfig(id, next);
    };
    // Wait for Leva rainEnabled → controls.sparkle.gaps to land, then force-write flags.
    requestAnimationFrame(() => {
      requestAnimationFrame(persistConfig);
    });
  };

  const getActiveThemedConfig = useCallback((): ThemedEngineConfig => {
    const workspace = surfaceWorkspaceRef.current;
    if (workspace.mode === "partial" && workspace.selectedAreaId) {
      const area = workspace.areas.find((item) => item.id === workspace.selectedAreaId);
      if (area) return area.config;
    }
    return composeThemedConfig();
  }, [composeThemedConfig]);
  const selectedEntry = useMemo(() => findTextureEntry(textureId, loadManifest()), [textureId]);
  const canDeleteTexture = selectedEntry?.origin === "upload";

  function handleDeleteTexture() {
    const manifest = loadManifest();
    const entry = findTextureEntry(textureId, manifest);
    if (!entry || entry.origin !== "upload") return;
    saveManifest(removeUpload(manifest, entry.id));
    void deleteTextureBlob(entry.id);
    if (entry.dark) void deleteTextureBlob(entry.dark.id);
    deleteConfig(entry.id);
    saveTextureId(DEFAULT_LAB_TEXTURE_ID);
    window.location.reload();
  }

  const stripesEnabledRef = useRef(controls.stripesEnabled);
  stripesEnabledRef.current = controls.stripesEnabled;
  const revealEnabledRef = useRef(controls.reveal.enabled);
  revealEnabledRef.current = controls.reveal.enabled;

  const scheduleConnectUnderlayIntro = useCallback(() => {
    const host = connectUnderlayHostRef.current;
    const show =
      textureSourceModeRef.current === "shader" &&
      isSpiralShaderPreset(shaderPresetIdRef.current) &&
      labSettingsRef.current.connectGradientUnderlay;
    if (!show || !host) {
      underlayIntroRef.current.hide(host);
      return;
    }
    const delayTotal = resolveUnderlayIntroDelayMs(controlsRef.current.reveal);
    const started = revealStartedAtRef.current;
    const remaining = started === null ? delayTotal : Math.max(0, delayTotal - (performance.now() - started));
    underlayIntroRef.current.play(host, remaining);
  }, []);

  const beginReveal = useCallback(
    (engine: StripesEngine) => {
      revealStartedAtRef.current = performance.now();
      if (revealEnabledRef.current) engine.triggerReveal();
      underlayIntroArmedRef.current = false;
      scheduleConnectUnderlayIntro();
      underlayIntroArmedRef.current = true;
    },
    [scheduleConnectUnderlayIntro],
  );
  const beginRevealRef = useRef(beginReveal);
  beginRevealRef.current = beginReveal;

  const applyCanvasSize = useCallback(
    (engine: StripesEngine, canvas: HTMLCanvasElement, src: { w: number; h: number }, settings: LabSettings) => {
      const size = applyCanvasCssSize(canvas, src, settings);
      if (!size) return;
      const { cssW, cssH } = size;
      engine.resize(cssW, cssH);
      if (textureSourceModeRef.current !== "shader") return;

      if (isSpiralShaderPreset(shaderPresetIdRef.current)) {
        const connectRenderer = connectRendererRef.current;
        if (!connectRenderer) return;
        connectRenderer.render(shaderTimeSecRef.current);
        engine.setSource(connectRenderer.canvas);
        engine.updateSourceFrame(connectRenderer.canvas);
        const previewCanvas = shaderPreviewCanvasRef.current;
        if (previewCanvas) {
          if (previewCanvas.width !== connectRenderer.width) previewCanvas.width = connectRenderer.width;
          if (previewCanvas.height !== connectRenderer.height) previewCanvas.height = connectRenderer.height;
          previewCanvas.getContext("2d")?.drawImage(connectRenderer.canvas, 0, 0);
        }
        return;
      }

      if (isTwizzlerMapShaderPreset(shaderPresetIdRef.current)) {
        const renderer = twizzlerMapRendererRef.current;
        if (!renderer) return;
        renderer.render(
          twizzlerTimeSecRef.current,
          shaderTimeSecRef.current,
          twizzlerRef.current,
          twizzlerMapRef.current,
        );
        engine.setSource(renderer.canvas);
        engine.updateSourceFrame(renderer.canvas);
        const previewCanvas = shaderPreviewCanvasRef.current;
        if (previewCanvas) {
          if (previewCanvas.width !== renderer.width) previewCanvas.width = renderer.width;
          if (previewCanvas.height !== renderer.height) previewCanvas.height = renderer.height;
          previewCanvas.getContext("2d")?.drawImage(renderer.canvas, 0, 0);
        }
        return;
      }

      if (isCometLogoShaderPreset(shaderPresetIdRef.current)) {
        const renderer = cometLogoRendererRef.current;
        if (!renderer) return;
        renderer.render(shaderTimeSecRef.current, shaderMouseRef.current, cometLogoRef.current);
        engine.setSource(renderer.canvas);
        engine.updateSourceFrame(renderer.canvas);
        const previewCanvas = shaderPreviewCanvasRef.current;
        if (previewCanvas) {
          if (previewCanvas.width !== renderer.width) previewCanvas.width = renderer.width;
          if (previewCanvas.height !== renderer.height) previewCanvas.height = renderer.height;
          previewCanvas.getContext("2d")?.drawImage(renderer.canvas, 0, 0);
        }
        return;
      }

      const shaderRenderer = shaderRendererRef.current;
      if (!shaderRenderer) return;
      shaderRenderer.render(
        shaderTimeSecRef.current,
        shaderMouseRef.current,
        shaderViewFromSettings(labSettingsRef.current),
      );
      engine.setSource(shaderRenderer.canvas);
      engine.updateSourceFrame(shaderRenderer.canvas);
      const previewCanvas = shaderPreviewCanvasRef.current;
      if (previewCanvas) {
        if (previewCanvas.width !== shaderRenderer.width) previewCanvas.width = shaderRenderer.width;
        if (previewCanvas.height !== shaderRenderer.height) previewCanvas.height = shaderRenderer.height;
        previewCanvas.getContext("2d")?.drawImage(shaderRenderer.canvas, 0, 0);
      }
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
      loadTextureSource(entry, editTheme)
        .then((loaded) => {
          if (seq !== textureLoadSeqRef.current) {
            if (loaded.video) loaded.video.pause();
            if (loaded.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
            return;
          }
          try {
            applyLoadedSource(loaded, entry.origin !== "upload");
            beginRevealRef.current(engine);
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
    [editTheme, setTextureId],
  );

  const applyConnectTextureSource = useCallback(
    (shapeType: ConnectShapeType = labSettingsRef.current.connectShapeType) => {
      if (manualRef.current) return;
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine) return;
      if (prevVideoRef.current) {
        prevVideoRef.current.pause();
        prevVideoRef.current = null;
      }
      textureLoadSeqRef.current++;
      const shaderBaseSize = shaderOriginalSize(labSettingsRef.current);
      const camera = connectCameraFromSettings(labSettingsRef.current);
      const params = labSettingsRef.current.connectShaderParams;

      shaderRendererRef.current?.dispose();
      shaderRendererRef.current = null;
      twizzlerSineRendererRef.current?.dispose();
      twizzlerSineRendererRef.current = null;
      twizzlerMapRendererRef.current = null;
      cometLogoRendererRef.current?.dispose();
      cometLogoRendererRef.current = null;

      let renderer = connectRendererRef.current;
      try {
        if (!renderer) {
          renderer = createConnectTextureRenderer(shaderBaseSize.w, shaderBaseSize.h, shapeType, camera, params);
          connectRendererRef.current = renderer;
        } else {
          renderer.resize(shaderBaseSize.w, shaderBaseSize.h);
          renderer.setShape(shapeType);
          renderer.setCamera(camera);
          renderer.setParams(params);
        }
      } catch (error) {
        setShaderSourceError(error instanceof Error ? error.message : String(error));
        return;
      }

      setShaderSourceError(null);
      renderer.render(shaderTimeSecRef.current);
      engine.setSource(renderer.canvas);
      setVideoEl(null);
      setSourcePreview({
        source: renderer.canvas,
        video: null,
        objectUrl: null,
        width: renderer.width,
        height: renderer.height,
      });
      const src = shaderBaseSize;
      setSourceSize(src);
      if (canvas && shell) applyCanvasSize(engine, canvas, src, labSettingsRef.current);
      beginRevealRef.current(engine);
      if (manualRef.current) engine.renderFrame();
    },
    [applyCanvasSize, shell],
  );

  const applyShaderTextureSource = useCallback(
    (sourceCode: string) => {
      if (manualRef.current) return;
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine) return;
      if (prevVideoRef.current) {
        prevVideoRef.current.pause();
        prevVideoRef.current = null;
      }
      textureLoadSeqRef.current++;
      const shaderBaseSize = shaderOriginalSize(labSettingsRef.current);

      connectRendererRef.current?.dispose();
      connectRendererRef.current = null;
      twizzlerMapRendererRef.current = null;
      cometLogoRendererRef.current?.dispose();
      cometLogoRendererRef.current = null;

      let renderer = shaderRendererRef.current;
      try {
        if (!renderer) {
          renderer = createShaderTextureRenderer(shaderBaseSize.w, shaderBaseSize.h);
          shaderRendererRef.current = renderer;
        }
        renderer.resize(shaderBaseSize.w, shaderBaseSize.h);
      } catch (error) {
        setShaderSourceError(error instanceof Error ? error.message : String(error));
        return;
      }

      const compileError = renderer.setSource(sourceCode);
      setShaderSourceError(compileError);
      if (compileError) return;

      renderer.render(shaderTimeSecRef.current, shaderMouseRef.current, shaderViewFromSettings(labSettingsRef.current));
      engine.setSource(renderer.canvas);
      setVideoEl(null);
      setSourcePreview({
        source: renderer.canvas,
        video: null,
        objectUrl: null,
        width: renderer.width,
        height: renderer.height,
      });
      const src = shaderBaseSize;
      setSourceSize(src);
      if (canvas && shell) applyCanvasSize(engine, canvas, src, labSettingsRef.current);
      beginRevealRef.current(engine);
      if (manualRef.current) engine.renderFrame();
    },
    [applyCanvasSize, shell],
  );

  const applyTwizzlerMapTextureSource = useCallback(() => {
    if (manualRef.current) return;
    if (textureSourceModeRef.current !== "shader") return;
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine) return;
    if (prevVideoRef.current) {
      prevVideoRef.current.pause();
      prevVideoRef.current = null;
    }
    textureLoadSeqRef.current++;
    const shaderBaseSize = shaderOriginalSize(labSettingsRef.current);
    connectRendererRef.current?.dispose();
    connectRendererRef.current = null;
    shaderRendererRef.current?.dispose();
    shaderRendererRef.current = null;
    cometLogoRendererRef.current?.dispose();
    cometLogoRendererRef.current = null;

    let renderer = twizzlerMapRendererRef.current;
    if (!renderer) {
      renderer = createTwizzlerMapRenderer(shaderBaseSize.w, shaderBaseSize.h);
      twizzlerMapRendererRef.current = renderer;
    } else {
      renderer.resize(shaderBaseSize.w, shaderBaseSize.h);
    }
    renderer.render(twizzlerTimeSecRef.current, shaderTimeSecRef.current, twizzlerRef.current, twizzlerMapRef.current);
    setShaderSourceError(null);
    engine.setSource(renderer.canvas);
    setVideoEl(null);
    setSourcePreview({
      source: renderer.canvas,
      video: null,
      objectUrl: null,
      width: renderer.width,
      height: renderer.height,
    });
    setSourceSize(shaderBaseSize);
    if (canvas && shell) applyCanvasSize(engine, canvas, shaderBaseSize, labSettingsRef.current);
    beginRevealRef.current(engine);
    if (manualRef.current) engine.renderFrame();
  }, [applyCanvasSize, shell]);

  const applyCometLogoTextureSource = useCallback(() => {
    if (manualRef.current) return;
    if (textureSourceModeRef.current !== "shader") return;
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine) return;
    if (prevVideoRef.current) {
      prevVideoRef.current.pause();
      prevVideoRef.current = null;
    }
    textureLoadSeqRef.current++;
    const shaderBaseSize = shaderOriginalSize(labSettingsRef.current);
    connectRendererRef.current?.dispose();
    connectRendererRef.current = null;
    shaderRendererRef.current?.dispose();
    shaderRendererRef.current = null;
    twizzlerMapRendererRef.current = null;

    let renderer = cometLogoRendererRef.current;
    try {
      if (!renderer) {
        renderer = createCometLogoTextureRenderer(shaderBaseSize.w, shaderBaseSize.h);
        cometLogoRendererRef.current = renderer;
      } else {
        renderer.resize(shaderBaseSize.w, shaderBaseSize.h);
      }
    } catch (error) {
      setShaderSourceError(error instanceof Error ? error.message : String(error));
      return;
    }

    const hovered = shaderMouseRef.current.hovered || canvas?.matches(":hover") === true;
    shaderMouseRef.current = { ...shaderMouseRef.current, hovered };
    renderer.render(shaderTimeSecRef.current, { ...shaderMouseRef.current, hovered }, cometLogoRef.current);
    setShaderSourceError(null);
    engine.setSource(renderer.canvas);
    setVideoEl(null);
    setSourcePreview({
      source: renderer.canvas,
      video: null,
      objectUrl: null,
      width: renderer.width,
      height: renderer.height,
    });
    setSourceSize(shaderBaseSize);
    if (canvas && shell) applyCanvasSize(engine, canvas, shaderBaseSize, labSettingsRef.current);
    beginRevealRef.current(engine);
    if (manualRef.current) engine.renderFrame();
  }, [applyCanvasSize, shell]);

  const applyActiveShaderSource = useCallback(() => {
    if (isSpiralShaderPreset(shaderPresetIdRef.current)) {
      applyConnectTextureSource(labSettingsRef.current.connectShapeType);
      return;
    }
    if (isCometLogoShaderPreset(shaderPresetIdRef.current)) {
      applyCometLogoTextureSource();
      return;
    }
    if (isTwizzlerMapShaderPreset(shaderPresetIdRef.current)) {
      applyTwizzlerMapTextureSource();
      return;
    }
    applyShaderTextureSource(shaderSourceCodeRef.current);
  }, [applyCometLogoTextureSource, applyConnectTextureSource, applyShaderTextureSource, applyTwizzlerMapTextureSource]);

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
    } else {
      // Reserve the final layout size before async shader/texture init paints a tiny default canvas.
      const expected = expectedSourceSize(labSettingsRef.current, textureSourceModeRef.current);
      const sized = applyCanvasCssSize(canvas, expected, labSettingsRef.current);
      if (sized) engine.resize(sized.cssW, sized.cssH);
      if (expected.w > 0 && expected.h > 0) {
        sourceSizeRef.current = expected;
        setSourceSize(expected);
      }
    }

    onReplayRef.current = () => beginRevealRef.current(engine);

    const buildExportSvg = (): string => {
      const cfg = controlsRef.current;
      const graphicMode =
        clientGraphicModeRef.current ?? resolveClientGraphicMode(twizzlerRef.current.enabled, cfg.sparkle.gaps.enabled);
      const { includeTwizzler, includeRain } = resolveClientSvgExportLayers(graphicMode);
      const emptyReadback = { cols: 1, rows: 1, values: new Uint8Array([0]), colors: null };
      const readback = includeRain ? engine.readCellGrid() : emptyReadback;
      const canvasWidthPx = Math.round(Number.parseFloat(canvas.style.width) || canvas.clientWidth || canvas.width);
      const canvasHeightPx = Math.round(Number.parseFloat(canvas.style.height) || canvas.clientHeight || canvas.height);
      const resolvedStripes = includeRain ? effectiveStripes(cfg) : [];
      const stripes = resolvedStripes.map((s) => ({
        hex: "#" + s.color.toString(16).padStart(6, "0"),
        startFrom: s.startFrom,
        width: s.width,
        opacity: s.opacity,
      }));
      const lab = labSettingsRef.current;
      let twizzlerSvgLayer: string | undefined;
      if (includeTwizzler && lab.textureSourceMode === "shader") {
        const stageBackgroundHex = cfg.background.transparent
          ? (twizzlerRef.current.backgroundColor ?? "#ffffff")
          : "#" + cfg.background.color.toString(16).padStart(6, "0");
        twizzlerSvgLayer = twizzlerToSvgLayer(
          canvas.width,
          canvas.height,
          canvasWidthPx,
          canvasHeightPx,
          twizzlerTimeSecRef.current,
          {
            ...twizzlerRef.current,
            backgroundColor: stageBackgroundHex,
          },
        );
      }
      const exportBackground = resolveSvgExportBackground({
        backgroundTransparent: cfg.background.transparent,
        backgroundGradientEnabled: cfg.background.gradient.enabled,
        backgroundColorHex: "#" + cfg.background.color.toString(16).padStart(6, "0"),
        backgroundGradient: cfg.background.gradient.enabled
          ? {
              direction: cfg.background.gradient.direction,
              stopCount: cfg.background.gradient.stopCount,
              stops: cfg.background.gradient.stops.map((color) => "#" + color.toString(16).padStart(6, "0")),
            }
          : undefined,
      });
      const framesSvgLayer =
        includeRain && cfg.frames.enabled
          ? framesOverlayToSvg(
              buildFrameGroups(
                readback,
                cfg.frames.luminanceThreshold,
                cfg.frames.groupDistanceCells,
                resolvedStripes,
                cfg.frames.highlightedStripeCount,
              ),
              cfg,
              canvasWidthPx,
              canvasHeightPx,
              performance.now() / 1000,
            )
          : undefined;
      return cellGridToSvg(readback, stripes, {
        cellWidthPx: cfg.grid.cellWidth,
        cellHeightPx: cfg.grid.cellHeight,
        gapX: cfg.grid.gapX,
        gapY: cfg.grid.gapY,
        useCellColors: includeRain && readback.colors !== null,
        orientation: cfg.grid.orientation,
        angleDeg: cfg.grid.angleDeg,
        rotationMode: cfg.grid.rotationMode,
        overlapAmount: cfg.grid.overlapAmount,
        streamGapWave: cfg.grid.streamGapWave,
        backgroundHex: exportBackground.backgroundHex,
        letters: includeRain ? cfg.letters : { ...cfg.letters, enabled: false },
        blendMode: cfg.colors.stripeBlendMode,
        widthSparkle: includeRain ? cfg.sparkle.width : undefined,
        stripeDots: includeRain ? cfg.stripeDots : undefined,
        stripeBorder: includeRain ? cfg.stripeBorder : undefined,
        gridLines: includeRain ? cfg.gridLines : undefined,
        framesSvgLayer: includeRain ? framesSvgLayer : undefined,
        gradient:
          includeRain && cfg.colors.gradient.enabled
            ? {
                direction: cfg.colors.gradient.direction,
                stopCount: cfg.colors.gradient.stopCount,
                stops: cfg.colors.gradient.stops.map((color) => "#" + color.toString(16).padStart(6, "0")),
                hueDriftDeg: cfg.colors.gradient.hueDriftDeg,
                saturationBoost: cfg.colors.gradient.saturationBoost,
              }
            : undefined,
        backgroundGradient: exportBackground.backgroundGradient,
        // Shader rasters (Connect underlay) are excluded — they blow past Figma's SVG importer.
        backgroundImageHrefs: [],
        backgroundSvgLayer: twizzlerSvgLayer,
        canvasWidthPx,
        canvasHeightPx,
      });
    };
    onExportSvgRef.current = () => {
      const cfg = controlsRef.current;
      const graphicMode =
        clientGraphicModeRef.current ?? resolveClientGraphicMode(twizzlerRef.current.enabled, cfg.sparkle.gaps.enabled);
      const layers = resolveClientSvgExportLayers(graphicMode);
      if (!layers.includeRain && !layers.includeTwizzler) {
        window.alert("Enable Rain or Twizzler before exporting an SVG.");
        return;
      }
      try {
        downloadSvg(buildExportSvg());
      } catch (error) {
        window.alert(`SVG export failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    onExportVideoRef.current = () => {
      const engineCanvas = canvasRef.current;
      if (!engineCanvas) return;
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
      const exportGeneration = ++videoExportGenerationRef.current;
      const ui = videoExportUiRef.current;
      let transcodeStartedAt = 0;
      ui.setPhase("recording");
      ui.setRecording({ elapsedMs: 0, totalMs: durationSec * 1000 });
      ui.setTranscodePercent(null);
      ui.setTranscodeElapsed(0);
      const framesEnabled =
        controlsRef.current.frames.enabled && (!clientMode || controlsRef.current.sparkle.gaps.enabled);
      const layers =
        surfaceWorkspaceRef.current.mode === "partial"
          ? {
              canvas: partialCompositeCanvasRef.current ?? engineCanvas,
              underlayCanvases: undefined as HTMLCanvasElement[] | undefined,
              overlayCanvases: undefined as HTMLCanvasElement[] | undefined,
            }
          : resolveLabVideoExportLayers({
              engineCanvas,
              twizzlerCanvas: twizzlerCanvasRef.current,
              framesCanvas: framesCanvasRef.current,
              twizzlerVisible: shouldShowTwizzlerOverlay(textureSourceModeRef.current, twizzlerRef.current.enabled),
              // Match showRainRectOverlay: client Rain off hides the opaque engine pass.
              rainVisible: !clientMode || controlsRef.current.sparkle.gaps.enabled,
              framesEnabled,
            });
      void exportLabVideo({
        canvas: layers.canvas,
        sourceKind: video ? "video" : "image",
        video: video ?? undefined,
        backgroundColor: controlsRef.current.background.transparent ? undefined : controlsRef.current.background.color,
        underlayCanvases: layers.underlayCanvases,
        overlayCanvases: layers.overlayCanvases,
        startTimeSec: exportStartSec,
        durationSec,
        signal: controller.signal,
        onPhase: (phase) => {
          if (videoExportGenerationRef.current !== exportGeneration) return;
          ui.setPhase(phase);
          if ((phase === "loading-encoder" || phase === "transcoding") && transcodeStartedAt === 0) {
            transcodeStartedAt = performance.now();
          }
        },
        onProgress: (elapsedMs, totalMs) => {
          if (videoExportGenerationRef.current !== exportGeneration) return;
          ui.setRecording({ elapsedMs, totalMs });
        },
        onTranscodeProgress: (percent) => {
          if (videoExportGenerationRef.current !== exportGeneration) return;
          ui.setTranscodePercent(percent);
          if (transcodeStartedAt > 0) {
            ui.setTranscodeElapsed(performance.now() - transcodeStartedAt);
          }
        },
      })
        .catch(() => {
          if (videoExportGenerationRef.current === exportGeneration) {
            ui.setPhase("failed");
          }
        })
        .finally(() => {
          if (videoExportGenerationRef.current === exportGeneration) {
            videoExportAbortRef.current = null;
          }
          window.setTimeout(() => {
            if (videoExportGenerationRef.current !== exportGeneration) return;
            exportingVideoRef.current = false;
            ui.setPhase("idle");
            ui.setRecording({ elapsedMs: 0, totalMs: 0 });
            ui.setTranscodePercent(null);
            ui.setTranscodeElapsed(0);
          }, 1200);
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
      triggerReveal: () => beginRevealRef.current(engine),
    };

    const partialFramesCanvas = document.createElement("canvas");

    const renderPartialSurfaces = (now: number) => {
      const workspace = surfaceWorkspaceRef.current;
      if (workspace.mode !== "partial") return;
      const composite = partialCompositeCanvasRef.current;
      if (!composite) return;
      if (composite.width !== canvas.width) composite.width = canvas.width;
      if (composite.height !== canvas.height) composite.height = canvas.height;
      const context = composite.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, composite.width, composite.height);
      const areas = workspace.areas.filter((area) => area.visible).reverse();
      for (const area of areas) {
        let config = normalizeEngineConfig(resolveThemedConfig(area.config, editTheme));
        if (backgroundSourceOpacityRef.current > 0.001) {
          config = { ...config, background: { ...config.background, transparent: true } };
        }
        engine.setConfig(config);
        engine.renderFrame();
        context.save();
        context.beginPath();
        area.points.forEach((point, index) => {
          const x = point.x * composite.width;
          const y = point.y * composite.height;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.closePath();
        context.clip();
        context.drawImage(canvas, 0, 0, composite.width, composite.height);
        if (config.frames.enabled) {
          const readback = engine.readCellGrid();
          const groups = buildFrameGroups(
            readback,
            config.frames.luminanceThreshold,
            config.frames.groupDistanceCells,
            effectiveStripes(config),
            config.frames.highlightedStripeCount,
          );
          renderFramesOverlay(partialFramesCanvas, groups, config, composite.width, composite.height, now / 1000);
          context.drawImage(partialFramesCanvas, 0, 0, composite.width, composite.height);
        }
        context.restore();
      }
      const twizzlerCanvas = twizzlerCanvasRef.current;
      if (twizzlerCanvas && !twizzlerCanvas.hidden && areas.length > 0) {
        context.save();
        context.beginPath();
        for (const area of areas) {
          area.points.forEach((point, index) => {
            const x = point.x * composite.width;
            const y = point.y * composite.height;
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.closePath();
        }
        context.clip();
        context.drawImage(twizzlerCanvas, 0, 0, composite.width, composite.height);
        context.restore();
      }
    };

    let raf = 0;
    if (!manual) {
      if (textureSourceModeRef.current === "shader") {
        if (isSpiralShaderPreset(shaderPresetIdRef.current)) {
          applyConnectTextureSource(labSettingsRef.current.connectShapeType);
        } else if (isCometLogoShaderPreset(shaderPresetIdRef.current)) {
          applyCometLogoTextureSource();
        } else if (isTwizzlerMapShaderPreset(shaderPresetIdRef.current)) {
          applyTwizzlerMapTextureSource();
        } else {
          applyShaderTextureSource(shaderSourceCode);
        }
      } else {
        loadTextureById(textureIdRef.current);
      }
      let lastSnapAt = 0;
      let lastShaderPreviewAt = 0;
      let lastFramesReadbackAt = 0;
      let lastTwizzlerAt = 0;
      let frameGroups: FrameGroup[] = [];
      const tick = () => {
        const now = performance.now();
        const deltaSec = Math.max(0, Math.min(0.1, (now - shaderLastTickMsRef.current) / 1000));
        shaderLastTickMsRef.current = now;
        if (textureSourceModeRef.current === "shader") {
          if (shaderPlayingRef.current) shaderTimeSecRef.current += deltaSec;
          if (twizzlerPlayingRef.current) twizzlerTimeSecRef.current += deltaSec;

          if (isSpiralShaderPreset(shaderPresetIdRef.current)) {
            const connectRenderer = connectRendererRef.current;
            if (connectRenderer) {
              connectRenderer.render(shaderTimeSecRef.current);
              engine.updateSourceFrame(connectRenderer.canvas);
              const previewCanvas = shaderPreviewCanvasRef.current;
              const previewSizeChanged =
                !!previewCanvas &&
                (previewCanvas.width !== connectRenderer.width || previewCanvas.height !== connectRenderer.height);
              if (previewCanvas && !clientModeRef.current && (previewSizeChanged || now - lastShaderPreviewAt >= 100)) {
                lastShaderPreviewAt = now;
                if (previewCanvas.width !== connectRenderer.width) previewCanvas.width = connectRenderer.width;
                if (previewCanvas.height !== connectRenderer.height) previewCanvas.height = connectRenderer.height;
                previewCanvas.getContext("2d")?.drawImage(connectRenderer.canvas, 0, 0);
              }
            }
          } else if (isCometLogoShaderPreset(shaderPresetIdRef.current)) {
            const renderer = cometLogoRendererRef.current;
            if (renderer) {
              renderer.render(shaderTimeSecRef.current, shaderMouseRef.current, cometLogoRef.current);
              engine.updateSourceFrame(renderer.canvas);
              const previewCanvas = shaderPreviewCanvasRef.current;
              const previewSizeChanged =
                !!previewCanvas && (previewCanvas.width !== renderer.width || previewCanvas.height !== renderer.height);
              if (previewCanvas && !clientModeRef.current && (previewSizeChanged || now - lastShaderPreviewAt >= 100)) {
                lastShaderPreviewAt = now;
                if (previewCanvas.width !== renderer.width) previewCanvas.width = renderer.width;
                if (previewCanvas.height !== renderer.height) previewCanvas.height = renderer.height;
                previewCanvas.getContext("2d")?.drawImage(renderer.canvas, 0, 0);
              }
            }
          } else if (isTwizzlerMapShaderPreset(shaderPresetIdRef.current)) {
            const renderer = twizzlerMapRendererRef.current;
            if (renderer) {
              renderer.render(
                twizzlerTimeSecRef.current,
                shaderTimeSecRef.current,
                twizzlerRef.current,
                twizzlerMapRef.current,
              );
              engine.updateSourceFrame(renderer.canvas);
              const previewCanvas = shaderPreviewCanvasRef.current;
              const previewSizeChanged =
                !!previewCanvas && (previewCanvas.width !== renderer.width || previewCanvas.height !== renderer.height);
              if (previewCanvas && !clientModeRef.current && (previewSizeChanged || now - lastShaderPreviewAt >= 100)) {
                lastShaderPreviewAt = now;
                if (previewCanvas.width !== renderer.width) previewCanvas.width = renderer.width;
                if (previewCanvas.height !== renderer.height) previewCanvas.height = renderer.height;
                previewCanvas.getContext("2d")?.drawImage(renderer.canvas, 0, 0);
              }
            }
          } else {
            const shaderRenderer = shaderRendererRef.current;
            if (shaderRenderer) {
              if (isTwizzlerSineShaderPreset(shaderPresetIdRef.current)) {
                const tw = twizzlerRef.current;
                shaderRenderer.setUniforms(
                  twizzlerSineUniforms(tw, {
                    rotateXDeg: tw.rotateX,
                    rotateYDeg: tw.rotateY,
                    rotateZDeg: tw.rotateZ,
                    panX: tw.panX,
                    panY: tw.panY,
                    distance: tw.viewDistance,
                  }),
                );
              }
              shaderRenderer.render(
                shaderTimeSecRef.current,
                shaderMouseRef.current,
                // Twizzler Sine handles XYZ itself with edge-locked X — keep wrapper identity.
                isTwizzlerSineShaderPreset(shaderPresetIdRef.current)
                  ? null
                  : shaderViewFromSettings(labSettingsRef.current),
              );
              engine.updateSourceFrame(shaderRenderer.canvas);
              const previewCanvas = shaderPreviewCanvasRef.current;
              const previewSizeChanged =
                !!previewCanvas &&
                (previewCanvas.width !== shaderRenderer.width || previewCanvas.height !== shaderRenderer.height);
              if (previewCanvas && !clientModeRef.current && (previewSizeChanged || now - lastShaderPreviewAt >= 100)) {
                lastShaderPreviewAt = now;
                if (previewCanvas.width !== shaderRenderer.width) previewCanvas.width = shaderRenderer.width;
                if (previewCanvas.height !== shaderRenderer.height) previewCanvas.height = shaderRenderer.height;
                previewCanvas.getContext("2d")?.drawImage(shaderRenderer.canvas, 0, 0);
              }
            }
          }
        }
        const twizzlerCanvas = twizzlerCanvasRef.current;
        const outputCanvas = canvasRef.current;
        if (twizzlerCanvas && outputCanvas) {
          if (shouldShowTwizzlerOverlay(textureSourceModeRef.current, twizzlerRef.current.enabled)) {
            // Both-mode soft-cap: Twizzler Canvas2D ~30fps when rain is also on (rain source stays full-rate).
            const bothHeavy = clientModeRef.current && controlsRef.current.sparkle.gaps.enabled;
            if (!(bothHeavy && now - lastTwizzlerAt < 33)) {
              lastTwizzlerAt = now;
              const tw = twizzlerRef.current;
              const bg = controlsRef.current.background;
              const stageBackgroundHex = bg.transparent
                ? (tw.backgroundColor ?? "#ffffff")
                : "#" + bg.color.toString(16).padStart(6, "0");
              const twWithBackground = { ...tw, backgroundColor: stageBackgroundHex };
              if (shouldUseTwizzlerSineShader(tw)) {
                let sine = twizzlerSineRendererRef.current;
                if (!sine) {
                  sine = createShaderTextureRenderer(outputCanvas.width, outputCanvas.height);
                  const err = sine.setSource(TWIZZLER_SINE_SHADER_SOURCE);
                  if (err) {
                    console.error("Twizzler sine shader compile failed:", err);
                    renderTwizzler(
                      twizzlerCanvas,
                      outputCanvas.width,
                      outputCanvas.height,
                      twizzlerTimeSecRef.current,
                      twWithBackground,
                    );
                  } else {
                    twizzlerSineRendererRef.current = sine;
                  }
                }
                sine = twizzlerSineRendererRef.current;
                if (sine) {
                  sine.resize(outputCanvas.width, outputCanvas.height);
                  sine.setUniforms(
                    twizzlerSineUniforms(tw, {
                      rotateXDeg: tw.rotateX,
                      rotateYDeg: tw.rotateY,
                      rotateZDeg: tw.rotateZ,
                      panX: tw.panX,
                      panY: tw.panY,
                      distance: tw.viewDistance,
                    }),
                  );
                  // Identity wrapper view — XYZ is applied inside the exact shader (edge-locked X).
                  sine.render(twizzlerTimeSecRef.current, undefined, null);
                  if (twizzlerCanvas.width !== sine.width) twizzlerCanvas.width = sine.width;
                  if (twizzlerCanvas.height !== sine.height) twizzlerCanvas.height = sine.height;
                  const ctx = twizzlerCanvas.getContext("2d");
                  ctx?.clearRect(0, 0, twizzlerCanvas.width, twizzlerCanvas.height);
                  ctx?.drawImage(sine.canvas, 0, 0);
                }
              } else {
                renderTwizzler(
                  twizzlerCanvas,
                  outputCanvas.width,
                  outputCanvas.height,
                  twizzlerTimeSecRef.current,
                  twWithBackground,
                );
              }
            }
          } else {
            clearTwizzler(twizzlerCanvas);
          }
        }
        const framesCanvas = framesCanvasRef.current;
        if (framesCanvas && outputCanvas) {
          const rainOn = !clientModeRef.current || controlsRef.current.sparkle.gaps.enabled;
          const frameConfig = controlsRef.current.frames;
          if (frameConfig.enabled && rainOn) {
            if (framesCanvas.width !== outputCanvas.width) framesCanvas.width = outputCanvas.width;
            if (framesCanvas.height !== outputCanvas.height) framesCanvas.height = outputCanvas.height;
            if (now - lastFramesReadbackAt >= 33) {
              lastFramesReadbackAt = now;
              frameGroups = buildFrameGroups(
                engine.readCellGrid(),
                frameConfig.luminanceThreshold,
                frameConfig.groupDistanceCells,
                effectiveStripes(controlsRef.current),
                frameConfig.highlightedStripeCount,
              );
            }
            const cssWidth =
              Number.parseFloat(outputCanvas.style.width) || outputCanvas.clientWidth || outputCanvas.width;
            const cssHeight =
              Number.parseFloat(outputCanvas.style.height) || outputCanvas.clientHeight || outputCanvas.height;
            renderFramesOverlay(framesCanvas, frameGroups, controlsRef.current, cssWidth, cssHeight, now / 1000);
          } else {
            clearFramesOverlay(framesCanvas);
          }
        }
        if (now - lastSnapAt >= 500) {
          lastSnapAt = now;
          setSnap(engine.getPerf());
        }
        renderPartialSurfaces(now);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      engine.renderFrame();
      renderPartialSurfaces(performance.now());
      setSnap(engine.getPerf());
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.code !== "KeyS") return;
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      )
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
      shaderRendererRef.current?.dispose();
      shaderRendererRef.current = null;
      twizzlerSineRendererRef.current?.dispose();
      twizzlerSineRendererRef.current = null;
      connectRendererRef.current?.dispose();
      connectRendererRef.current = null;
      twizzlerMapRendererRef.current = null;
      cometLogoRendererRef.current?.dispose();
      cometLogoRendererRef.current = null;
      engine.dispose();
      engineRef.current = null;
      (window as unknown as { __lab?: unknown }).__lab = undefined;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || manual) return;
    // Match production: keep the stripes engine running in full mode (Rain colors need a live source).
    if (surfaceWorkspace.mode === "full") engine.start();
    else engine.stop();
  }, [manual, surfaceWorkspace.mode]);

  useEffect(() => {
    if (!shell) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const src =
      sourceSizeRef.current.w > 0 && sourceSizeRef.current.h > 0
        ? sourceSizeRef.current
        : expectedSourceSize(labSettings, textureSourceModeRef.current);
    // Size the DOM canvas immediately so fit-zoom has real geometry before the shader finishes.
    applyCanvasCssSize(canvas, src, labSettings);
    const engine = engineRef.current;
    if (!engine) return;
    applyCanvasSize(engine, canvas, src, labSettings);
  }, [labSettings, shell, applyCanvasSize]);

  const centerCanvasViewport = useCallback(() => {
    const area = canvasAreaRef.current;
    if (!area) return;
    area.scrollLeft = Math.max(0, (area.scrollWidth - area.clientWidth) / 2);
    area.scrollTop = Math.max(0, (area.scrollHeight - area.clientHeight) / 2);
  }, []);

  const fitPreviewZoomToViewport = useCallback(() => {
    const area = canvasAreaRef.current;
    if (!area || area.clientWidth <= 0 || area.clientHeight <= 0) return false;
    const settings = labSettingsRef.current;
    const srcW =
      sourceSizeRef.current.w > 0
        ? sourceSizeRef.current.w
        : settings.textureSourceMode === "shader"
          ? Math.max(1, Math.round(settings.shaderSourceWidth))
          : 0;
    const srcH =
      sourceSizeRef.current.h > 0
        ? sourceSizeRef.current.h
        : settings.textureSourceMode === "shader"
          ? Math.max(1, Math.round(settings.shaderSourceHeight))
          : 0;
    if (srcW <= 0 || srcH <= 0) return false;
    const { cssW, cssH } = computeLabCanvasSize(srcW, srcH, settings);
    const style = window.getComputedStyle(area);
    const padX = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
    const padY = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
    const next = computeFitPreviewZoom({
      canvasWidth: cssW,
      canvasHeight: cssH,
      viewportWidth: Math.max(1, area.clientWidth - padX),
      viewportHeight: Math.max(1, area.clientHeight - padY),
    });
    setPreviewZoom((current) => (Math.abs(current - next) < 0.001 ? current : next));
    return true;
  }, []);

  useEffect(() => {
    if (!shell || hasAutoFittedPreviewZoomRef.current) return;
    const area = canvasAreaRef.current;
    if (!area) return;

    const tryFit = () => {
      if (hasAutoFittedPreviewZoomRef.current) return;
      const finalSizeKnown =
        labSettingsRef.current.canvasMode === "manual" || (sourceSizeRef.current.w > 0 && sourceSizeRef.current.h > 0);
      if (!finalSizeKnown) return;
      if (!hasStoredPreviewZoomRef.current && !fitPreviewZoomToViewport()) return;
      hasAutoFittedPreviewZoomRef.current = true;
      window.requestAnimationFrame(() => {
        centerCanvasViewport();
        setPreviewZoomReady(true);
      });
    };

    tryFit();
    const frame = window.requestAnimationFrame(tryFit);
    const observer = new ResizeObserver(() => tryFit());
    observer.observe(area);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [shell, fitPreviewZoomToViewport, centerCanvasViewport, textureSourceMode, sourceSize.w, sourceSize.h]);

  useEffect(() => {
    if (!shell) return;
    const area = canvasAreaRef.current;
    if (!area) return;

    let frame2 = 0;
    const frame1 = window.requestAnimationFrame(() => {
      centerCanvasViewport();
      frame2 = window.requestAnimationFrame(() => {
        centerCanvasViewport();
      });
    });

    const observer = new ResizeObserver(() => {
      centerCanvasViewport();
    });
    observer.observe(area);
    const stage = area.querySelector(".lab-canvas-stage");
    if (stage) observer.observe(stage);
    const stack = area.querySelector(".lab-canvas-stack");
    if (stack) observer.observe(stack);

    const onTransitionEnd = (event: Event) => {
      if (!(event instanceof TransitionEvent) || event.propertyName !== "width") return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains("lab-sidebar")) return;
      centerCanvasViewport();
    };
    const shellEl = area.closest(".lab-shell");
    shellEl?.addEventListener("transitionend", onTransitionEnd);

    return () => {
      window.cancelAnimationFrame(frame1);
      if (frame2) window.cancelAnimationFrame(frame2);
      observer.disconnect();
      shellEl?.removeEventListener("transitionend", onTransitionEnd);
    };
  }, [
    shell,
    centerCanvasViewport,
    textureSourceMode,
    sourceSize.w,
    sourceSize.h,
    previewZoom,
    labSettings.canvasMode,
    labSettings.canvasScale,
    labSettings.canvasWidth,
    labSettings.canvasHeight,
    labSettings.textureSidebarOpen,
    labSettings.shaderSidebarOpen,
    labSettings.textureSidebarWidth,
    labSettings.shaderSidebarWidth,
  ]);

  useEffect(() => {
    if (manual) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e: PointerEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const point = pointerToEnginePoint(canvas, e);
      engine.setCursor(point.x, point.y);
      const shaderRenderer = shaderRendererRef.current;
      const cometRenderer = cometLogoRendererRef.current;
      if (textureSourceModeRef.current === "shader" && cometRenderer) {
        shaderMouseRef.current = pointerToTextureMouse(
          canvas,
          cometRenderer.width,
          cometRenderer.height,
          e,
          shaderMouseRef.current.down,
        );
      } else if (textureSourceModeRef.current === "shader" && shaderRenderer && shaderMouseRef.current.down) {
        shaderMouseRef.current = pointerToShaderMouse(canvas, shaderRenderer, e, true);
      } else {
        shaderMouseRef.current = { ...shaderMouseRef.current, hovered: true };
      }
    };
    const onEnter = (e: PointerEvent) => {
      const cometRenderer = cometLogoRendererRef.current;
      if (textureSourceModeRef.current === "shader" && cometRenderer) {
        shaderMouseRef.current = pointerToTextureMouse(canvas, cometRenderer.width, cometRenderer.height, e, false);
      } else {
        shaderMouseRef.current = { ...shaderMouseRef.current, hovered: true };
      }
    };
    const onLeave = () => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setCursor(null);
      shaderMouseRef.current = { ...shaderMouseRef.current, down: false, hovered: false };
    };
    const onDown = (e: PointerEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const workspace = surfaceWorkspaceRef.current;
      if (workspace.mode === "partial" && drawingSurfaceAreaKindRef.current === null) {
        const rect = canvas.getBoundingClientRect();
        const area = findSurfaceAreaAtPoint(workspace.areas, {
          x: rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0,
          y: rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0,
        });
        const nextSelectedAreaId = area?.id ?? null;
        if (nextSelectedAreaId !== workspace.selectedAreaId) onSelectSurfaceAreaRef.current(nextSelectedAreaId);
      }
      const point = pointerToEnginePoint(canvas, e);
      engine.click(point.x, point.y);
      canvas.setPointerCapture?.(e.pointerId);
      const shaderRenderer = shaderRendererRef.current;
      const cometRenderer = cometLogoRendererRef.current;
      if (textureSourceModeRef.current === "shader" && cometRenderer) {
        shaderMouseRef.current = pointerToTextureMouse(canvas, cometRenderer.width, cometRenderer.height, e, true);
      } else if (textureSourceModeRef.current === "shader" && shaderRenderer) {
        shaderMouseRef.current = pointerToShaderMouse(canvas, shaderRenderer, e, true);
      } else {
        shaderMouseRef.current = { ...shaderMouseRef.current, down: true, hovered: true };
      }
    };
    const onUp = (e: PointerEvent) => {
      canvas.releasePointerCapture?.(e.pointerId);
      const shaderRenderer = shaderRendererRef.current;
      const cometRenderer = cometLogoRendererRef.current;
      if (textureSourceModeRef.current === "shader" && cometRenderer && shaderMouseRef.current.down) {
        shaderMouseRef.current = pointerToTextureMouse(canvas, cometRenderer.width, cometRenderer.height, e, false);
      } else if (textureSourceModeRef.current === "shader" && shaderRenderer && shaderMouseRef.current.down) {
        shaderMouseRef.current = pointerToShaderMouse(canvas, shaderRenderer, e, false);
      } else {
        shaderMouseRef.current = { ...shaderMouseRef.current, down: false };
      }
    };
    canvas.addEventListener("pointerenter", onEnter);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [manual]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const frame = window.requestAnimationFrame(() => {
      const liveEngine = engineRef.current;
      if (!liveEngine) return;
      const connectUnderlayActive =
        textureSourceModeRef.current === "shader" &&
        isSpiralShaderPreset(shaderPresetIdRef.current) &&
        labSettingsRef.current.connectGradientUnderlay;
      const twizzlerActive = shouldShowTwizzlerOverlay(textureSourceModeRef.current, twizzlerRef.current.enabled);
      const rainOn = !clientModeRef.current || controls.sparkle.gaps.enabled;
      const rainGated = clientModeRef.current ? withClientRainFxVisibility(controls, rainOn) : controls;
      const previewConfig =
        backgroundSourceOpacity > 0.001 || connectUnderlayActive || twizzlerActive
          ? { ...rainGated, background: { ...rainGated.background, transparent: true } }
          : rainGated;
      const configToApply = manualRef.current
        ? { ...previewConfig, reveal: { ...previewConfig.reveal, enabled: false } }
        : previewConfig;
      const key = JSON.stringify(configToApply);
      if (lastEngineConfigJsonRef.current === key) return;
      lastEngineConfigJsonRef.current = key;
      liveEngine.setConfig(configToApply);
      if (manualRef.current) liveEngine.renderFrame();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    controls,
    backgroundSourceOpacity,
    labSettings.connectGradientUnderlay,
    shaderPresetId,
    textureSourceMode,
    twizzler.enabled,
    clientMode,
  ]);

  useEffect(() => {
    setLabSettings((prev) => {
      const backgroundColor = controls.background.transparent ? null : controls.background.color;
      const uiSnapshot = getLabSettingsSnapshot();
      const { enabled, ...twizzlerSettings } = twizzlerRef.current;
      const next = {
        ...prev,
        ...uiSnapshot,
        backgroundColor,
        twizzlerEnabled: enabled,
        twizzler: twizzlerSettings,
        twizzlerMap: twizzlerMapRef.current,
      };
      const unchanged = JSON.stringify(next) === JSON.stringify(prev);
      if (unchanged) return prev;
      saveLabSettings(next);
      return loadLabSettings();
    });
  }, [controls.background.color, controls.background.transparent, getLabSettingsSnapshot]);

  useEffect(() => {
    if (surfaceWorkspaceRef.current.mode === "partial") return;
    const frame = window.requestAnimationFrame(() => {
      if (surfaceWorkspaceRef.current.mode === "partial") return;
      const themed = composeThemedConfigRef.current();
      const id = textureIdRef.current;
      const key = `${id}:${JSON.stringify(themed)}`;
      if (lastSavedConfigJsonRef.current === key) return;
      lastSavedConfigJsonRef.current = key;
      saveConfig(id, themed);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [controls]);

  useEffect(() => {
    saveTextureId(textureId);
    if (textureSourceModeRef.current === "texture") loadTextureById(textureId);
  }, [textureId, loadTextureById]);

  useEffect(() => {
    const { enabled, ...twizzlerSettings } = twizzlerRef.current;
    saveLabSettings({
      ...labSettingsRef.current,
      ...getLabSettingsSnapshotRef.current(),
      textureSourceMode,
      shaderSourceCode,
      shaderPresetId,
      twizzlerEnabled: enabled,
      twizzler: twizzlerSettings,
      twizzlerMap: twizzlerMapRef.current,
    });
    if (!engineRef.current) return;
    if (textureSourceMode === "shader") {
      applyActiveShaderSource();
    } else {
      const twizzlerCanvas = twizzlerCanvasRef.current;
      if (twizzlerCanvas) clearTwizzler(twizzlerCanvas);
      twizzlerMapRendererRef.current = null;
      shaderRendererRef.current?.dispose();
      shaderRendererRef.current = null;
      twizzlerSineRendererRef.current?.dispose();
      twizzlerSineRendererRef.current = null;
      connectRendererRef.current?.dispose();
      connectRendererRef.current = null;
      cometLogoRendererRef.current?.dispose();
      cometLogoRendererRef.current = null;
      loadTextureById(textureIdRef.current);
    }
  }, [textureSourceMode, applyActiveShaderSource, loadTextureById]);

  useEffect(() => {
    if (textureSourceModeRef.current !== "shader") return;
    if (!engineRef.current) return;
    applyActiveShaderSource();
  }, [
    labSettings.shaderSourceWidth,
    labSettings.shaderSourceHeight,
    labSettings.canvasMode,
    labSettings.canvasScale,
    labSettings.canvasWidth,
    labSettings.canvasHeight,
    applyActiveShaderSource,
  ]);

  useEffect(() => {
    if (textureSourceModeRef.current !== "shader") return;
    if (!isSpiralShaderPreset(shaderPresetIdRef.current)) return;
    if (!engineRef.current) return;
    applyConnectTextureSource(labSettings.connectShapeType);
  }, [labSettings.connectShapeType, applyConnectTextureSource]);

  useEffect(() => {
    if (!connectCamera) return;
    const patch = connectCameraToSettingsPatch(connectCamera);
    const current = labSettingsRef.current;
    if (
      current.connectCameraDistance === patch.connectCameraDistance &&
      current.connectCameraRotateX === patch.connectCameraRotateX &&
      current.connectCameraRotateY === patch.connectCameraRotateY &&
      current.connectCameraRotateZ === patch.connectCameraRotateZ &&
      current.connectCameraPanX === patch.connectCameraPanX &&
      current.connectCameraPanY === patch.connectCameraPanY &&
      current.connectCameraFov === patch.connectCameraFov
    ) {
      return;
    }
    updateLabSettings(patch);
  }, [
    connectCamera,
    connectCamera?.distance,
    connectCamera?.rotateXDeg,
    connectCamera?.rotateYDeg,
    connectCamera?.rotateZDeg,
    connectCamera?.panX,
    connectCamera?.panY,
    connectCamera?.fov,
    updateLabSettings,
  ]);

  useEffect(() => {
    if (!shaderView) return;
    const patch = shaderViewToSettingsPatch(shaderView);
    const current = labSettingsRef.current;
    if (
      current.shaderViewDistance === patch.shaderViewDistance &&
      current.shaderViewRotateX === patch.shaderViewRotateX &&
      current.shaderViewRotateY === patch.shaderViewRotateY &&
      current.shaderViewRotateZ === patch.shaderViewRotateZ &&
      current.shaderViewPanX === patch.shaderViewPanX &&
      current.shaderViewPanY === patch.shaderViewPanY &&
      current.shaderViewFov === patch.shaderViewFov
    ) {
      return;
    }
    updateLabSettings(patch);
  }, [
    shaderView,
    shaderView?.distance,
    shaderView?.rotateXDeg,
    shaderView?.rotateYDeg,
    shaderView?.rotateZDeg,
    shaderView?.panX,
    shaderView?.panY,
    shaderView?.fov,
    updateLabSettings,
  ]);

  useEffect(() => {
    if (!connectShaderParams) return;
    const current = labSettingsRef.current.connectShaderParams;
    if (JSON.stringify(current) === JSON.stringify(connectShaderParams)) return;
    updateLabSettings({ connectShaderParams });
  }, [connectShaderParams, updateLabSettings]);

  useEffect(() => {
    if (connectGradientUnderlay === null) return;
    if (labSettingsRef.current.connectGradientUnderlay === connectGradientUnderlay) return;
    updateLabSettings({ connectGradientUnderlay });
  }, [connectGradientUnderlay, updateLabSettings]);

  useLayoutEffect(() => {
    const current = labSettingsRef.current;
    const { enabled, ...settings } = twizzler;
    if (current.twizzlerEnabled === enabled && JSON.stringify(current.twizzler) === JSON.stringify(settings)) return;
    updateLabSettings({
      twizzlerEnabled: enabled,
      twizzler: settings,
    });
  }, [twizzler, updateLabSettings]);

  useLayoutEffect(() => {
    if (JSON.stringify(labSettingsRef.current.twizzlerMap) === JSON.stringify(twizzlerMap)) return;
    updateLabSettings({ twizzlerMap });
  }, [twizzlerMap, updateLabSettings]);

  useEffect(() => {
    if (textureSourceModeRef.current !== "shader") return;
    if (!isSpiralShaderPreset(shaderPresetIdRef.current)) return;
    const renderer = connectRendererRef.current;
    if (!renderer) return;
    renderer.setCamera(connectCameraFromSettings(labSettings));
    renderer.setParams(labSettings.connectShaderParams);
  }, [
    labSettings.connectCameraDistance,
    labSettings.connectCameraRotateX,
    labSettings.connectCameraRotateY,
    labSettings.connectCameraRotateZ,
    labSettings.connectCameraPanX,
    labSettings.connectCameraPanY,
    labSettings.connectCameraFov,
    labSettings.connectShaderParams,
  ]);

  useEffect(() => {
    const host = connectUnderlayHostRef.current;
    if (!host) return;
    const show =
      textureSourceMode === "shader" && isSpiralShaderPreset(shaderPresetId) && labSettings.connectGradientUnderlay;
    const underlay = connectRendererRef.current?.underlayCanvas ?? null;
    host.replaceChildren();
    if (!show || !underlay) {
      underlayIntroArmedRef.current = false;
      underlayIntroRef.current.hide(host);
      return;
    }
    underlay.className = "lab-canvas-connect-underlay";
    underlay.setAttribute("aria-hidden", "true");
    host.appendChild(underlay);
    if (!underlayIntroArmedRef.current) {
      scheduleConnectUnderlayIntro();
      underlayIntroArmedRef.current = true;
    }
    return () => {
      host.replaceChildren();
    };
  }, [
    textureSourceMode,
    shaderPresetId,
    labSettings.connectGradientUnderlay,
    sourceSize.w,
    sourceSize.h,
    sourcePreview,
    connectShaderParams,
    scheduleConnectUnderlayIntro,
  ]);

  useEffect(() => {
    return () => underlayIntroRef.current.cancel();
  }, []);

  useEffect(() => {
    // Always merge live Twizzler from refs — a stale labSettingsRef must not clobber Speed/Move.
    flushLiveLabPersistence();
  }, [textureId, getLabSettingsSnapshot, flushLiveLabPersistence]);

  function applyLoadedSource(loaded: LoadedTextureSource, detectLevels = true) {
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
    if (detectLevels) {
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
    }
    if (manualRef.current) engine.renderFrame();
  }

  function fullLabSettingsSnapshot(): Partial<LabSettings> {
    const current = controlsRef.current;
    const backgroundColor = current.background.transparent ? null : current.background.color;
    const { enabled: twizzlerEnabled, ...twizzlerSettings } = twizzlerRef.current;
    // Snapshot every live Lab + Leva-backed field so saved layouts round-trip fully.
    return {
      ...labSettingsRef.current,
      ...getLabSettingsSnapshot(),
      textureSourceMode,
      shaderSourceCode,
      shaderPresetId: labSettingsRef.current.shaderPresetId,
      backgroundColor,
      twizzlerEnabled,
      twizzler: twizzlerSettings,
      twizzlerMap: twizzlerMapRef.current,
      cometLogo: cometLogoRef.current,
    };
  }

  function captureSavedLayoutPayload(): {
    config: ReturnType<typeof getActiveThemedConfig>;
    lab: Partial<LabSettings>;
  } {
    const lab = fullLabSettingsSnapshot();
    return {
      config: getActiveThemedConfig(),
      lab,
    };
  }

  function applyImportedSettings(text: string): void {
    const imported = importSettingsFile(text);
    const importedTextureId = imported.lab?.textureId;
    const targetTextureId =
      importedTextureId && findTextureEntry(importedTextureId, loadManifest())
        ? importedTextureId
        : textureIdRef.current;
    const config = sanitizeThemedConfig(imported.config);
    const selectedAreaId = surfaceWorkspaceRef.current.selectedAreaId;
    if (surfaceWorkspaceRef.current.mode === "partial" && selectedAreaId) {
      onUpdateSurfaceAreaConfig(selectedAreaId, config);
    } else {
      stagePendingConfig(config);
    }
    markImportedConfigPristine();
    if (imported.lab) {
      saveLabSettings(imported.lab);
      saveControlDrawerSnapshot(imported.lab.drawerOpen);
      if (targetTextureId !== textureIdRef.current || importedTextureId) saveTextureId(targetTextureId);
    }
  }

  function handleExport() {
    void navigator.clipboard.writeText(serializeConfigFile(getActiveThemedConfig(), fullLabSettingsSnapshot()));
  }

  function handleDownloadConfig() {
    downloadTextFile(
      serializeConfigFile(getActiveThemedConfig(), fullLabSettingsSnapshot()),
      settingsFilename(textureIdRef.current),
    );
  }

  function handleExportProductionConfig() {
    downloadTextFile(
      serializeProductionConfig(getActiveThemedConfig()),
      productionConfigFilename(textureIdRef.current),
    );
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
      const imported = importSettingsFile(text);
      applyImportedSettings(text);
      if (clientMode) {
        const layoutName = file.name.replace(/\.json$/i, "").trim() || "Uploaded layout";
        const registered = addPreset(
          presets,
          createPreset(layoutName, sanitizeThemedConfig(imported.config), imported.lab ?? undefined),
        );
        savePresets(registered);
        setPresets(registered);
        saveActiveClientLayoutName(layoutName);
        try {
          sessionStorage.setItem("stripes-engine-lab-boot-preset", layoutName);
        } catch {
          /* ignore */
        }
      }
      window.location.reload();
    } catch {
      window.alert("Invalid config JSON.");
    }
  }

  function handleResetSettings() {
    const selectedAreaId = surfaceWorkspaceRef.current.selectedAreaId;
    if (surfaceWorkspaceRef.current.mode === "partial" && selectedAreaId) {
      const selectedArea = surfaceWorkspaceRef.current.areas.find((area) => area.id === selectedAreaId);
      if (!window.confirm(`Reset config for "${selectedArea?.name ?? "selected area"}"?`)) return;
      onResetSurfaceArea(selectedAreaId);
      return;
    }
    if (!window.confirm("Reset settings for this texture?")) return;
    deleteConfig(textureIdRef.current);
    stagePendingConfig(DEFAULT_LAB_ENGINE_CONFIG);
    saveLabSettings({ ...DEFAULT_LAB_SETTINGS, backgroundColor: labSettingsRef.current.backgroundColor });
    saveTextureId(textureIdRef.current);
    window.location.reload();
  }

  function handleSelectTheme(next: LabEditTheme) {
    if (next === editTheme) return;
    const themed = getActiveThemedConfig();
    const selectedAreaId = surfaceWorkspaceRef.current.selectedAreaId;
    if (surfaceWorkspaceRef.current.mode === "partial" && selectedAreaId) {
      onUpdateSurfaceAreaConfig(selectedAreaId, themed);
    } else {
      saveConfig(textureIdRef.current, themed);
      stagePendingConfig(themed);
    }
    saveEditTheme(next);
    window.location.reload();
  }

  function handleResetTheme(target: LabEditTheme) {
    const selectedAreaId = surfaceWorkspaceRef.current.selectedAreaId;
    if (surfaceWorkspaceRef.current.mode === "partial" && selectedAreaId) {
      const themed = getActiveThemedConfig();
      const next =
        target === "dark"
          ? normalizeEngineConfig(resolveThemedConfig(themed, "light"))
          : normalizeEngineConfig(resolveThemedConfig(themed, "dark"));
      onUpdateSurfaceAreaConfig(selectedAreaId, next);
      if (editTheme === target) window.location.reload();
      return;
    }
    const id = textureIdRef.current;
    if (target === "dark") {
      darkDiffRef.current = {};
      const light = editTheme === "light" ? { ...controlsRef.current } : normalizeEngineConfig(lightBaseRef.current);
      lightBaseRef.current = light;
      saveConfig(id, light);
      lastSavedConfigJsonRef.current = `${id}:${JSON.stringify(light)}`;
      if (editTheme === "dark") {
        stagePendingConfig(light);
        window.location.reload();
      }
      return;
    }
    const merged = normalizeEngineConfig(resolveThemedConfig(composeThemedConfig(), "dark"));
    lightBaseRef.current = merged;
    darkDiffRef.current = {};
    saveConfig(id, merged);
    lastSavedConfigJsonRef.current = `${id}:${JSON.stringify(merged)}`;
    if (editTheme === "light") {
      stagePendingConfig(merged);
      window.location.reload();
    }
  }

  async function handleFactoryResetSettings() {
    if (
      !window.confirm(
        "Factory reset all settings to defaults? This will clear saved configs, UI settings, and uploaded textures.",
      )
    )
      return;
    factoryResetSettings();
    saveSurfaceWorkspace(EMPTY_SURFACE_WORKSPACE);
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
    const name = window.prompt(clientMode ? "Layout name:" : "Preset name:")?.trim();
    if (!name) return;
    if (presets.some((p) => p.name === name) && !window.confirm(`Overwrite "${name}"?`)) return;
    const { config, lab } = captureSavedLayoutPayload();
    const next = addPreset(presets, createPreset(name, config, lab));
    savePresets(next);
    setPresets(next);
    setSelectedPreset(name);
    if (clientMode) saveActiveClientLayoutName(name);
  }

  function handleApplyPreset() {
    const preset = presets.find((p) => p.name === selectedPreset);
    if (!preset) return;
    const targetTextureId = textureIdRef.current;
    if (clientMode) {
      applyClientLayout(preset, targetTextureId);
    } else {
      applyPresetToStorage(preset, targetTextureId);
    }
    saveTextureId(targetTextureId);
    window.location.reload();
  }

  function handleDeletePreset() {
    if (!selectedPreset) return;
    const current = presets.find((p) => p.name === selectedPreset);
    if (current?.builtin) return;
    const next = removePreset(presets, selectedPreset);
    savePresets(next);
    setPresets(next);
    if (clientMode && loadActiveClientLayoutName() === selectedPreset) {
      saveActiveClientLayoutName(null);
    }
    setSelectedPreset("");
  }

  function handleClientResetToBanner() {
    if (!window.confirm("Reset to Banner 5:1 defaults? This replaces your current knobs. Saved layouts are kept.")) {
      return;
    }
    const banner = loadBannerLayout();
    if (!banner) {
      window.alert("Banner 5:1 builtin is missing.");
      return;
    }
    applyClientLayout(banner, textureIdRef.current);
    setSelectedPreset(banner.name);
    window.location.reload();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    saveLabSettings({ ...labSettingsRef.current, textureSourceMode: "texture", shaderSourceCode, canvasScale: 1 });
    const kind: LabTextureKind = file.type.startsWith("video/") ? "video" : "image";
    const id = `upload-${crypto.randomUUID()}`;
    try {
      await putTextureBlob(id, file, file.type);
    } catch {
      window.alert("Couldn't save this upload (storage full). It will show for this session but won't persist.");
      loadFileSource(file)
        .then((loaded) => {
          if (engineRef.current) {
            setControlRef.current({ whitePoint: 1 });
            applyLoadedSource(loaded, false);
          } else if (loaded.objectUrl) {
            URL.revokeObjectURL(loaded.objectUrl);
          }
        })
        .catch(() => {});
      return;
    }
    saveManifest(addUpload(loadManifest(), { id, label: file.name, kind, defaultScale: 1, createdAt: Date.now() }));
    const current = composeThemedConfigRef.current();
    const normalizedLight = normalizeEngineConfig(resolveThemedConfig(current, "light"));
    stagePendingConfig({
      ...current,
      adjustments: { ...normalizedLight.adjustments, whitePoint: 1 },
      ...(current.dark
        ? {
            dark: {
              ...current.dark,
              adjustments: { ...current.dark.adjustments, whitePoint: 1 },
            },
          }
        : {}),
    });
    saveTextureId(id);
    window.location.reload();
  }

  async function handleDarkTextureFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const manifest = loadManifest();
    const entry = findTextureEntry(textureIdRef.current, manifest);
    if (!entry || entry.origin !== "upload") return;
    const kind: LabTextureKind = file.type.startsWith("video/") ? "video" : "image";
    const id = entry.dark?.id ?? `${entry.id}-dark`;
    try {
      await putTextureBlob(id, file, file.type);
    } catch {
      window.alert("Couldn't save the dark mode texture (storage full).");
      return;
    }
    saveManifest(
      setDarkUpload(manifest, entry.id, {
        id,
        label: file.name,
        kind,
      }),
    );
    stagePendingConfig(composeThemedConfigRef.current());
    saveTextureId(entry.id);
    window.location.reload();
  }

  function handleTextureSourceModeChange(next: LabTextureSourceMode) {
    textureSourceModeRef.current = next;
    if (next === "texture") {
      const twizzlerCanvas = twizzlerCanvasRef.current;
      if (twizzlerCanvas) clearTwizzler(twizzlerCanvas);
      twizzlerMapRendererRef.current = null;
    }
    setTextureSourceMode(next);
    saveLabSettings({
      ...labSettingsRef.current,
      textureSourceMode: next,
      shaderSourceCode,
      ...(next === "texture" ? { canvasScale: 1 } : {}),
    });
  }

  function handleApplyShaderSource() {
    setTextureSourceMode("shader");
    setShaderPresetId(CUSTOM_SHADER_PRESET_ID);
    saveLabSettings({
      ...labSettingsRef.current,
      textureSourceMode: "shader",
      shaderSourceCode,
      shaderPresetId: CUSTOM_SHADER_PRESET_ID,
    });
    applyShaderTextureSource(shaderSourceCode);
  }

  function handleResetShaderSource() {
    setShaderSourceCode(DEFAULT_SHADER_TEXTURE_SOURCE);
    setShaderSourceError(null);
    setShaderPresetId(NEBULA_SHADER_PRESET_ID);
    saveLabSettings({
      ...labSettingsRef.current,
      textureSourceMode,
      shaderSourceCode: DEFAULT_SHADER_TEXTURE_SOURCE,
      shaderPresetId: NEBULA_SHADER_PRESET_ID,
    });
    if (textureSourceMode === "shader") applyShaderTextureSource(DEFAULT_SHADER_TEXTURE_SOURCE);
  }

  function handleShaderPresetChange(presetId: string) {
    if (presetId === CUSTOM_SHADER_PRESET_ID) return;
    const entry = findShaderLibraryEntry(presetId);
    if (!entry) return;
    setShaderPresetId(presetId);
    setShaderSourceError(null);
    setTextureSourceMode("shader");

    if (isSpiralShaderPreset(presetId)) {
      saveLabSettings({
        ...labSettingsRef.current,
        textureSourceMode: "shader",
        shaderPresetId: presetId,
      });
      applyConnectTextureSource(labSettingsRef.current.connectShapeType);
      return;
    }

    if (isCometLogoShaderPreset(presetId)) {
      saveLabSettings({
        ...labSettingsRef.current,
        textureSourceMode: "shader",
        shaderPresetId: presetId,
      });
      applyCometLogoTextureSource();
      return;
    }

    setShaderSourceCode(entry.source);
    saveLabSettings({
      ...labSettingsRef.current,
      textureSourceMode: "shader",
      shaderPresetId: presetId,
      shaderSourceCode: entry.source,
    });
    if (isTwizzlerMapShaderPreset(presetId)) {
      applyTwizzlerMapTextureSource();
      return;
    }
    applyShaderTextureSource(entry.source);
  }

  useEffect(() => {
    if (!clientMode) return;
    const mode = clientGraphicMode ?? resolveClientGraphicMode(twizzler.enabled, controls.sparkle.gaps.enabled);
    const rainOn = mode === "rain" || mode === "both";
    // Rain authoring lives on both sidebars (Camera / Tone on texture; Stripes/Grid/Connect on shader).
    // Graphic toggles only layer visibility — never rewrite storage or reload the page.
    if (labSettingsRef.current.textureSidebarOpen !== rainOn) {
      updateLabSettings({ textureSidebarOpen: rainOn });
    }
  }, [clientMode, clientGraphicMode, twizzler.enabled, controls.sparkle.gaps.enabled, updateLabSettings]);

  useEffect(() => {
    if (!clientMode) return;
    const mode = clientGraphicMode ?? resolveClientGraphicMode(twizzler.enabled, controls.sparkle.gaps.enabled);
    if (mode !== "rain" && mode !== "both") return;
    const target = clientRainShaderPreset || CONNECT_SHADER_PRESET_ID;
    if (shaderPresetId === target) return;
    handleShaderPresetChange(target);
  }, [
    clientMode,
    clientGraphicMode,
    clientRainShaderPreset,
    shaderPresetId,
    twizzler.enabled,
    controls.sparkle.gaps.enabled,
  ]);

  function handleConnectShapeChange(shapeType: ConnectShapeType) {
    updateLabSettings({ connectShapeType: shapeType });
  }

  function handleSurfaceModeChange(next: SurfaceMode) {
    if (next === surfaceWorkspace.mode) return;
    setDrawingSurfaceAreaKind(null);
    onSurfaceModeChange(next, composeThemedConfig());
  }

  function handleSelectSurfaceArea(id: string | null) {
    onSelectSurfaceArea(id);
  }

  function handleCompleteSurfaceArea(kind: SurfaceAreaKind, points: SurfacePoint[]) {
    setDrawingSurfaceAreaKind(null);
    onAddSurfaceArea(kind, points, getActiveThemedConfig());
  }

  function handleDeleteSurfaceArea(id: string) {
    const area = surfaceWorkspace.areas.find((item) => item.id === id);
    if (!area || !window.confirm(`Delete "${area.name}"?`)) return;
    onDeleteSurfaceArea(id);
  }

  if (!shell) {
    return <canvas ref={canvasRef} style={{ display: "block" }} />;
  }

  const spiralSelected = isSpiralShaderPreset(shaderPresetId);
  const cometLogoSelected = isCometLogoShaderPreset(shaderPresetId);
  const twizzlerMapSelected = isTwizzlerMapShaderPreset(shaderPresetId);
  const selectedArea = surfaceWorkspace.areas.find((area) => area.id === surfaceWorkspace.selectedAreaId) ?? null;

  const sourcePreviewOpacity = surfaceWorkspace.mode === "partial" ? 1 : backgroundSourceOpacity;
  const showSourceBackground = sourcePreviewOpacity > 0.001 && sourcePreview !== null;
  const showConnectGradientUnderlay =
    textureSourceMode === "shader" && isSpiralShaderPreset(shaderPresetId) && labSettings.connectGradientUnderlay;
  const showTwizzlerOverlay = shouldShowTwizzlerOverlay(textureSourceMode, twizzler.enabled);
  // Client Rain = stripe rect overlay on top of Twizzler. Output canvas sits above Twizzler
  // (z-index), so hide it when Rain is off or it covers the ribbon with an opaque pass.
  const showRainRectOverlay = !clientMode || controls.sparkle.gaps.enabled;
  // Engine bg is forced transparent when underlay/source preview is shown — keep the
  // chosen solid color on the stack so it still sits behind those layers.
  // Twizzler hairlines need an opaque stack underlay (usually white) to read at all.
  const canvasStackBackground = canvasStackBackgroundCss(
    showTwizzlerOverlay ? { transparent: false, color: controls.background.color } : controls.background,
  );
  const resolvedSourceSize =
    sourceSize.w > 0 && sourceSize.h > 0 ? sourceSize : expectedSourceSize(labSettings, textureSourceMode);
  const canvasCssSize = computeLabCanvasSize(resolvedSourceSize.w, resolvedSourceSize.h, labSettings);
  const sourceObjectFit = controls.transform.fit === "contain" ? "contain" : "cover";
  const sourceBackgroundStyle: CSSProperties =
    controls.transform.fit === "width"
      ? {
          left: 0,
          top: "50%",
          width: "100%",
          height: "auto",
          transform: "translateY(-50%)",
          opacity: sourcePreviewOpacity,
        }
      : controls.transform.fit === "height"
        ? {
            left: "50%",
            top: 0,
            width: "auto",
            height: "100%",
            transform: "translateX(-50%)",
            opacity: sourcePreviewOpacity,
          }
        : { objectFit: sourceObjectFit, opacity: sourcePreviewOpacity };

  return (
    <div className={`lab-shell${sidebarResizing ? " is-resizing" : ""}${clientMode ? " is-client-mode" : ""}`}>
      {!clientMode ? (
        <aside
          className={`lab-sidebar lab-sidebar-texture${labSettings.textureSidebarOpen ? "" : " is-closed"}`}
          style={{ width: labSettings.textureSidebarOpen ? labSettings.textureSidebarWidth : 0 }}
          aria-hidden={!labSettings.textureSidebarOpen}
        >
          <div
            className="lab-sidebar-scroll playground-leva-panel texture-config-panel ui-scroll-hidden"
            style={{ width: labSettings.textureSidebarWidth }}
          >
            <div className="lab-sidebar-header">
              <img
                className="lab-sidebar-logo"
                src={editTheme === "dark" ? "/connect-logo-dark.svg" : "/connect-logo.svg"}
                alt="Connect"
              />
              <button
                className="lab-sidebar-toggle"
                type="button"
                onClick={() => updateLabSettings({ textureSidebarOpen: false })}
                aria-label="Close texture panel"
                title="Close texture panel"
              >
                <PanelLeftClose size={14} strokeWidth={1.75} />
              </button>
            </div>
            <div className="playground-workflow-controls">
              <div className="wf-field">
                <span className="wf-field-label">Source</span>
                <select
                  className="lab-btn"
                  value={textureSourceMode}
                  onChange={(e) => handleTextureSourceModeChange(e.target.value === "shader" ? "shader" : "texture")}
                >
                  <option value="texture">Texture</option>
                  <option value="shader">Shader</option>
                </select>
              </div>
              {textureSourceMode === "texture" ? (
                <>
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
                      <input
                        type="file"
                        accept="image/*,video/*"
                        style={{ display: "none" }}
                        onChange={handleFileChange}
                      />
                    </label>
                    <button className="lab-btn" onClick={handleDeleteTexture} disabled={!canDeleteTexture}>
                      Delete texture
                    </button>
                  </div>
                  {canDeleteTexture ? (
                    <div className="wf-field">
                      <span className="wf-field-label">Dark mode texture</span>
                      <label className="lab-btn wf-upload">
                        {selectedEntry?.dark ? "Replace dark mode texture" : "Add dark mode texture"}
                        <input
                          type="file"
                          accept="image/*,video/*"
                          style={{ display: "none" }}
                          onChange={handleDarkTextureFileChange}
                        />
                      </label>
                      {selectedEntry?.dark ? <span className="wf-field-label">{selectedEntry.dark.label}</span> : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="wf-field wf-shader-source">
                  <span className="wf-field-label">Shader</span>
                  <select
                    className="lab-btn"
                    value={shaderPresetId}
                    onChange={(event) => handleShaderPresetChange(event.target.value)}
                  >
                    {SHADER_LIBRARY.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.id === DEFAULT_SHADER_PRESET_ID ? `${entry.label} (default)` : entry.label}
                      </option>
                    ))}
                    {shaderPresetId === CUSTOM_SHADER_PRESET_ID ? (
                      <option value={CUSTOM_SHADER_PRESET_ID}>Custom</option>
                    ) : null}
                  </select>
                  <details className="wf-collapsible">
                    <summary>Shader source</summary>
                    <div className="wf-collapsible-content">
                      {spiralSelected ? (
                        <div className="wf-field">
                          <span className="wf-field-label">Shape</span>
                          <select
                            className="lab-btn"
                            value={labSettings.connectShapeType}
                            onChange={(event) => handleConnectShapeChange(event.target.value as ConnectShapeType)}
                          >
                            {CONNECT_SHAPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <>
                          <div className="wf-field">
                            <span className="wf-field-label">Shader resolution</span>
                            <div className="playground-canvas-dimension-controls">
                              <input
                                type="number"
                                min={1}
                                max={8192}
                                step={1}
                                value={labSettings.shaderSourceWidth}
                                onChange={(event) => {
                                  const width = Math.max(
                                    1,
                                    Math.min(8192, Math.round(Number(event.currentTarget.value))),
                                  );
                                  if (!Number.isFinite(width)) return;
                                  updateLabSettings({ shaderSourceWidth: width });
                                }}
                                aria-label="Shader source width"
                              />
                              <span className="wf-resolution-separator">×</span>
                              <input
                                type="number"
                                min={1}
                                max={8192}
                                step={1}
                                value={labSettings.shaderSourceHeight}
                                onChange={(event) => {
                                  const height = Math.max(
                                    1,
                                    Math.min(8192, Math.round(Number(event.currentTarget.value))),
                                  );
                                  if (!Number.isFinite(height)) return;
                                  updateLabSettings({ shaderSourceHeight: height });
                                }}
                                aria-label="Shader source height"
                              />
                            </div>
                          </div>
                          {cometLogoSelected ? (
                            <div className="wf-field">
                              <span className="wf-field-label">Hover the canvas to form the Cloudflare logo.</span>
                            </div>
                          ) : !twizzlerMapSelected ? (
                            <div className="wf-field">
                              <span className="wf-field-label">Shader source</span>
                              <textarea
                                className="lab-shader-source-input"
                                spellCheck={false}
                                value={shaderSourceCode}
                                onChange={(event) => {
                                  const next = event.currentTarget.value;
                                  setShaderSourceCode(next);
                                  setShaderPresetId(CUSTOM_SHADER_PRESET_ID);
                                  saveLabSettings({
                                    ...labSettingsRef.current,
                                    textureSourceMode: "shader",
                                    shaderSourceCode: next,
                                    shaderPresetId: CUSTOM_SHADER_PRESET_ID,
                                  });
                                }}
                              />
                            </div>
                          ) : null}
                        </>
                      )}
                      <div className="wf-field">
                        <span className="wf-field-label">Time</span>
                        <TimeTransport controller={shaderTransport} />
                      </div>
                      {!spiralSelected && !cometLogoSelected && !twizzlerMapSelected ? (
                        <div className="wf-row">
                          <button className="lab-btn" onClick={handleApplyShaderSource}>
                            Apply shader
                          </button>
                          <button className="lab-btn" onClick={handleResetShaderSource}>
                            Reset shader
                          </button>
                        </div>
                      ) : null}
                      {shaderSourceError ? <div className="lab-shader-source-error">{shaderSourceError}</div> : null}
                    </div>
                  </details>
                </div>
              )}
              <hr className="wf-divider" />
              <details className="wf-collapsible" open>
                <summary>Presets</summary>
                <div className="wf-collapsible-content">
                  <select
                    className="lab-btn"
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                  >
                    <option value="">No preset selected</option>
                    {presets.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.builtin ? `${p.name} (builtin)` : p.name}
                      </option>
                    ))}
                  </select>
                  <div className="wf-row">
                    <button className="lab-btn" onClick={handleApplyPreset} disabled={!selectedPreset}>
                      Apply
                    </button>
                    <button className="lab-btn" onClick={handleSavePreset}>
                      Save
                    </button>
                    <button
                      className="lab-btn"
                      onClick={handleDeletePreset}
                      disabled={!selectedPreset || presets.some((p) => p.name === selectedPreset && p.builtin)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </details>
              <hr className="wf-divider" />
              <details className="wf-collapsible wf-config">
                <summary>Config</summary>
                <div className="wf-collapsible-content">
                  <button className="lab-btn" onClick={handleExportProductionConfig}>
                    {surfaceWorkspace.mode === "partial" ? "Export selected config" : "Export production config"}
                  </button>
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
                    {surfaceWorkspace.mode === "partial" ? "Reset layer config" : "Reset settings"}
                  </button>
                  <button className="lab-btn wf-reset" onClick={handleFactoryResetSettings}>
                    Factory reset
                  </button>
                </div>
              </details>
              <hr className="wf-divider" />
              <div className="wf-field">
                <span className="wf-field-label">Export</span>
                <LabExportControls videoEl={videoEl} settings={labSettings} onSettings={updateLabSettings} />
                <div className="wf-row">
                  <button
                    className={`lab-btn${videoExportBusy ? " is-exporting" : ""}`}
                    onClick={onExportVideo}
                    disabled={videoExportBusy}
                    aria-busy={videoExportBusy}
                  >
                    {videoExportLabel}
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
            {surfaceWorkspace.mode === "full" ? (
              <LevaPanel store={textureStore} theme={LAB_LEVA_THEME} fill flat titleBar={false} />
            ) : null}
          </div>
          <hr
            className="lab-sidebar-resize-handle"
            onPointerDown={(event) => startSidebarResize("texture", event)}
            aria-orientation="vertical"
            aria-label="Resize texture panel"
          />
        </aside>
      ) : null}
      <div className="lab-main">
        {!clientMode && !labSettings.textureSidebarOpen ? (
          <button
            className="lab-sidebar-reopen lab-sidebar-reopen-left"
            type="button"
            onClick={() => updateLabSettings({ textureSidebarOpen: true })}
            aria-label="Open texture panel"
            title="Open texture panel"
          >
            <PanelLeft size={14} strokeWidth={1.75} />
          </button>
        ) : null}
        {!labSettings.shaderSidebarOpen ? (
          <button
            className="lab-sidebar-reopen lab-sidebar-reopen-right"
            type="button"
            onClick={() => updateLabSettings({ shaderSidebarOpen: true })}
            aria-label="Open shader panel"
            title="Open shader panel"
          >
            <PanelRight size={14} strokeWidth={1.75} />
          </button>
        ) : null}
        <div className="lab-canvas-viewport">
          <div className="lab-canvas-area" ref={canvasAreaRef} onWheel={handlePreviewWheel}>
            <div className="lab-canvas-stage">
              <div
                className={`lab-canvas-stack${previewZoomReady ? " is-preview-zoom-ready" : ""}`}
                style={{
                  transform: `scale(${previewZoom})`,
                  transformOrigin: "center center",
                  backgroundColor: canvasStackBackground,
                  width: canvasCssSize.cssW,
                  height: canvasCssSize.cssH,
                }}
              >
                <div
                  ref={connectUnderlayHostRef}
                  className="lab-canvas-connect-underlay-host"
                  hidden={!showConnectGradientUnderlay}
                  aria-hidden={!showConnectGradientUnderlay}
                />
                {showSourceBackground && sourcePreview.video ? (
                  <video
                    className="lab-canvas-source-background"
                    src={sourcePreview.video.currentSrc || sourcePreview.video.src}
                    muted
                    loop
                    autoPlay
                    playsInline
                    style={sourceBackgroundStyle}
                  />
                ) : showSourceBackground && sourcePreview.source instanceof HTMLImageElement ? (
                  <img
                    className="lab-canvas-source-background"
                    src={sourcePreview.source.currentSrc || sourcePreview.source.src}
                    alt=""
                    aria-hidden="true"
                    style={sourceBackgroundStyle}
                  />
                ) : showSourceBackground && sourcePreview.source instanceof HTMLCanvasElement ? (
                  <canvas
                    ref={shaderPreviewCanvasRef}
                    className="lab-canvas-source-background"
                    aria-hidden="true"
                    style={sourceBackgroundStyle}
                  />
                ) : null}
                <canvas
                  ref={twizzlerCanvasRef}
                  className="lab-canvas-twizzler"
                  aria-hidden="true"
                  hidden={!showTwizzlerOverlay}
                  style={{
                    width: canvasCssSize.cssW,
                    height: canvasCssSize.cssH,
                    opacity: surfaceWorkspace.mode === "partial" ? 0 : 1,
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className="lab-canvas-output"
                  style={{
                    display: "block",
                    opacity: surfaceWorkspace.mode === "partial" || !showRainRectOverlay ? 0 : 1,
                    pointerEvents: surfaceWorkspace.mode === "partial" || !showRainRectOverlay ? "none" : "auto",
                    width: canvasCssSize.cssW,
                    height: canvasCssSize.cssH,
                  }}
                />
                <canvas
                  ref={partialCompositeCanvasRef}
                  className="lab-canvas-partial-composite"
                  aria-hidden="true"
                  hidden={surfaceWorkspace.mode !== "partial"}
                  style={{
                    opacity: 1,
                    width: canvasCssSize.cssW,
                    height: canvasCssSize.cssH,
                  }}
                />
                <canvas
                  ref={framesCanvasRef}
                  className="lab-canvas-frames"
                  aria-hidden="true"
                  style={{
                    opacity: surfaceWorkspace.mode === "partial" || !showRainRectOverlay ? 0 : 1,
                    width: canvasCssSize.cssW,
                    height: canvasCssSize.cssH,
                  }}
                />
                {surfaceWorkspace.mode === "partial" ? (
                  <SurfaceCanvasOverlay
                    drawingKind={drawingSurfaceAreaKind}
                    areas={surfaceWorkspace.areas}
                    selectedArea={selectedArea}
                    onComplete={handleCompleteSurfaceArea}
                    onSelectArea={handleSelectSurfaceArea}
                    onPreviewPoints={onPreviewSurfaceAreaPoints}
                    onChangePoints={onUpdateSurfaceAreaPoints}
                    onCancel={() => setDrawingSurfaceAreaKind(null)}
                  />
                ) : null}
              </div>
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
            <span className="lab-canvas-zoom-value">{Math.round(previewZoom * 100)}%</span>
          </div>
        </div>
        {!clientMode ? (
          <LabBottomBar
            videoEl={videoEl}
            editTheme={editTheme}
            onSelectTheme={handleSelectTheme}
            onResetTheme={handleResetTheme}
          />
        ) : null}
      </div>
      <aside
        className={`lab-sidebar lab-sidebar-shader${labSettings.shaderSidebarOpen ? "" : " is-closed"}`}
        style={{ width: labSettings.shaderSidebarOpen ? labSettings.shaderSidebarWidth : 0 }}
        aria-hidden={!labSettings.shaderSidebarOpen}
      >
        {!clientMode ? (
          <hr
            className="lab-sidebar-resize-handle"
            onPointerDown={(event) => startSidebarResize("shader", event)}
            aria-orientation="vertical"
            aria-label="Resize shader panel"
          />
        ) : null}
        <div
          className={`lab-sidebar-scroll playground-leva-panel shader-config-panel ui-scroll-hidden${
            !clientMode && surfaceWorkspace.mode === "partial" ? " is-surface-panel" : ""
          }`}
          style={{ width: labSettings.shaderSidebarWidth }}
        >
          {!clientMode ? (
            <div className="lab-sidebar-header lab-sidebar-header-end">
              <span />
              <button
                className="lab-sidebar-toggle"
                type="button"
                onClick={() => updateLabSettings({ shaderSidebarOpen: false })}
                aria-label="Close shader panel"
                title="Close shader panel"
              >
                <PanelRightClose size={14} strokeWidth={1.75} />
              </button>
            </div>
          ) : null}
          {clientMode ? (
            <>
              <div className="lab-client-tools">
                <div className="lab-client-tools-top">
                  <fieldset className="lab-panel-mode-toggle" aria-label="Panel mode">
                    <legend>Panel mode</legend>
                    <label className={`lab-panel-mode-btn${clientPanelMode === "default" ? " is-selected" : ""}`}>
                      <input
                        type="radio"
                        name="lab-panel-mode"
                        value="default"
                        checked={clientPanelMode === "default"}
                        onChange={() => setClientPanelMode("default")}
                      />
                      Default
                    </label>
                    <label className={`lab-panel-mode-btn${clientPanelMode === "advanced" ? " is-selected" : ""}`}>
                      <input
                        type="radio"
                        name="lab-panel-mode"
                        value="advanced"
                        checked={clientPanelMode === "advanced"}
                        onChange={() => setClientPanelMode("advanced")}
                      />
                      Advanced
                    </label>
                  </fieldset>
                  <button
                    className="lab-sidebar-toggle lab-client-panel-collapse"
                    type="button"
                    onClick={() => updateLabSettings({ shaderSidebarOpen: false })}
                    aria-label="Close panel"
                    title="Close panel"
                  >
                    <PanelRightClose size={14} strokeWidth={1.75} />
                  </button>
                </div>
                <div className="lab-client-layouts">
                  <div className="lab-client-layouts-label">Saved layouts</div>
                  <select
                    className="lab-client-layouts-select"
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    aria-label="Saved layout"
                  >
                    <option value="">Select a layout…</option>
                    {listSavedLayouts(presets).map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                    {presets
                      .filter((p) => p.builtin)
                      .map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} (builtin)
                        </option>
                      ))}
                  </select>
                  <div className="lab-client-layouts-actions">
                    <button type="button" onClick={handleSavePreset}>
                      Save
                    </button>
                    <button type="button" onClick={handleApplyPreset} disabled={!selectedPreset}>
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={handleDeletePreset}
                      disabled={!selectedPreset || presets.some((p) => p.name === selectedPreset && p.builtin)}
                    >
                      Delete
                    </button>
                    <button type="button" className="is-reset" onClick={handleClientResetToBanner}>
                      Reset
                    </button>
                  </div>
                </div>
                <div className="lab-client-json">
                  <div className="lab-client-layouts-label">JSON</div>
                  <div className="lab-client-layouts-actions">
                    <button type="button" onClick={handleExport}>
                      Copy JSON
                    </button>
                    <button type="button" onClick={() => configFileInputRef.current?.click()}>
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
                </div>
              </div>
              <div className="lab-client-leva">
                <LevaPanel store={shaderStore} theme={LAB_LEVA_THEME} fill flat titleBar={false} />
              </div>
              <div className="lab-client-exports">
                <LabExportControls videoEl={videoEl} settings={labSettings} onSettings={updateLabSettings} />
                <div className="lab-client-layouts-actions">
                  <button
                    type="button"
                    className={videoExportBusy ? "is-exporting" : undefined}
                    onClick={onExportVideo}
                    disabled={videoExportBusy}
                    aria-busy={videoExportBusy}
                  >
                    {videoExportLabel}
                  </button>
                  <button type="button" onClick={onExportSvg}>
                    Export SVG
                  </button>
                </div>
              </div>
            </>
          ) : (
            <SurfacePanel
              mode={surfaceWorkspace.mode}
              areas={surfaceWorkspace.areas}
              selectedAreaId={surfaceWorkspace.selectedAreaId}
              drawingKind={drawingSurfaceAreaKind}
              onModeChange={handleSurfaceModeChange}
              onNewArea={setDrawingSurfaceAreaKind}
              onSelectArea={handleSelectSurfaceArea}
              onToggleArea={onToggleSurfaceArea}
              onDeleteArea={handleDeleteSurfaceArea}
            >
              {surfaceWorkspace.mode === "partial" ? (
                selectedArea ? (
                  <SurfaceAreaConfigEditor
                    key={`${selectedArea.id}:${surfaceEditorRevision}`}
                    area={selectedArea}
                    onChange={onUpdateSurfaceAreaConfig}
                  />
                ) : null
              ) : (
                <LevaPanel store={shaderStore} theme={LAB_LEVA_THEME} fill flat titleBar={false} />
              )}
            </SurfacePanel>
          )}
        </div>
      </aside>
      {!clientMode ? <PerfOverlay snap={snap} /> : null}
    </div>
  );
}

export function LabApp({ clientMode = false }: { clientMode?: boolean } = {}) {
  const [surfaceWorkspace, setSurfaceWorkspace] = useState(() => loadSurfaceWorkspace());
  const [editorRevision, setEditorRevision] = useState(0);
  const initialConfig = surfaceWorkspace.fullConfig ?? undefined;

  const updateSurfaceWorkspace = useCallback((updater: (current: SurfaceWorkspace) => SurfaceWorkspace) => {
    setSurfaceWorkspace((current) => {
      const next = updater(current);
      saveSurfaceWorkspace(next);
      return next;
    });
  }, []);

  const handleSurfaceModeChange = useCallback(
    (mode: SurfaceMode, currentConfig: ThemedEngineConfig) => {
      updateSurfaceWorkspace((current) => {
        return {
          ...current,
          mode,
          fullConfig: current.mode === "full" ? sanitizeThemedConfig(currentConfig) : current.fullConfig,
          selectedAreaId: current.selectedAreaId ?? current.areas[0]?.id ?? null,
        };
      });
    },
    [updateSurfaceWorkspace],
  );

  const handleAddSurfaceArea = useCallback(
    (kind: SurfaceAreaKind, points: SurfacePoint[], config: ThemedEngineConfig) => {
      updateSurfaceWorkspace((current) => {
        const area = createSurfaceArea(kind, points, config, current.areas);
        if (!area) return current;
        return {
          ...current,
          mode: "partial",
          areas: [area, ...current.areas],
          selectedAreaId: area.id,
        };
      });
    },
    [updateSurfaceWorkspace],
  );

  const handleSelectSurfaceArea = useCallback(
    (id: string | null) => {
      updateSurfaceWorkspace((current) =>
        id === null || current.areas.some((area) => area.id === id) ? { ...current, selectedAreaId: id } : current,
      );
    },
    [updateSurfaceWorkspace],
  );

  const handleUpdateSurfaceAreaPoints = useCallback(
    (id: string, points: SurfacePoint[]) => {
      updateSurfaceWorkspace((current) => {
        const area = current.areas.find((item) => item.id === id);
        if (!area) return current;
        const nextPoints = normalizeSurfaceAreaPoints(area.kind, points);
        if (!nextPoints || JSON.stringify(area.points) === JSON.stringify(nextPoints)) return current;
        return {
          ...current,
          areas: current.areas.map((item) => (item.id === id ? { ...item, points: nextPoints } : item)),
        };
      });
    },
    [updateSurfaceWorkspace],
  );

  const handlePreviewSurfaceAreaPoints = useCallback((id: string, points: SurfacePoint[]) => {
    setSurfaceWorkspace((current) => {
      const area = current.areas.find((item) => item.id === id);
      if (!area) return current;
      const nextPoints = normalizeSurfaceAreaPoints(area.kind, points);
      if (!nextPoints || JSON.stringify(area.points) === JSON.stringify(nextPoints)) return current;
      return {
        ...current,
        areas: current.areas.map((item) => (item.id === id ? { ...item, points: nextPoints } : item)),
      };
    });
  }, []);

  const handleUpdateSurfaceAreaConfig = useCallback(
    (id: string, config: ThemedEngineConfig) => {
      updateSurfaceWorkspace((current) => {
        const nextConfig = sanitizeThemedConfig(config);
        const index = current.areas.findIndex((area) => area.id === id);
        if (index < 0 || JSON.stringify(current.areas[index]!.config) === JSON.stringify(nextConfig)) return current;
        return {
          ...current,
          areas: current.areas.map((area) => (area.id === id ? { ...area, config: nextConfig } : area)),
        };
      });
    },
    [updateSurfaceWorkspace],
  );

  const handleToggleSurfaceArea = useCallback(
    (id: string) => {
      updateSurfaceWorkspace((current) => ({
        ...current,
        areas: current.areas.map((area) => (area.id === id ? { ...area, visible: !area.visible } : area)),
      }));
    },
    [updateSurfaceWorkspace],
  );

  const handleDeleteSurfaceArea = useCallback(
    (id: string) => {
      updateSurfaceWorkspace((current) => {
        const index = current.areas.findIndex((area) => area.id === id);
        if (index < 0) return current;
        const areas = current.areas.filter((area) => area.id !== id);
        const selectedAreaId =
          current.selectedAreaId === id
            ? (areas[Math.min(index, areas.length - 1)]?.id ?? null)
            : current.selectedAreaId;
        return { ...current, areas, selectedAreaId };
      });
    },
    [updateSurfaceWorkspace],
  );

  const handleResetSurfaceArea = useCallback(
    (id: string) => {
      updateSurfaceWorkspace((current) => ({
        ...current,
        areas: current.areas.map((area) =>
          area.id === id ? { ...area, config: sanitizeThemedConfig(DEFAULT_LAB_ENGINE_CONFIG) } : area,
        ),
      }));
      setEditorRevision((value) => value + 1);
    },
    [updateSurfaceWorkspace],
  );

  return (
    <LabInner
      clientMode={clientMode}
      surfaceWorkspace={clientMode ? { ...surfaceWorkspace, mode: "full" } : surfaceWorkspace}
      surfaceEditorRevision={editorRevision}
      initialConfig={initialConfig}
      onSurfaceModeChange={handleSurfaceModeChange}
      onAddSurfaceArea={handleAddSurfaceArea}
      onSelectSurfaceArea={handleSelectSurfaceArea}
      onPreviewSurfaceAreaPoints={handlePreviewSurfaceAreaPoints}
      onUpdateSurfaceAreaPoints={handleUpdateSurfaceAreaPoints}
      onUpdateSurfaceAreaConfig={handleUpdateSurfaceAreaConfig}
      onToggleSurfaceArea={handleToggleSurfaceArea}
      onDeleteSurfaceArea={handleDeleteSurfaceArea}
      onResetSurfaceArea={handleResetSurfaceArea}
    />
  );
}
