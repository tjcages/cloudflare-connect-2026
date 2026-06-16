import { Filter, Sprite, Texture, VideoSource } from "pixi.js";
import type { RefObject } from "react";
import type { Ticker } from "../components/pixi";
import { BlockGridTexture } from "./blockGridTexture";
import { resampleBlockGrid } from "./resampleBlockGrid";
import type { BlockGrid, GridPreprocessCache, LumaGrid } from "./computeBlockGrid";
import {
  buildPlaygroundBlockGrid,
  sampleShaderPlaygroundFrame,
  sampleTextureFrame,
  sampleVideoFrame,
  type PlaygroundGridBuildState,
} from "./samplePlaygroundFrame";
import { createStripeDuotoneFilter, type StripeDuotoneFilter } from "./stripeDuotoneFilter";
import type { StripeColors } from "./stripeColors";
import { buildStripeLetterAtlas, destroyStripeLetterAtlas } from "./stripeLetterFont";
import {
  PlaygroundFlamesOverlay,
  resolvePlaygroundFlamesRasterSize,
  stepPlaygroundFlames,
  type PlaygroundFlamesState,
} from "./playgroundFlames";
import { DEFAULT_PLAYGROUND_FLAMES_CONFIG, type PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
import type { PlaygroundSparkleOptions } from "./playgroundSparkle";
import type { PlaygroundWidthShuffleOptions } from "./playgroundWidthShuffle";
import { createStripeLetterLayer, type StripeLetterLayer } from "./stripeLetterLayer";
import {
  DEFAULT_PLAYGROUND_GRID_CONFIG,
  effectivePlaygroundCellSize,
  type PlaygroundGridConfig,
} from "./playgroundGridConfig";
import {
  DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
  resolvePlaygroundDrawRects,
  type PlaygroundSourceTransform,
} from "./playgroundSourceTransform";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  isDefaultPlaygroundTextureAdjustments,
  normalizePlaygroundTextureAdjustments,
  renderAdjustedPreviewPixels,
  type PlaygroundTextureAdjustments,
} from "./playgroundTextureAdjustments";
import {
  DEFAULT_PLAYGROUND_REVEAL_CONFIG,
  resolvePlaygroundRevealDurationMs,
  type PlaygroundRevealConfig,
} from "./playgroundRevealConfig";
import type { PlaygroundRevealState } from "./playgroundReveal";
import {
  detectTextureBackgroundColor,
  overlayInvertsStripeBucketing,
  normalizeTextureLuminanceMode,
  type TextureLuminanceMode,
  type TextureLuminanceSettings,
} from "./colorWhiteness";
import { createSourceTextureFilter } from "./sourceTextureFilter";
import {
  DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  normalizePlaygroundCursorTrailConfig,
  type PlaygroundCursorTrailConfig,
} from "./playgroundCursorTrailConfig";
import { addClickWave, createClickWaveState, updateClickWave, type ClickWaveState } from "./clickWave";
import { createCursorTrailState, setCursorTrailTarget, updateCursorTrail, type CursorTrailState } from "./cursorTrail";
import {
  accumulateClickWaveCellMap,
  accumulateCursorTrailCellMap,
  applyCursorTrailCell,
  CLICK_WAVE_MAX_PUSH_CELLS,
  CURSOR_TRAIL_MAX_PUSH_CELLS,
  CursorTrailOverlay,
  finalizeCursorTrailCellMap,
  resetCursorTrailCellMap,
  resolveCursorTrailPushScaleCells,
  type CursorTrailCellMap,
} from "./cursorTrailOverlay";
import { resolvePlaygroundDisplayStripeIndices } from "./resolvePlaygroundDisplayStripeIndices";
import { buildStripeIndexLut, resolvePlaygroundPixiTint, resolveStripesForLuminanceMode } from "./stripeColors";
import {
  DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
  normalizePlaygroundClickWaveConfig,
  type PlaygroundClickWaveConfig,
} from "./playgroundClickWaveConfig";
import {
  createPlaygroundPerfTimer,
  isPlaygroundPerfProfilingEnabled,
  recordPlaygroundPerfSample,
} from "./playgroundPerfProfile";
import {
  PLAYGROUND_SHADER_NATIVE_HEIGHT,
  PLAYGROUND_SHADER_NATIVE_WIDTH,
  PlaygroundShaderRenderer,
  resolvePlaygroundShaderRenderSize,
} from "./playgroundShaderSource";
import { createPlaygroundGridBuildQueue, type AsyncGridBuildResult } from "./playgroundGridBuildAsync";
import type { PlaygroundAudioInput } from "./playgroundAudioInput";
import {
  flamesToPixelBounds,
  pixelBoundsToCellRegion,
  regionCellCount,
  type GridCellRegion,
} from "./playgroundGridDirty";

/** Default canvas scale for clips without an explicit per-texture scale. */
export const PLAYGROUND_DISPLAY_SCALE = 0.5;

/** Pixi resolution for the playground canvas (2× backing store for sharper stripes and letters). */
export const PLAYGROUND_PIXI_RESOLUTION = 2;

export const PLAYGROUND_DISPLAY_MAX_PX = 8192;

/** Default canvas width when no saved size exists; height follows source aspect ratio. */
export const PLAYGROUND_DEFAULT_DISPLAY_MAX_WIDTH = 1000;

export function clampPlaygroundDisplayDimension(value: number, fallback: number): number {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded) || rounded < 1) {
    return fallback;
  }
  return Math.min(PLAYGROUND_DISPLAY_MAX_PX, rounded);
}

/** Minimum ms between block-grid rebuilds (reduces temporal shimmer on noisy clips). */
export const PLAYGROUND_GRID_UPDATE_INTERVAL_MS = 66;

/** Minimum ms between full pixel resamples during continuous slider scrubbing. */
export const PLAYGROUND_FULL_RESAMPLE_THROTTLE_MS = 32;

type GridSampleDecision = {
  needsSourceFrame: boolean;
  shouldRebuildGrid: boolean;
};

export function resolveGridSampleDecision(params: {
  hasBuiltGrid: boolean;
  pendingFullResample: boolean;
  fullResampleReady: boolean;
  sourceSampleDirty: boolean;
  gridUpdateDue: boolean;
}): GridSampleDecision {
  const { hasBuiltGrid, pendingFullResample, fullResampleReady, sourceSampleDirty, gridUpdateDue } = params;
  const shouldRebuildGrid =
    !hasBuiltGrid ||
    (pendingFullResample && fullResampleReady) ||
    (!pendingFullResample && sourceSampleDirty && gridUpdateDue);
  return {
    needsSourceFrame: shouldRebuildGrid,
    shouldRebuildGrid,
  };
}

/**
 * The cell-resolution grid sampling fast path reads the source back at one pixel per grid cell.
 * It is only safe when no feature needs per-display-pixel data: reveal applies sub-cell column
 * softness and colors mode measures per-pixel background coverage. Flames do not gate the fast
 * path: live ticks composite flames on the GPU (stripe filter overlay), and only the export
 * capture merges them into the grid build at full resolution.
 */
export function canUseCellResGridSampling(params: {
  revealEnabled: boolean;
  luminanceMode: TextureLuminanceMode;
}): boolean {
  return !params.revealEnabled && params.luminanceMode !== "colors";
}

function mergePixelBounds(
  a: { dirtyMinX: number; dirtyMinY: number; dirtyMaxX: number; dirtyMaxY: number } | null,
  b: { dirtyMinX: number; dirtyMinY: number; dirtyMaxX: number; dirtyMaxY: number } | null,
): { dirtyMinX: number; dirtyMinY: number; dirtyMaxX: number; dirtyMaxY: number } | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return {
    dirtyMinX: Math.min(a.dirtyMinX, b.dirtyMinX),
    dirtyMinY: Math.min(a.dirtyMinY, b.dirtyMinY),
    dirtyMaxX: Math.max(a.dirtyMaxX, b.dirtyMaxX),
    dirtyMaxY: Math.max(a.dirtyMaxY, b.dirtyMaxY),
  };
}

/** Static ref used when a caller does not provide a live grid-config ref. */
const DEFAULT_GRID_CONFIG_REF: RefObject<PlaygroundGridConfig> = { current: DEFAULT_PLAYGROUND_GRID_CONFIG };
const DEFAULT_STRIPES_ENABLED_REF: RefObject<boolean> = { current: true };
const DEFAULT_TEXTURE_ADJUSTMENTS_REF: RefObject<PlaygroundTextureAdjustments> = {
  current: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
};
const DEFAULT_TEXTURE_LUMINANCE_SETTINGS_REF: RefObject<TextureLuminanceSettings> = {
  current: { mode: "luminance", backgroundColor: 0x000000 },
};
const DEFAULT_SOURCE_TRANSFORM_REF: RefObject<PlaygroundSourceTransform> = {
  current: DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
};
const DEFAULT_FLAMES_STATE_REF: RefObject<PlaygroundFlamesState | null> = { current: null };
const DEFAULT_FLAMES_CONFIG_REF: RefObject<PlaygroundFlamesConfig> = { current: DEFAULT_PLAYGROUND_FLAMES_CONFIG };
const DEFAULT_REVEAL_CONFIG_REF: RefObject<PlaygroundRevealConfig> = { current: DEFAULT_PLAYGROUND_REVEAL_CONFIG };
const DEFAULT_REVEAL_STATE_REF: RefObject<PlaygroundRevealState> = { current: { progress: 1 } };
const DEFAULT_REVEAL_PLAYBACK_REF: RefObject<PlaygroundRevealPlayback> = {
  current: { replayKey: 0, startedAtMs: 0 },
};
const DEFAULT_CURSOR_TRAIL_CONFIG_REF: RefObject<PlaygroundCursorTrailConfig> = {
  current: DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
};
const DEFAULT_CLICK_WAVE_CONFIG_REF: RefObject<PlaygroundClickWaveConfig> = {
  current: DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
};
export type PlaygroundDisplaySize = { width: number; height: number };

export type PlaygroundSceneExportState = {
  grid: BlockGrid | null;
  colors: StripeColors;
  displayWidth: number;
  displayHeight: number;
};

/** Returns the block map currently driving the stripe filter (no resample). */
export type PlaygroundExportDisplayGridCapture = () => BlockGrid | null;

/** Synchronously rebuild the live stripe grid using the same path as the scene ticker. */
export type PlaygroundExportGridCapture = () => BlockGrid | null;

/** True when export state holds a full grid rebuild (not a partial indices-only update). */
export function isCompletePlaygroundExportGrid(
  snapshot: PlaygroundSceneExportState | null | undefined,
  display: PlaygroundDisplaySize,
  options: { requireCellColors?: boolean } = {},
): boolean {
  const grid = snapshot?.grid;
  if (!grid || !snapshot) {
    return false;
  }
  if (snapshot.displayWidth !== display.width || snapshot.displayHeight !== display.height) {
    return false;
  }
  const cells = grid.cols * grid.rows;
  if (cells <= 0 || grid.indices.length !== cells) {
    return false;
  }
  if (grid.luma?.length !== cells) {
    return false;
  }
  if (options.requireCellColors && grid.colors?.length !== cells * 3) {
    return false;
  }
  return true;
}

export type PlaygroundTextureSource =
  | { kind: "video"; element: HTMLVideoElement }
  | { kind: "image"; element: HTMLImageElement }
  | { kind: "shader"; renderer: PlaygroundShaderRenderer };

type TextureFilterMode = "off" | "preview" | "stripes";

export type PlaygroundRevealPlayback = {
  replayKey: number;
  startedAtMs: number;
};

function resolveTextureFilterMode(duotoneEnabled: boolean, stripesEnabled: boolean): TextureFilterMode {
  if (!stripesEnabled) {
    return "preview";
  }
  if (!duotoneEnabled) {
    return "off";
  }
  return "stripes";
}

/**
 * Whether the procedural shader's Pixi texture is actually visible on screen. In pure stripe
 * rendering the duotone filter replaces every sprite pixel, so the per-tick WebGL render and
 * canvas-to-GPU texture upload are pure waste — grid samplers render on demand instead. The
 * texture only needs live updates when the raw source shows: preview/off modes and the overlay
 * underlay.
 */
export function isShaderTextureLiveRenderNeeded(params: {
  duotoneEnabled: boolean;
  stripesEnabled: boolean;
  luminanceMode: TextureLuminanceMode;
}): boolean {
  const mode = resolveTextureFilterMode(params.duotoneEnabled, params.stripesEnabled);
  return mode !== "stripes" || params.luminanceMode === "overlay";
}

export function resolveStripeSpriteFilters(
  textureFilterMode: TextureFilterMode,
  stripeFilter: StripeDuotoneFilter,
): Filter[] | null {
  if (textureFilterMode !== "stripes") {
    return null;
  }
  return [stripeFilter];
}

function syncStripeSpriteFilters(
  sprite: Sprite,
  textureFilterMode: TextureFilterMode,
  luminanceMode: TextureLuminanceMode,
  stripeFilter: StripeDuotoneFilter,
) {
  sprite.filters = resolveStripeSpriteFilters(textureFilterMode, stripeFilter);
  stripeFilter.syncTextureUnderlay(normalizeTextureLuminanceMode(luminanceMode) === "overlay");
}

function maybeAutoDetectColorsBackground(
  frame: ImageData,
  display: PlaygroundDisplaySize,
  luminanceSettings: TextureLuminanceSettings,
  alreadyDetected: boolean,
): { settings: TextureLuminanceSettings; detected: boolean; changed: boolean } {
  if (alreadyDetected || normalizeTextureLuminanceMode(luminanceSettings.mode) !== "colors") {
    return { settings: luminanceSettings, detected: alreadyDetected, changed: false };
  }

  const detectedBackground = detectTextureBackgroundColor(frame.data, display.width, display.height);
  if (detectedBackground === luminanceSettings.backgroundColor) {
    return { settings: luminanceSettings, detected: true, changed: false };
  }

  return {
    settings: { ...luminanceSettings, backgroundColor: detectedBackground },
    detected: true,
    changed: true,
  };
}

/** Native pixel dimensions from the loaded texture source. */
export function getPlaygroundTextureNativeSize(source: PlaygroundTextureSource): PlaygroundDisplaySize {
  if (source.kind === "shader") {
    return {
      width: source.renderer.canvas.width || PLAYGROUND_SHADER_NATIVE_WIDTH,
      height: source.renderer.canvas.height || PLAYGROUND_SHADER_NATIVE_HEIGHT,
    };
  }
  if (source.kind === "video") {
    const width = source.element.videoWidth;
    const height = source.element.videoHeight;
    if (width <= 0 || height <= 0) {
      return { width: 0, height: 0 };
    }
    return { width, height };
  }
  const width = source.element.naturalWidth;
  const height = source.element.naturalHeight;
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  return { width, height };
}

/** @deprecated Use {@link getPlaygroundTextureNativeSize}. */
export function getPlaygroundVideoNativeSize(video: HTMLVideoElement): PlaygroundDisplaySize {
  return getPlaygroundTextureNativeSize({ kind: "video", element: video });
}

/** Scales native size down so width is at most {@link PLAYGROUND_DEFAULT_DISPLAY_MAX_WIDTH}. */
export function resolveDefaultPlaygroundDisplaySize(native: PlaygroundDisplaySize): PlaygroundDisplaySize {
  if (native.width <= 0 || native.height <= 0) {
    return { width: 0, height: 0 };
  }
  if (native.width <= PLAYGROUND_DEFAULT_DISPLAY_MAX_WIDTH) {
    return { width: native.width, height: native.height };
  }
  const width = PLAYGROUND_DEFAULT_DISPLAY_MAX_WIDTH;
  const height = Math.round((width * native.height) / native.width);
  return { width, height };
}

/** Uses explicit canvas size when both dimensions are positive; otherwise default scaled size. */
export function resolvePlaygroundDisplaySize(
  native: PlaygroundDisplaySize,
  canvas?: { displayWidth?: number; displayHeight?: number },
): PlaygroundDisplaySize {
  const width = canvas?.displayWidth;
  const height = canvas?.displayHeight;
  if (width && width > 0 && height && height > 0) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  return resolveDefaultPlaygroundDisplaySize(native);
}

/** Scaled display size; height derived from width so aspect ratio stays exact. */
export function getPlaygroundDisplaySize(
  source: PlaygroundTextureSource,
  displayScale = PLAYGROUND_DISPLAY_SCALE,
): PlaygroundDisplaySize {
  const native = getPlaygroundTextureNativeSize(source);
  if (native.width <= 0 || native.height <= 0) {
    return { width: 0, height: 0 };
  }

  const width = Math.round(native.width * displayScale);
  const height = Math.round((width * native.height) / native.width);
  return { width, height };
}

function syncPreviewSpriteLayout(sprite: Sprite) {
  sprite.anchor.set(0, 0);
  sprite.position.set(0, 0);
  sprite.scale.set(1, 1);
}

function syncSpriteToDisplay(
  sprite: Sprite,
  source: PlaygroundTextureSource,
  display: PlaygroundDisplaySize,
  sourceTransform: PlaygroundSourceTransform,
) {
  const native = getPlaygroundTextureNativeSize(source);
  if (native.width <= 0 || native.height <= 0 || display.width <= 0 || display.height <= 0) {
    return;
  }

  const { source: sourceRect, destination } = resolvePlaygroundDrawRects(native, display, sourceTransform);
  sprite.anchor.set(0, 0);
  sprite.position.set(
    destination.dx - sourceRect.sx * (destination.dw / sourceRect.sw),
    destination.dy - sourceRect.sy * (destination.dh / sourceRect.sh),
  );
  sprite.scale.set(destination.dw / sourceRect.sw, destination.dh / sourceRect.sh);
}

function createPlaygroundLetterLayer(
  app: Parameters<Ticker>[0]["app"],
  duotoneEnabled: boolean,
  grid: PlaygroundGridConfig,
): { letterLayer: StripeLetterLayer; atlas: ReturnType<typeof buildStripeLetterAtlas> } {
  const charset = [...grid.letterCharset];
  const effectiveCell = effectivePlaygroundCellSize(grid);
  const atlas = buildStripeLetterAtlas(charset, grid.letterSize);
  const letterLayer = createStripeLetterLayer(atlas, {
    cellWidth: effectiveCell.width,
    cellHeight: effectiveCell.height,
    orientation: grid.orientation,
    tint: grid.letterColor,
    ratio: grid.letterRatio,
    charset,
  });
  letterLayer.setVisible(duotoneEnabled);
  app.stage.addChild(letterLayer.container);
  return { letterLayer, atlas };
}

function cursorTrailPointFromEvent(
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  display: PlaygroundDisplaySize,
): { x: number; y: number } | null {
  const bounds = canvas.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  ) {
    return null;
  }
  const scaleX = bounds.width > 0 ? display.width / bounds.width : 1;
  const scaleY = bounds.height > 0 ? display.height / bounds.height : 1;
  return {
    x: (event.clientX - bounds.left) * scaleX,
    y: (event.clientY - bounds.top) * scaleY,
  };
}

function attachPlaygroundPointerEvents(
  canvas: HTMLCanvasElement,
  display: PlaygroundDisplaySize,
  cursorTrailState: CursorTrailState,
  clickWaveState: ClickWaveState,
  clickWaveConfigRef: RefObject<PlaygroundClickWaveConfig>,
): () => void {
  const onPointerMove = (event: PointerEvent) => {
    setCursorTrailTarget(cursorTrailState, cursorTrailPointFromEvent(event, canvas, display));
  };
  const onPointerDown = (event: PointerEvent) => {
    const clickWaveConfig = normalizePlaygroundClickWaveConfig(clickWaveConfigRef.current);
    const point = cursorTrailPointFromEvent(event, canvas, display);
    if (!point || !clickWaveConfig.enabled) {
      return;
    }
    addClickWave(clickWaveState, point, clickWaveConfig.lifeMs);
  };
  const onPointerLeave = () => {
    setCursorTrailTarget(cursorTrailState, null);
  };

  window.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointercancel", onPointerLeave);
  window.addEventListener("blur", onPointerLeave);

  return () => {
    window.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("pointercancel", onPointerLeave);
    window.removeEventListener("blur", onPointerLeave);
  };
}

function runDuotoneTick(params: {
  app: Parameters<Ticker>[0]["app"];
  sprite: Sprite;
  stripeFilter: ReturnType<typeof createStripeDuotoneFilter>;
  sourceTextureFilter: ReturnType<typeof createSourceTextureFilter>;
  letterLayer: StripeLetterLayer;
  duotoneEnabledRef: RefObject<boolean>;
  stripesEnabledRef: RefObject<boolean>;
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>;
  widthShuffleOptionsRef: RefObject<PlaygroundWidthShuffleOptions>;
  flamesStateRef: RefObject<PlaygroundFlamesState | null>;
  flamesConfigRef: RefObject<PlaygroundFlamesConfig>;
  revealConfigRef: RefObject<PlaygroundRevealConfig>;
  revealStateRef: RefObject<PlaygroundRevealState>;
  revealPlaybackRef: RefObject<PlaygroundRevealPlayback>;
  stripeColorsRef: RefObject<StripeColors>;
  preferP3Ref: RefObject<boolean>;
  textureGammaRef: RefObject<number>;
  textureAdjustmentsRef: RefObject<PlaygroundTextureAdjustments>;
  textureLuminanceSettingsRef: RefObject<TextureLuminanceSettings>;
  sourceTransformRef: RefObject<PlaygroundSourceTransform>;
  gridConfigRef: RefObject<PlaygroundGridConfig>;
  display: PlaygroundDisplaySize;
  blockGridTexture: BlockGridTexture;
  atlas: ReturnType<typeof buildStripeLetterAtlas>;
  cursorTrailConfigRef: RefObject<PlaygroundCursorTrailConfig>;
  clickWaveConfigRef: RefObject<PlaygroundClickWaveConfig>;
  cursorTrailState: CursorTrailState;
  clickWaveState: ClickWaveState;
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>;
  exportDisplayGridRef?: RefObject<PlaygroundExportDisplayGridCapture | null>;
  exportGridCaptureRef?: RefObject<PlaygroundExportGridCapture | null>;
  prepareExportSample?: () => void;
  syncVisual: () => void;
  shouldSample: () => boolean;
  sampleFrame: () => ImageData | null;
  /**
   * Optional low-resolution sampler for grid rebuilds: returns a cols×rows frame where one
   * pixel maps to one grid cell (built with cell size 1×1), or null to use `sampleFrame`.
   */
  sampleGridFrame?: (cols: number, rows: number) => ImageData | null;
  /**
   * True when sampled frames are guaranteed fully opaque (e.g. shader frames force alpha 255).
   * Lets preview/overlay baking skip the CPU adjustment pass when adjustments are identity.
   */
  previewSourceOpaque?: boolean;
  onSampled?: () => void;
  onTextureLuminanceSettingsDetected?: (settings: TextureLuminanceSettings) => void;
}): { tick: () => void; dispose: () => void } {
  const {
    app,
    sprite,
    stripeFilter,
    sourceTextureFilter,
    letterLayer,
    duotoneEnabledRef,
    stripesEnabledRef,
    sparkleOptionsRef,
    widthShuffleOptionsRef,
    flamesStateRef,
    flamesConfigRef,
    revealConfigRef,
    revealStateRef,
    revealPlaybackRef,
    stripeColorsRef,
    preferP3Ref,
    textureGammaRef,
    textureAdjustmentsRef,
    textureLuminanceSettingsRef,
    sourceTransformRef,
    gridConfigRef,
    display,
    cursorTrailConfigRef,
    clickWaveConfigRef,
    cursorTrailState,
    clickWaveState,
    exportStateRef,
    exportDisplayGridRef,
    exportGridCaptureRef,
    prepareExportSample,
    syncVisual,
    shouldSample,
    sampleFrame,
    sampleGridFrame,
    previewSourceOpaque,
    onSampled,
    onTextureLuminanceSettingsDetected,
  } = params;

  // These GPU resources are reallocated in place when the cell/gap or letters change, so a
  // config tweak updates the live scene instead of remounting the whole Pixi app.
  let blockGridTexture = params.blockGridTexture;
  let atlas = params.atlas;

  let textureFilterMode = resolveTextureFilterMode(duotoneEnabledRef.current, stripesEnabledRef.current);
  let lastColorsKey = "";
  let colorsBackgroundAutoDetected = false;
  let lastLuminanceMode = normalizeTextureLuminanceMode(textureLuminanceSettingsRef.current.mode);
  let gridState: PlaygroundGridBuildState = {};
  let lastGridUpdateMs = 0;
  let lastFullResampleMs = 0;
  let lastPreviewBakeMs = 0;
  let lastTrailTickMs = performance.now();
  let hasBuiltGrid = false;
  let pendingFullResample = false;
  let pendingColorsResample = false;
  const initialCell = effectivePlaygroundCellSize(gridConfigRef.current);
  const initialFlamesRaster = resolvePlaygroundFlamesRasterSize(
    display.width,
    display.height,
    initialCell.width,
    initialCell.height,
  );
  const flamesOverlay = flamesStateRef.current
    ? new PlaygroundFlamesOverlay(initialFlamesRaster.width, initialFlamesRaster.height)
    : null;
  const cursorTrailOverlay = new CursorTrailOverlay(blockGridTexture.cols, blockGridTexture.rows);
  let lastLumaGrid: LumaGrid | null = null;
  let lastGrid: BlockGrid | null = null;
  let gridPreprocessCache: GridPreprocessCache | null = null;
  let trailStripeLut: Uint8Array | null = null;
  let trailMap: CursorTrailCellMap | null = null;
  let trailLetterIndices: Uint8Array | null = null;
  let lastTrailNonEmpty = false;
  let lastEffWidth = initialCell.width;
  let lastEffHeight = initialCell.height;
  let lastLetterSize = gridConfigRef.current.letterSize;
  let lastLetterCharset = gridConfigRef.current.letterCharset;
  let lastLetterRatio = gridConfigRef.current.letterRatio;
  let lastRevealReplayKey = revealPlaybackRef.current.replayKey;
  let lastScreenScale = Number.NaN;
  let workerRequestEpoch = 0;
  const gridBuildQueue = createPlaygroundGridBuildQueue();
  let queuedGridResult: AsyncGridBuildResult | null = null;

  const originalSpriteTexture = sprite.texture;
  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = display.width;
  previewCanvas.height = display.height;
  const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });
  if (!previewCtx) {
    throw new Error("2D canvas context unavailable for preview texture baking.");
  }
  let previewImageData = previewCtx.createImageData(display.width, display.height);
  const previewTexture = Texture.from(previewCanvas);
  previewTexture.source.alphaMode = "no-premultiply-alpha";
  previewTexture.source.scaleMode = "linear";

  const restoreOriginalSpriteTexture = () => {
    if (sprite.texture !== originalSpriteTexture) {
      sprite.texture = originalSpriteTexture;
    }
  };

  const bakeAdjustedPreviewTexture = (): boolean => {
    // Identity adjustments leave opaque pixels unchanged, so the raw source texture is already
    // the adjusted preview: skip the full-res readback + CPU adjustment pass entirely.
    if (
      previewSourceOpaque &&
      isDefaultPlaygroundTextureAdjustments(
        normalizePlaygroundTextureAdjustments({
          ...textureAdjustmentsRef.current,
          gamma: textureGammaRef.current,
        }),
      )
    ) {
      restoreOriginalSpriteTexture();
      syncVisual();
      return true;
    }
    const frame = sampleFrame();
    if (!frame) {
      return false;
    }
    if (previewCanvas.width !== frame.width || previewCanvas.height !== frame.height) {
      previewCanvas.width = frame.width;
      previewCanvas.height = frame.height;
      previewImageData = previewCtx.createImageData(frame.width, frame.height);
    }
    const adjusted = renderAdjustedPreviewPixels(
      frame.data,
      frame.width,
      frame.height,
      {
        ...textureAdjustmentsRef.current,
        gamma: textureGammaRef.current,
      },
      textureLuminanceSettingsRef.current,
    );
    previewImageData.data.set(adjusted);
    previewCtx.putImageData(previewImageData, 0, 0);
    previewTexture.source.update();
    if (sprite.texture !== previewTexture) {
      sprite.texture = previewTexture;
    }
    syncPreviewSpriteLayout(sprite);
    return true;
  };

  const applyBuiltGrid = (
    builtGrid: BlockGrid,
    nextState: PlaygroundGridBuildState,
    nextLumaGrid: LumaGrid,
    nextPreprocessCache: GridPreprocessCache | null,
    partial: boolean,
    partialRegion: GridCellRegion | null,
    includeColors: boolean,
  ) => {
    hasBuiltGrid = true;
    gridState = nextState;
    lastLumaGrid = nextLumaGrid;
    lastGrid = builtGrid;
    gridPreprocessCache = nextPreprocessCache;
    if (partial && partialRegion) {
      blockGridTexture.updateRegion(builtGrid, partialRegion, { includeColors });
    } else {
      blockGridTexture.update(builtGrid, { includeColors });
    }
    letterLayer.sync(builtGrid);
  };

  const applyStructuralChanges = (gridConfig: PlaygroundGridConfig) => {
    const eff = effectivePlaygroundCellSize(gridConfig);
    if (eff.width !== lastEffWidth || eff.height !== lastEffHeight) {
      const prevCols = blockGridTexture.cols;
      const prevRows = blockGridTexture.rows;
      const prevIndices = gridState.stableIndices;

      const dimensionsChanged = blockGridTexture.resize(display.width, display.height, eff.width, eff.height);
      if (dimensionsChanged) {
        stripeFilter.updateBlockMap(blockGridTexture.texture);
        stripeFilter.updateCellColorMap(blockGridTexture.colorTexture);
        stripeFilter.resizeGrid(blockGridTexture.cols, blockGridTexture.rows, eff.width, eff.height);
        letterLayer.setCellSize(eff.width, eff.height);
        cursorTrailOverlay.resize(blockGridTexture.cols, blockGridTexture.rows);
        lastLumaGrid = null;
        gridPreprocessCache = null;
        workerRequestEpoch += 1;

        if (prevIndices && prevIndices.length > 0) {
          const resampled = resampleBlockGrid(
            prevIndices,
            prevCols,
            prevRows,
            blockGridTexture.cols,
            blockGridTexture.rows,
          );
          gridState = { stableIndices: resampled.indices };
          blockGridTexture.update(resampled);
          letterLayer.sync(resampled);
          lastGrid = resampled;
          hasBuiltGrid = true;
        } else {
          lastGrid = null;
          hasBuiltGrid = false;
        }
        pendingFullResample = true;
      }

      lastEffWidth = eff.width;
      lastEffHeight = eff.height;
    }

    if (gridConfig.letterSize !== lastLetterSize || gridConfig.letterCharset !== lastLetterCharset) {
      const charset = [...gridConfig.letterCharset];
      const nextAtlas = buildStripeLetterAtlas(charset, gridConfig.letterSize);
      destroyStripeLetterAtlas(atlas);
      atlas = nextAtlas;
      letterLayer.setAtlas(nextAtlas);
      letterLayer.setCharset(charset);
      lastLetterSize = gridConfig.letterSize;
      lastLetterCharset = gridConfig.letterCharset;
      lastGrid = null;
      gridPreprocessCache = null;
      workerRequestEpoch += 1;
      hasBuiltGrid = false;
      pendingFullResample = true;
    }

    if (gridConfig.letterRatio !== lastLetterRatio) {
      letterLayer.setRatio(gridConfig.letterRatio);
      lastLetterRatio = gridConfig.letterRatio;
      pendingFullResample = true;
    }
  };

  const captureDisplayGrid = (): BlockGrid | null => {
    if (!duotoneEnabledRef.current || !stripesEnabledRef.current || !hasBuiltGrid) {
      return null;
    }
    const useCellColors = normalizeTextureLuminanceMode(textureLuminanceSettingsRef.current.mode) === "colors";
    const snapshot = blockGridTexture.snapshotGrid({ includeColors: useCellColors });
    const luminanceMode = normalizeTextureLuminanceMode(textureLuminanceSettingsRef.current.mode);
    const cursorTrailConfig = normalizePlaygroundCursorTrailConfig(cursorTrailConfigRef.current);
    const clickWaveConfig = normalizePlaygroundClickWaveConfig(clickWaveConfigRef.current);
    const trailSamplingEnabled = cursorTrailConfig.enabled;
    const clickWaveSamplingEnabled = clickWaveConfig.enabled;
    const pointerActive = (trailSamplingEnabled || clickWaveSamplingEnabled) && trailMap?.nonEmpty === true;
    const displayIndices = resolvePlaygroundDisplayStripeIndices(
      snapshot.indices,
      snapshot.luma,
      stripeColorsRef.current,
      luminanceMode,
      pointerActive ? trailMap : null,
    );
    return {
      ...snapshot,
      indices: displayIndices,
    };
  };

  const captureExportGrid = (): BlockGrid | null => {
    if (!duotoneEnabledRef.current || !stripesEnabledRef.current) {
      return null;
    }

    const luminanceMode = normalizeTextureLuminanceMode(textureLuminanceSettingsRef.current.mode);
    if (luminanceMode === "overlay") {
      bakeAdjustedPreviewTexture();
    } else {
      restoreOriginalSpriteTexture();
      syncVisual();
    }

    prepareExportSample?.();
    const frame = sampleFrame();
    if (!frame) {
      return null;
    }

    const colors = stripeColorsRef.current;
    const gridConfig = gridConfigRef.current;
    const effectiveCell = effectivePlaygroundCellSize(gridConfig);
    const revealConfig = revealConfigRef.current;
    const revealEnabled = revealConfig.enabled;
    const revealProgress = revealEnabled
      ? Math.min(
          1,
          Math.max(
            0,
            (performance.now() - revealPlaybackRef.current.startedAtMs) /
              Math.max(1, resolvePlaygroundRevealDurationMs(revealConfig)),
          ),
        )
      : 1;

    const built = buildPlaygroundBlockGrid(
      frame,
      display.width,
      display.height,
      colors,
      gridState,
      textureGammaRef.current,
      {
        cellWidth: effectiveCell.width,
        cellHeight: effectiveCell.height,
        textureAdjustments: {
          ...textureAdjustmentsRef.current,
          gamma: textureGammaRef.current,
        },
        luminanceSettings: textureLuminanceSettingsRef.current,
        flamesState: flamesStateRef.current,
        flamesConfig: flamesConfigRef.current,
        reveal: revealEnabled
          ? {
              config: revealConfig,
              progress: revealProgress,
              replayKey: revealPlaybackRef.current.replayKey,
            }
          : undefined,
      },
    );
    gridState = built.state;
    lastLumaGrid = built.lumaGrid;
    lastGrid = built.grid;
    gridPreprocessCache = built.preprocessCache;
    hasBuiltGrid = true;

    blockGridTexture.update(built.grid, {
      includeColors: normalizeTextureLuminanceMode(textureLuminanceSettingsRef.current.mode) === "colors",
    });
    letterLayer.sync(built.grid);

    if (exportStateRef) {
      exportStateRef.current = {
        grid: built.grid,
        colors,
        displayWidth: display.width,
        displayHeight: display.height,
      };
    }

    return built.grid;
  };

  if (exportDisplayGridRef) {
    exportDisplayGridRef.current = captureDisplayGrid;
  }
  if (exportGridCaptureRef) {
    exportGridCaptureRef.current = captureExportGrid;
  }

  const dispose = () => {
    if (exportDisplayGridRef) {
      exportDisplayGridRef.current = null;
    }
    if (exportGridCaptureRef) {
      exportGridCaptureRef.current = null;
    }
    restoreOriginalSpriteTexture();
    previewTexture.destroy(true);
    blockGridTexture.destroy();
    gridBuildQueue?.dispose();
    flamesOverlay?.destroy();
    cursorTrailOverlay.destroy();
    letterLayer.destroy();
    destroyStripeLetterAtlas(atlas);
  };

  const tick = () => {
    const tickTimer = isPlaygroundPerfProfilingEnabled() ? createPlaygroundPerfTimer() : null;
    let sampleFrameMs = 0;
    let pointerCompositeMs = 0;
    let buildGridMs = 0;
    let blockTextureMs = 0;
    let workerGridApplied = false;
    const now = performance.now();
    const cursorTrailConfig = normalizePlaygroundCursorTrailConfig(cursorTrailConfigRef.current);
    const clickWaveConfig = normalizePlaygroundClickWaveConfig(clickWaveConfigRef.current);
    const trailDtMs = now - lastTrailTickMs;
    lastTrailTickMs = now;
    const trail = updateCursorTrail(cursorTrailState, trailDtMs, cursorTrailConfig);
    const clickWave = updateClickWave(clickWaveState, trailDtMs, clickWaveConfig);
    sourceTextureFilter.syncAdjustments({
      ...textureAdjustmentsRef.current,
      gamma: textureGammaRef.current,
    });
    sourceTextureFilter.syncLuminanceSettings(textureLuminanceSettingsRef.current);
    stripeFilter.syncUseCellColors(textureLuminanceSettingsRef.current.mode === "colors");
    stripeFilter.syncInvertStripeBucketing(overlayInvertsStripeBucketing(textureLuminanceSettingsRef.current.mode));
    const luminanceMode = normalizeTextureLuminanceMode(textureLuminanceSettingsRef.current.mode);
    const useCellColors = luminanceMode === "colors";
    stripeFilter.syncTextureUnderlay(luminanceMode === "overlay");
    const flamesState = flamesStateRef.current;
    const flamesConfig = flamesConfigRef.current;
    const previousFlamesBounds = flamesState && flamesConfig.enabled ? flamesToPixelBounds(flamesState.flames) : null;
    if (flamesState && flamesConfig.enabled) {
      stepPlaygroundFlames(flamesState, flamesConfig, display, performance.now());
    }
    const nextFlamesBounds = flamesState && flamesConfig.enabled ? flamesToPixelBounds(flamesState.flames) : null;
    const dirtyFlamesBounds = mergePixelBounds(previousFlamesBounds, nextFlamesBounds);

    if (queuedGridResult) {
      const next = queuedGridResult;
      queuedGridResult = null;
      if (next.grid.cols === blockGridTexture.cols && next.grid.rows === blockGridTexture.rows) {
        const textureTimer = tickTimer ? createPlaygroundPerfTimer() : null;
        applyBuiltGrid(next.grid, next.state, next.lumaGrid, null, false, null, useCellColors);
        if (textureTimer) {
          blockTextureMs += textureTimer.elapsedMs();
        }
        workerGridApplied = true;
      }
    }

    stripeFilter.syncGrid(gridConfigRef.current);
    letterLayer.setTint(resolvePlaygroundPixiTint(gridConfigRef.current.letterColor, preferP3Ref.current));
    letterLayer.setShuffleSpeed(gridConfigRef.current.letterShuffleSpeed);
    applyStructuralChanges(gridConfigRef.current);

    const nextTextureFilterMode = resolveTextureFilterMode(duotoneEnabledRef.current, stripesEnabledRef.current);
    if (nextTextureFilterMode !== textureFilterMode) {
      if (nextTextureFilterMode === "stripes" || nextTextureFilterMode === "off") {
        restoreOriginalSpriteTexture();
      }
      textureFilterMode = nextTextureFilterMode;
      syncStripeSpriteFilters(sprite, textureFilterMode, luminanceMode, stripeFilter);
      letterLayer.setVisible(textureFilterMode === "stripes");
      if (textureFilterMode === "stripes") {
        lastColorsKey = "";
        lastGrid = null;
        gridPreprocessCache = null;
        workerRequestEpoch += 1;
        hasBuiltGrid = false;
      } else {
        letterLayer.sync(null);
      }
    }

    if (luminanceMode !== lastLuminanceMode) {
      if (luminanceMode === "colors") {
        colorsBackgroundAutoDetected = false;
      }
      if (textureFilterMode === "stripes") {
        syncStripeSpriteFilters(sprite, textureFilterMode, luminanceMode, stripeFilter);
        const switchedOverlay = luminanceMode === "overlay" || lastLuminanceMode === "overlay";
        if (switchedOverlay) {
          pendingFullResample = true;
          lastColorsKey = "";
          gridState = {};
          lastGrid = null;
          gridPreprocessCache = null;
          workerRequestEpoch += 1;
          hasBuiltGrid = false;
          if (luminanceMode === "overlay") {
            bakeAdjustedPreviewTexture();
          } else {
            restoreOriginalSpriteTexture();
          }
        }
      }
      lastLuminanceMode = luminanceMode;
    }

    if (textureFilterMode !== "stripes") {
      if (textureFilterMode === "preview") {
        bakeAdjustedPreviewTexture();
      } else {
        restoreOriginalSpriteTexture();
        syncVisual();
      }

      if (luminanceMode === "colors" && !colorsBackgroundAutoDetected) {
        const frame = sampleFrame();
        if (frame) {
          const autoDetect = maybeAutoDetectColorsBackground(
            frame,
            display,
            textureLuminanceSettingsRef.current,
            colorsBackgroundAutoDetected,
          );
          colorsBackgroundAutoDetected = autoDetect.detected;
          if (autoDetect.changed) {
            textureLuminanceSettingsRef.current = autoDetect.settings;
            sourceTextureFilter.syncLuminanceSettings(autoDetect.settings);
            onTextureLuminanceSettingsDetected?.(autoDetect.settings);
          }
        }
      }

      sourceTextureFilter.syncFlames(null, null);
      stripeFilter.syncFlames(null, null);
      stripeFilter.syncCursorTrail(null, null, 0);
      if (exportStateRef) {
        exportStateRef.current = {
          grid: null,
          colors: stripeColorsRef.current,
          displayWidth: display.width,
          displayHeight: display.height,
        };
      }
      app.render();
      return;
    }

    sourceTextureFilter.syncFlames(null, null);
    const flamesRasterCell = effectivePlaygroundCellSize(gridConfigRef.current);
    const flamesRasterSize = resolvePlaygroundFlamesRasterSize(
      display.width,
      display.height,
      flamesRasterCell.width,
      flamesRasterCell.height,
    );
    if (flamesOverlay) {
      flamesOverlay.resize(flamesRasterSize.width, flamesRasterSize.height);
    }
    if (flamesOverlay && flamesState && flamesConfig.enabled) {
      flamesOverlay.sync(flamesState, flamesConfig, display.width, display.height);
      stripeFilter.syncFlames(flamesOverlay.texture, flamesConfig);
    } else {
      stripeFilter.syncFlames(null, null);
    }
    if (luminanceMode === "overlay") {
      // Baked preview is already display-sized (see preview mode); native-source scaling would
      // shrink it. The CPU bake is heavy at large display sizes, so re-bake on the grid update
      // cadence instead of every tick (identity adjustments skip the bake inside and stay live).
      if (now - lastPreviewBakeMs >= gridConfigRef.current.gridUpdateIntervalMs) {
        if (bakeAdjustedPreviewTexture()) {
          lastPreviewBakeMs = now;
        }
      }
    } else {
      restoreOriginalSpriteTexture();
      syncVisual();
    }

    const revealConfig = revealConfigRef.current;
    const revealEnabled = revealConfig.enabled;
    const revealPlayback = revealPlaybackRef.current;
    if (revealPlayback.replayKey !== lastRevealReplayKey) {
      lastRevealReplayKey = revealPlayback.replayKey;
      pendingFullResample = true;
      gridState = {};
    }
    const revealProgress = revealEnabled
      ? Math.min(
          1,
          Math.max(
            0,
            (now - revealPlayback.startedAtMs) / Math.max(1, resolvePlaygroundRevealDurationMs(revealConfig)),
          ),
        )
      : 1;
    revealStateRef.current = { progress: revealProgress };

    const colors = stripeColorsRef.current;
    const colorsKey = JSON.stringify({
      colors,
      preferP3: preferP3Ref.current,
      gamma: textureGammaRef.current,
      textureAdjustments: textureAdjustmentsRef.current,
      sourceTransform: sourceTransformRef.current,
      revealConfig,
      revealReplayKey: revealPlayback.replayKey,
      luminanceSettings: textureLuminanceSettingsRef.current,
    });
    const colorsChanged = colorsKey !== lastColorsKey;
    const revealActive = revealEnabled && revealProgress < 1;
    const trailSamplingEnabled = cursorTrailConfig.enabled;
    const clickWaveSamplingEnabled = clickWaveConfig.enabled && !revealActive;
    const sourceSampleDirty = shouldSample() || revealActive;

    if (colorsChanged) {
      const effectiveColors = {
        stripes: [
          ...resolveStripesForLuminanceMode(
            colors,
            normalizeTextureLuminanceMode(textureLuminanceSettingsRef.current.mode),
          ),
        ],
      };
      stripeFilter.syncColors(effectiveColors, preferP3Ref.current);
      trailStripeLut = buildStripeIndexLut(effectiveColors.stripes);
      lastColorsKey = colorsKey;
      pendingFullResample = true;
      pendingColorsResample = true;
      workerRequestEpoch += 1;
    }

    const gridConfig = gridConfigRef.current;
    const effectiveCell = effectivePlaygroundCellSize(gridConfig);

    const fullResampleReady = now - lastFullResampleMs >= PLAYGROUND_FULL_RESAMPLE_THROTTLE_MS;

    const gridUpdateDue = now - lastGridUpdateMs >= gridConfig.gridUpdateIntervalMs;
    const sampleDecision = resolveGridSampleDecision({
      hasBuiltGrid,
      pendingFullResample,
      fullResampleReady,
      sourceSampleDirty,
      gridUpdateDue,
    });
    const workerStatsBeforeSample = gridBuildQueue?.getStats() ?? null;
    const canSkipSamplingForWorkerInFlight =
      !revealEnabled &&
      !(flamesState && flamesConfig.enabled) &&
      sampleDecision.needsSourceFrame &&
      !!workerStatsBeforeSample?.inFlight &&
      !workerStatsBeforeSample.queued &&
      !queuedGridResult;

    let frame: ImageData | null = null;
    let gridFrame: ImageData | null = null;
    if (sampleDecision.needsSourceFrame && !canSkipSamplingForWorkerInFlight) {
      const sampleTimer = tickTimer ? createPlaygroundPerfTimer() : null;
      gridFrame = sampleGridFrame?.(blockGridTexture.cols, blockGridTexture.rows) ?? null;
      if (!gridFrame) {
        frame = sampleFrame();
      }
      if (sampleTimer) {
        sampleFrameMs += sampleTimer.elapsedMs();
      }
      if (frame || gridFrame) {
        onSampled?.();
      }
    }

    const buildFrame = gridFrame ?? frame;
    const shouldRebuildGrid = buildFrame && sampleDecision.shouldRebuildGrid;

    if (shouldRebuildGrid && buildFrame) {
      pendingFullResample = false;
      lastGridUpdateMs = now;
      lastFullResampleMs = now;
      if (pendingColorsResample) {
        gridState = {};
        lastGrid = null;
        gridPreprocessCache = null;
        workerRequestEpoch += 1;
        pendingColorsResample = false;
      }

      let luminanceSettings = textureLuminanceSettingsRef.current;
      if (frame) {
        const autoDetect = maybeAutoDetectColorsBackground(
          frame,
          display,
          luminanceSettings,
          colorsBackgroundAutoDetected,
        );
        colorsBackgroundAutoDetected = autoDetect.detected;
        if (autoDetect.changed) {
          luminanceSettings = autoDetect.settings;
          textureLuminanceSettingsRef.current = luminanceSettings;
          sourceTextureFilter.syncLuminanceSettings(luminanceSettings);
          onTextureLuminanceSettingsDetected?.(luminanceSettings);
        }
      }

      // Cell-res frames map one pixel to one grid cell, so the build runs in frame space.
      const buildWidth = gridFrame ? gridFrame.width : display.width;
      const buildHeight = gridFrame ? gridFrame.height : display.height;
      const buildCellWidth = gridFrame ? 1 : effectiveCell.width;
      const buildCellHeight = gridFrame ? 1 : effectiveCell.height;

      let dirtyRegion: GridCellRegion | null = null;
      if (
        frame &&
        !pendingFullResample &&
        lastLumaGrid &&
        lastGrid &&
        gridPreprocessCache &&
        dirtyFlamesBounds &&
        dirtyFlamesBounds.dirtyMaxX >= 0
      ) {
        const candidate = pixelBoundsToCellRegion(
          dirtyFlamesBounds,
          effectiveCell.width,
          effectiveCell.height,
          display.width,
          display.height,
          1,
        );
        if (candidate) {
          const candidateCells = regionCellCount(candidate);
          const totalCells = blockGridTexture.cols * blockGridTexture.rows;
          if (candidateCells > 0 && candidateCells < totalCells * 0.8) {
            dirtyRegion = candidate;
          }
        }
      }

      // Live builds never merge flames (the stripe filter composites them on the GPU; only the
      // export capture bakes them into the grid), so cell-res frames can always go to the worker.
      // Full-res frames keep the flames exclusion for the display-space dirty-region machinery.
      const asyncWorkerEligible =
        Boolean(gridBuildQueue) && !dirtyRegion && (gridFrame !== null || !(flamesState && flamesConfig.enabled));

      if (asyncWorkerEligible && gridBuildQueue) {
        const epochAtSubmit = workerRequestEpoch;
        const submitResult = gridBuildQueue.submitLatest(
          {
            frame: buildFrame,
            displayWidth: buildWidth,
            displayHeight: buildHeight,
            colors,
            gamma: textureGammaRef.current,
            state: gridState,
            options: {
              cellWidth: buildCellWidth,
              cellHeight: buildCellHeight,
              textureAdjustments: {
                ...textureAdjustmentsRef.current,
                gamma: textureGammaRef.current,
              },
              luminanceSettings,
              reveal: revealEnabled
                ? {
                    config: revealConfig,
                    progress: revealProgress,
                    replayKey: revealPlayback.replayKey,
                  }
                : undefined,
            },
          },
          {
            onResult: (result) => {
              if (epochAtSubmit !== workerRequestEpoch) {
                return;
              }
              queuedGridResult = result;
            },
            onError: (error) => {
              // Worker failures must stay visible: a silent failure freezes the stripe grid
              // and forces full sampling every tick (this exact bug shipped once).
              console.warn("[playground] grid build worker error:", error);
            },
          },
        );
        if (!submitResult.accepted) {
          workerRequestEpoch += 1;
        }
      }

      if (!asyncWorkerEligible || !gridBuildQueue) {
        const buildTimer = tickTimer ? createPlaygroundPerfTimer() : null;
        const built = buildPlaygroundBlockGrid(
          buildFrame,
          buildWidth,
          buildHeight,
          colors,
          gridState,
          textureGammaRef.current,
          {
            cellWidth: buildCellWidth,
            cellHeight: buildCellHeight,
            textureAdjustments: {
              ...textureAdjustmentsRef.current,
              gamma: textureGammaRef.current,
            },
            luminanceSettings,
            reveal: revealEnabled
              ? {
                  config: revealConfig,
                  progress: revealProgress,
                  replayKey: revealPlayback.replayKey,
                }
              : undefined,
            dirtyRegion: dirtyRegion ?? undefined,
            previousLumaGrid: dirtyRegion ? (lastLumaGrid ?? undefined) : undefined,
            previousGrid: dirtyRegion ? (lastGrid ?? undefined) : undefined,
            preprocessCache: dirtyRegion ? (gridPreprocessCache ?? undefined) : undefined,
            pixelDirtyBounds: dirtyRegion ? dirtyFlamesBounds : undefined,
          },
        );
        if (buildTimer) {
          buildGridMs += buildTimer.elapsedMs();
        }

        const textureTimer = tickTimer ? createPlaygroundPerfTimer() : null;
        applyBuiltGrid(
          built.grid,
          built.state,
          built.lumaGrid,
          // Cell-res preprocess caches live in frame space and must never seed a display-space
          // partial rebuild (flames), so drop them.
          gridFrame ? null : built.preprocessCache,
          built.partial,
          built.partialRegion,
          useCellColors,
        );
        if (textureTimer) {
          blockTextureMs += textureTimer.elapsedMs();
        }
      }

      const sparkleTimeSec = performance.now() / 1000;
      letterLayer.applySparkle(sparkleTimeSec, sparkleOptionsRef.current);

      if (exportStateRef) {
        exportStateRef.current = {
          grid: hasBuiltGrid ? lastGrid : null,
          colors,
          displayWidth: display.width,
          displayHeight: display.height,
        };
      }
    } else if (exportStateRef && gridState.stableIndices) {
      exportStateRef.current = {
        grid: {
          cols: blockGridTexture.cols,
          rows: blockGridTexture.rows,
          indices: gridState.stableIndices,
        },
        colors,
        displayWidth: display.width,
        displayHeight: display.height,
      };
    }

    const trailTimer = tickTimer ? createPlaygroundPerfTimer() : null;
    const pointerMapChanged =
      (trailSamplingEnabled && trail.changed) || (clickWaveSamplingEnabled && clickWave.changed);
    if (pointerMapChanged && hasBuiltGrid) {
      trailMap = resetCursorTrailCellMap(trailMap, blockGridTexture.cols, blockGridTexture.rows);
      if (trailSamplingEnabled) {
        accumulateCursorTrailCellMap(
          trailMap,
          trail.samples,
          cursorTrailConfig,
          display.width,
          display.height,
          textureLuminanceSettingsRef.current,
          lastLumaGrid?.colors,
        );
      }
      if (clickWaveSamplingEnabled) {
        accumulateClickWaveCellMap(
          trailMap,
          clickWave.samples,
          clickWaveConfig,
          display.width,
          display.height,
          textureLuminanceSettingsRef.current,
          lastLumaGrid?.colors,
        );
      }
      const pushCap = Math.max(
        trailSamplingEnabled
          ? Math.min(
              CURSOR_TRAIL_MAX_PUSH_CELLS,
              resolveCursorTrailPushScaleCells(cursorTrailConfig.pushStrengthPx, display.width, blockGridTexture.cols),
            )
          : 0,
        clickWaveSamplingEnabled
          ? Math.min(
              CLICK_WAVE_MAX_PUSH_CELLS,
              resolveCursorTrailPushScaleCells(clickWaveConfig.pushStrengthPx, display.width, blockGridTexture.cols),
            )
          : 0,
      );
      finalizeCursorTrailCellMap(trailMap, pushCap);
      cursorTrailOverlay.sync(trailMap);
    }
    const pointerActive =
      (trailSamplingEnabled || clickWaveSamplingEnabled) && hasBuiltGrid && trailMap?.nonEmpty === true;
    if (pointerActive && trailMap) {
      const pushActive = cursorTrailConfig.pushStrengthPx > 0 || clickWaveConfig.pushStrengthPx > 0;
      stripeFilter.syncCursorTrail(
        cursorTrailOverlay.texture,
        pushActive ? cursorTrailOverlay.pushTexture : null,
        trailMap.pushRange,
      );
    } else {
      stripeFilter.syncCursorTrail(null, null, 0);
    }

    if (pointerActive && trailMap && gridState.stableIndices && lastLumaGrid?.luma && trailStripeLut) {
      // Letters react to the trail: mirror the shader's per-cell band math on the CPU grid.
      const cols = blockGridTexture.cols;
      const rows = blockGridTexture.rows;
      const base = gridState.stableIndices;
      const lumaBytes = lastLumaGrid.luma;
      const lut = trailStripeLut;
      const inverted = overlayInvertsStripeBucketing(textureLuminanceSettingsRef.current.mode);
      if (!trailLetterIndices || trailLetterIndices.length !== base.length) {
        trailLetterIndices = new Uint8Array(base.length);
      }
      const adjusted = trailLetterIndices;
      for (let i = 0; i < base.length; i++) {
        const whiteAlpha = trailMap.whiteAlpha[i] ?? 0;
        const tear = trailMap.tear[i] ?? 0;
        if (whiteAlpha <= 0.002 && tear <= 0.002) {
          adjusted[i] = base[i] ?? 0;
          continue;
        }
        let luma = (lumaBytes[i] ?? 0) / 255;
        luma = inverted ? luma + (1 - luma) * tear : luma * (1 - tear);
        // Same content gate as the shader: brighten only lifts cells that hold content.
        const presence = inverted ? 1 - luma : luma;
        const presenceT = Math.min(1, Math.max(0, presence / 0.25));
        const lift = whiteAlpha * presenceT * presenceT * (3 - 2 * presenceT);
        luma = applyCursorTrailCell(luma, lift, inverted);
        const trailBand = lut[Math.min(255, Math.floor(luma * 256))] ?? 0;
        adjusted[i] = !inverted && tear <= 0.002 ? Math.max(base[i] ?? 0, trailBand) : trailBand;
      }
      letterLayer.sync({
        cols,
        rows,
        indices: adjusted,
        colors: lastLumaGrid.colors,
        colorCoverage: lastLumaGrid.colorCoverage,
        luma: lastLumaGrid.luma,
      });
      lastTrailNonEmpty = true;
    } else if (lastTrailNonEmpty) {
      lastTrailNonEmpty = false;
      if (gridState.stableIndices && hasBuiltGrid) {
        letterLayer.sync({
          cols: blockGridTexture.cols,
          rows: blockGridTexture.rows,
          indices: gridState.stableIndices,
          colors: lastLumaGrid?.colors,
          colorCoverage: lastLumaGrid?.colorCoverage,
          luma: lastLumaGrid?.luma,
        });
      }
    }
    if (trailTimer) {
      pointerCompositeMs += trailTimer.elapsedMs();
    }

    const sparkleTimeSec = performance.now() / 1000;
    const sparkleOptions = sparkleOptionsRef.current;
    const screenScale = app.renderer.resolution;
    if (screenScale !== lastScreenScale) {
      stripeFilter.syncScreenScale(screenScale);
      lastScreenScale = screenScale;
    }
    stripeFilter.syncSparkle(sparkleOptions, sparkleTimeSec);
    stripeFilter.syncWidthShuffle(widthShuffleOptionsRef.current, sparkleTimeSec);
    letterLayer.applySparkle(sparkleTimeSec, sparkleOptions);

    if (hasBuiltGrid) {
      letterLayer.tickLetterShuffle(performance.now());
    }

    const renderTimer = tickTimer ? createPlaygroundPerfTimer() : null;
    app.render();
    if (tickTimer) {
      const workerStats = gridBuildQueue?.getStats() ?? null;
      recordPlaygroundPerfSample({
        sampleFrameMs,
        pointerCompositeMs,
        buildGridMs,
        blockTextureMs,
        renderMs: renderTimer?.elapsedMs() ?? 0,
        tickTotalMs: tickTimer.elapsedMs(),
        partialGrid: false,
        workerGridInFlight: workerStats?.inFlight ?? false,
        workerGridApplied,
        workerGridQueueDepth: workerStats?.depth ?? 0,
        workerGridCoalesced: workerStats?.coalesced ?? 0,
        workerGridDroppedQueued: workerStats?.droppedQueued ?? 0,
        workerGridLatencyMs: workerStats?.lastLatencyMs ?? undefined,
      });
    }
  };

  return { tick, dispose };
}

export function createTextureSceneTicker(
  source: PlaygroundTextureSource,
  display: PlaygroundDisplaySize,
  stripeColorsRef: RefObject<StripeColors>,
  preferP3Ref: RefObject<boolean>,
  duotoneEnabledRef: RefObject<boolean>,
  stripesEnabledRef: RefObject<boolean>,
  textureGammaRef: RefObject<number>,
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>,
  widthShuffleOptionsRef: RefObject<PlaygroundWidthShuffleOptions>,
  autoplayRef: RefObject<boolean>,
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
  exportDisplayGridRef?: RefObject<PlaygroundExportDisplayGridCapture | null>,
  exportGridCaptureRef?: RefObject<PlaygroundExportGridCapture | null>,
  gridConfigRef: RefObject<PlaygroundGridConfig> = DEFAULT_GRID_CONFIG_REF,
  textureAdjustmentsRef: RefObject<PlaygroundTextureAdjustments> = DEFAULT_TEXTURE_ADJUSTMENTS_REF,
  textureLuminanceSettingsRef: RefObject<TextureLuminanceSettings> = DEFAULT_TEXTURE_LUMINANCE_SETTINGS_REF,
  sourceTransformRef: RefObject<PlaygroundSourceTransform> = DEFAULT_SOURCE_TRANSFORM_REF,
  flamesStateRef: RefObject<PlaygroundFlamesState | null> = DEFAULT_FLAMES_STATE_REF,
  flamesConfigRef: RefObject<PlaygroundFlamesConfig> = DEFAULT_FLAMES_CONFIG_REF,
  revealConfigRef: RefObject<PlaygroundRevealConfig> = DEFAULT_REVEAL_CONFIG_REF,
  revealStateRef: RefObject<PlaygroundRevealState> = DEFAULT_REVEAL_STATE_REF,
  revealPlaybackRef: RefObject<PlaygroundRevealPlayback> = DEFAULT_REVEAL_PLAYBACK_REF,
  cursorTrailConfigRef: RefObject<PlaygroundCursorTrailConfig> = DEFAULT_CURSOR_TRAIL_CONFIG_REF,
  clickWaveConfigRef: RefObject<PlaygroundClickWaveConfig> = DEFAULT_CLICK_WAVE_CONFIG_REF,
  onTextureLuminanceSettingsDetected?: (settings: TextureLuminanceSettings) => void,
  shaderTimeRef?: RefObject<number>,
  shaderPlayingRef?: RefObject<boolean>,
  shaderSourceRef?: RefObject<string>,
  audioInputRef?: RefObject<PlaygroundAudioInput | null>,
): Ticker {
  if (source.kind === "shader") {
    return createShaderSceneTicker(
      source.renderer,
      display,
      stripeColorsRef,
      preferP3Ref,
      duotoneEnabledRef,
      stripesEnabledRef,
      textureGammaRef,
      sparkleOptionsRef,
      widthShuffleOptionsRef,
      autoplayRef,
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
      exportStateRef,
      exportDisplayGridRef,
      exportGridCaptureRef,
      onTextureLuminanceSettingsDetected,
      shaderTimeRef,
      shaderPlayingRef,
      shaderSourceRef,
      audioInputRef,
    );
  }
  if (source.kind === "image") {
    return createImageSceneTicker(
      source.element,
      display,
      stripeColorsRef,
      preferP3Ref,
      duotoneEnabledRef,
      stripesEnabledRef,
      textureGammaRef,
      sparkleOptionsRef,
      widthShuffleOptionsRef,
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
      exportStateRef,
      exportDisplayGridRef,
      exportGridCaptureRef,
      onTextureLuminanceSettingsDetected,
    );
  }
  return createVideoSceneTickerInternal(
    source.element,
    display,
    stripeColorsRef,
    preferP3Ref,
    duotoneEnabledRef,
    stripesEnabledRef,
    textureGammaRef,
    sparkleOptionsRef,
    widthShuffleOptionsRef,
    autoplayRef,
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
    exportStateRef,
    exportDisplayGridRef,
    exportGridCaptureRef,
    onTextureLuminanceSettingsDetected,
  );
}

const DEFAULT_SHADER_TIME_REF: RefObject<number> = { current: 0 };
const DEFAULT_SHADER_PLAYING_REF: RefObject<boolean> = { current: true };

function createShaderSceneTicker(
  renderer: PlaygroundShaderRenderer,
  display: PlaygroundDisplaySize,
  stripeColorsRef: RefObject<StripeColors>,
  preferP3Ref: RefObject<boolean>,
  duotoneEnabledRef: RefObject<boolean>,
  stripesEnabledRef: RefObject<boolean>,
  textureGammaRef: RefObject<number>,
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>,
  widthShuffleOptionsRef: RefObject<PlaygroundWidthShuffleOptions>,
  autoplayRef: RefObject<boolean>,
  gridConfigRef: RefObject<PlaygroundGridConfig>,
  textureAdjustmentsRef: RefObject<PlaygroundTextureAdjustments>,
  textureLuminanceSettingsRef: RefObject<TextureLuminanceSettings>,
  sourceTransformRef: RefObject<PlaygroundSourceTransform>,
  flamesStateRef: RefObject<PlaygroundFlamesState | null>,
  flamesConfigRef: RefObject<PlaygroundFlamesConfig>,
  revealConfigRef: RefObject<PlaygroundRevealConfig>,
  revealStateRef: RefObject<PlaygroundRevealState>,
  revealPlaybackRef: RefObject<PlaygroundRevealPlayback>,
  cursorTrailConfigRef: RefObject<PlaygroundCursorTrailConfig>,
  clickWaveConfigRef: RefObject<PlaygroundClickWaveConfig>,
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
  exportDisplayGridRef?: RefObject<PlaygroundExportDisplayGridCapture | null>,
  exportGridCaptureRef?: RefObject<PlaygroundExportGridCapture | null>,
  onTextureLuminanceSettingsDetected?: (settings: TextureLuminanceSettings) => void,
  shaderTimeRef: RefObject<number> = DEFAULT_SHADER_TIME_REF,
  shaderPlayingRef: RefObject<boolean> = DEFAULT_SHADER_PLAYING_REF,
  shaderSourceRef?: RefObject<string>,
  audioInputRef?: RefObject<PlaygroundAudioInput | null>,
): Ticker {
  return ({ app, cleanup }) => {
    const grid = gridConfigRef.current;
    const effectiveCell = effectivePlaygroundCellSize(grid);
    const renderSize = resolvePlaygroundShaderRenderSize(display.width, display.height);
    renderer.resize(renderSize.width, renderSize.height);

    const texture = Texture.from(renderer.canvas);
    // Exports temporarily resize the renderer to full display resolution; keep the Pixi
    // texture source dimensions in sync with the canvas so live frames stay correctly mapped.
    const syncTextureSourceSize = () => {
      if (
        texture.source.pixelWidth !== renderer.canvas.width ||
        texture.source.pixelHeight !== renderer.canvas.height
      ) {
        texture.source.resize(renderer.canvas.width, renderer.canvas.height);
      }
    };
    texture.source.alphaMode = "no-premultiply-alpha";
    texture.source.scaleMode = "linear";
    const sprite = new Sprite(texture);
    const shaderSource = { kind: "shader" as const, renderer };
    const syncShaderLayout = () => {
      renderer.setViewTransform(sourceTransformRef.current);
      syncSpriteToDisplay(sprite, shaderSource, display, renderer.resolveSpriteSourceTransform());
    };
    syncShaderLayout();

    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleCtx) {
      throw new Error("2D canvas context unavailable for texture sampling.");
    }
    const gridSampleCanvas = document.createElement("canvas");
    const gridSampleCtx = gridSampleCanvas.getContext("2d", { willReadFrequently: true });
    // True when this tick already rendered the shader canvas (visible-texture modes). When false,
    // samplers render on demand via ensureLiveFrame before reading pixels.
    let renderedThisTick = true;
    // Renders the shader at the capped live size if this tick skipped it. The canvas must keep a
    // stable size: Pixi wraps it in a Texture, and resizing it behind Pixi's back breaks the
    // sprite (and with it the stripe filter pass).
    const ensureLiveFrame = () => {
      if (renderedThisTick) {
        return;
      }
      renderer.resize(renderSize.width, renderSize.height);
      renderer.render(shaderTimeRef.current);
      // No-op unless an export resized the canvas while live renders were skipped.
      syncTextureSourceSize();
      renderedThisTick = true;
    };

    const blockGridTexture = new BlockGridTexture(
      display.width,
      display.height,
      effectiveCell.width,
      effectiveCell.height,
    );
    const stripeFilter = createStripeDuotoneFilter(
      display.width,
      display.height,
      blockGridTexture.texture,
      blockGridTexture.cols,
      blockGridTexture.rows,
      stripeColorsRef.current,
      preferP3Ref.current,
      grid,
    );
    const sourceTextureFilter = createSourceTextureFilter({
      ...textureAdjustmentsRef.current,
      gamma: textureGammaRef.current,
    });
    const textureFilterMode = resolveTextureFilterMode(duotoneEnabledRef.current, stripesEnabledRef.current);
    syncStripeSpriteFilters(sprite, textureFilterMode, textureLuminanceSettingsRef.current.mode, stripeFilter);
    app.stage.addChild(sprite);
    const { letterLayer, atlas } = createPlaygroundLetterLayer(app, textureFilterMode === "stripes", grid);
    const cursorTrailState = createCursorTrailState();
    const clickWaveState = createClickWaveState();
    const detachPlaygroundPointerEvents = attachPlaygroundPointerEvents(
      app.canvas as HTMLCanvasElement,
      display,
      cursorTrailState,
      clickWaveState,
      clickWaveConfigRef,
    );

    let lastCompiledSource = "";
    let lastSampledTime = -1;
    let lastSampledTransformKey = "";
    let lastShaderTickMs = performance.now();
    let audioTextureUploaded = false;

    // Pushes the latest microphone frame into iChannel0, or clears it once when capture stops.
    const syncAudioTexture = () => {
      const audioInput = audioInputRef?.current ?? null;
      if (audioInput?.active) {
        const data = audioInput.update();
        if (data) {
          renderer.setAudioTexture(data, audioInput.textureWidth, audioInput.textureHeight);
          audioTextureUploaded = true;
          return;
        }
      }
      if (audioTextureUploaded) {
        renderer.setAudioTexture(null, 0, 0);
        audioTextureUploaded = false;
      }
    };

    const currentSampleTransformKey = (): string => {
      const transform = sourceTransformRef.current;
      return `${transform.fit}:${transform.zoom}:${transform.panX}:${transform.panY}`;
    };
    shaderPlayingRef.current = autoplayRef.current;

    const syncShaderTime = (nowMs: number) => {
      if (shaderPlayingRef.current) {
        shaderTimeRef.current += (nowMs - lastShaderTickMs) / 1000;
      }
      lastShaderTickMs = nowMs;
    };

    const maybeRecompileShader = () => {
      const nextSource = shaderSourceRef?.current;
      if (!nextSource || nextSource === lastCompiledSource) {
        return;
      }
      const compile = renderer.setSource(nextSource);
      if (compile.ok) {
        lastCompiledSource = nextSource;
      }
    };
    maybeRecompileShader();

    const { tick: renderTick, dispose } = runDuotoneTick({
      app,
      sprite,
      stripeFilter,
      sourceTextureFilter,
      letterLayer,
      duotoneEnabledRef,
      stripesEnabledRef,
      sparkleOptionsRef,
      widthShuffleOptionsRef,
      flamesStateRef,
      flamesConfigRef,
      revealConfigRef,
      revealStateRef,
      revealPlaybackRef,
      stripeColorsRef,
      preferP3Ref,
      textureGammaRef,
      textureAdjustmentsRef,
      textureLuminanceSettingsRef,
      sourceTransformRef,
      gridConfigRef,
      display,
      blockGridTexture,
      atlas,
      cursorTrailConfigRef,
      clickWaveConfigRef,
      cursorTrailState,
      clickWaveState,
      exportStateRef,
      exportDisplayGridRef,
      exportGridCaptureRef,
      prepareExportSample: () => {
        maybeRecompileShader();
        syncShaderTime(performance.now());
        syncAudioTexture();
        renderer.setViewTransform(sourceTransformRef.current);
        // Exports sample at full display resolution; the live tick restores the capped size.
        renderer.resize(display.width, display.height);
        renderer.render(shaderTimeRef.current);
        syncTextureSourceSize();
        texture.source.update();
      },
      syncVisual: syncShaderLayout,
      shouldSample: () =>
        shaderTimeRef.current !== lastSampledTime || currentSampleTransformKey() !== lastSampledTransformKey,
      sampleFrame: () => {
        ensureLiveFrame();
        return sampleShaderPlaygroundFrame(
          renderer,
          display.width,
          display.height,
          sampleCanvas,
          sampleCtx,
          sourceTransformRef.current,
          shaderTimeRef.current,
          { renderBeforeSample: false },
        );
      },
      sampleGridFrame: (cols, rows) => {
        if (
          !gridSampleCtx ||
          !canUseCellResGridSampling({
            revealEnabled: revealConfigRef.current.enabled,
            luminanceMode: normalizeTextureLuminanceMode(textureLuminanceSettingsRef.current.mode),
          })
        ) {
          return null;
        }
        ensureLiveFrame();
        return sampleShaderPlaygroundFrame(
          renderer,
          cols,
          rows,
          gridSampleCanvas,
          gridSampleCtx,
          sourceTransformRef.current,
          shaderTimeRef.current,
          { renderBeforeSample: false },
        );
      },
      // Shader frames force alpha 255 (see sampleShaderPlaygroundFrame), enabling the
      // identity-adjustments preview bake skip.
      previewSourceOpaque: true,
      onSampled: () => {
        lastSampledTime = shaderTimeRef.current;
        lastSampledTransformKey = currentSampleTransformKey();
      },
      onTextureLuminanceSettingsDetected,
    });

    const tick = () => {
      shaderPlayingRef.current = autoplayRef.current;
      maybeRecompileShader();
      syncShaderTime(performance.now());
      syncAudioTexture();
      renderer.setViewTransform(sourceTransformRef.current);
      renderedThisTick = isShaderTextureLiveRenderNeeded({
        duotoneEnabled: duotoneEnabledRef.current,
        stripesEnabled: stripesEnabledRef.current,
        luminanceMode: normalizeTextureLuminanceMode(textureLuminanceSettingsRef.current.mode),
      });
      if (renderedThisTick) {
        // No-op normally; restores the capped live size after a full-resolution export render.
        renderer.resize(renderSize.width, renderSize.height);
        renderer.render(shaderTimeRef.current);
        syncTextureSourceSize();
        texture.source.update();
      }
      syncShaderLayout();
      renderTick();
    };

    app.ticker.add(tick);

    cleanup(() => {
      if (app.ticker) {
        app.ticker.remove(tick);
      }
      // Drop any frozen audio frame so a later audio-free shader does not inherit stale iChannel0.
      renderer.setAudioTexture(null, 0, 0);
      detachPlaygroundPointerEvents();
      dispose();
      sprite.destroy({ children: true });
      texture.destroy(true);
    });
  };
}

function createImageSceneTicker(
  image: HTMLImageElement,
  display: PlaygroundDisplaySize,
  stripeColorsRef: RefObject<StripeColors>,
  preferP3Ref: RefObject<boolean>,
  duotoneEnabledRef: RefObject<boolean>,
  stripesEnabledRef: RefObject<boolean>,
  textureGammaRef: RefObject<number>,
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>,
  widthShuffleOptionsRef: RefObject<PlaygroundWidthShuffleOptions>,
  gridConfigRef: RefObject<PlaygroundGridConfig>,
  textureAdjustmentsRef: RefObject<PlaygroundTextureAdjustments>,
  textureLuminanceSettingsRef: RefObject<TextureLuminanceSettings>,
  sourceTransformRef: RefObject<PlaygroundSourceTransform>,
  flamesStateRef: RefObject<PlaygroundFlamesState | null>,
  flamesConfigRef: RefObject<PlaygroundFlamesConfig>,
  revealConfigRef: RefObject<PlaygroundRevealConfig>,
  revealStateRef: RefObject<PlaygroundRevealState>,
  revealPlaybackRef: RefObject<PlaygroundRevealPlayback>,
  cursorTrailConfigRef: RefObject<PlaygroundCursorTrailConfig>,
  clickWaveConfigRef: RefObject<PlaygroundClickWaveConfig>,
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
  exportDisplayGridRef?: RefObject<PlaygroundExportDisplayGridCapture | null>,
  exportGridCaptureRef?: RefObject<PlaygroundExportGridCapture | null>,
  onTextureLuminanceSettingsDetected?: (settings: TextureLuminanceSettings) => void,
): Ticker {
  return ({ app, cleanup }) => {
    const grid = gridConfigRef.current;
    const effectiveCell = effectivePlaygroundCellSize(grid);
    const texture = Texture.from(image);
    const sprite = new Sprite(texture);
    syncSpriteToDisplay(sprite, { kind: "image", element: image }, display, sourceTransformRef.current);

    const onLayoutChange = () =>
      syncSpriteToDisplay(sprite, { kind: "image", element: image }, display, sourceTransformRef.current);
    image.addEventListener("load", onLayoutChange);

    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleCtx) {
      throw new Error("2D canvas context unavailable for texture sampling.");
    }

    const blockGridTexture = new BlockGridTexture(
      display.width,
      display.height,
      effectiveCell.width,
      effectiveCell.height,
    );
    const stripeFilter = createStripeDuotoneFilter(
      display.width,
      display.height,
      blockGridTexture.texture,
      blockGridTexture.cols,
      blockGridTexture.rows,
      stripeColorsRef.current,
      preferP3Ref.current,
      grid,
    );
    const sourceTextureFilter = createSourceTextureFilter({
      ...textureAdjustmentsRef.current,
      gamma: textureGammaRef.current,
    });
    const textureFilterMode = resolveTextureFilterMode(duotoneEnabledRef.current, stripesEnabledRef.current);
    syncStripeSpriteFilters(sprite, textureFilterMode, textureLuminanceSettingsRef.current.mode, stripeFilter);
    app.stage.addChild(sprite);
    const { letterLayer, atlas } = createPlaygroundLetterLayer(app, textureFilterMode === "stripes", grid);
    const cursorTrailState = createCursorTrailState();
    const clickWaveState = createClickWaveState();
    const detachPlaygroundPointerEvents = attachPlaygroundPointerEvents(
      app.canvas as HTMLCanvasElement,
      display,
      cursorTrailState,
      clickWaveState,
      clickWaveConfigRef,
    );

    const { tick: renderTick, dispose } = runDuotoneTick({
      app,
      sprite,
      stripeFilter,
      sourceTextureFilter,
      letterLayer,
      duotoneEnabledRef,
      stripesEnabledRef,
      sparkleOptionsRef,
      widthShuffleOptionsRef,
      flamesStateRef,
      flamesConfigRef,
      revealConfigRef,
      revealStateRef,
      revealPlaybackRef,
      stripeColorsRef,
      preferP3Ref,
      textureGammaRef,
      textureAdjustmentsRef,
      textureLuminanceSettingsRef,
      sourceTransformRef,
      gridConfigRef,
      display,
      blockGridTexture,
      atlas,
      cursorTrailConfigRef,
      clickWaveConfigRef,
      cursorTrailState,
      clickWaveState,
      exportStateRef,
      exportDisplayGridRef,
      exportGridCaptureRef,
      syncVisual: () =>
        syncSpriteToDisplay(sprite, { kind: "image", element: image }, display, sourceTransformRef.current),
      shouldSample: () => false,
      sampleFrame: () =>
        sampleTextureFrame(image, display.width, display.height, sampleCanvas, sampleCtx, sourceTransformRef.current),
      onTextureLuminanceSettingsDetected,
    });

    app.ticker.add(renderTick);

    cleanup(() => {
      if (app.ticker) {
        app.ticker.remove(renderTick);
      }
      image.removeEventListener("load", onLayoutChange);
      detachPlaygroundPointerEvents();
      dispose();
      sprite.destroy({ children: true });
      texture.destroy(true);
    });
  };
}

function createVideoSceneTickerInternal(
  video: HTMLVideoElement,
  display: PlaygroundDisplaySize,
  stripeColorsRef: RefObject<StripeColors>,
  preferP3Ref: RefObject<boolean>,
  duotoneEnabledRef: RefObject<boolean>,
  stripesEnabledRef: RefObject<boolean>,
  textureGammaRef: RefObject<number>,
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>,
  widthShuffleOptionsRef: RefObject<PlaygroundWidthShuffleOptions>,
  autoplayRef: RefObject<boolean>,
  gridConfigRef: RefObject<PlaygroundGridConfig>,
  textureAdjustmentsRef: RefObject<PlaygroundTextureAdjustments>,
  textureLuminanceSettingsRef: RefObject<TextureLuminanceSettings>,
  sourceTransformRef: RefObject<PlaygroundSourceTransform>,
  flamesStateRef: RefObject<PlaygroundFlamesState | null>,
  flamesConfigRef: RefObject<PlaygroundFlamesConfig>,
  revealConfigRef: RefObject<PlaygroundRevealConfig>,
  revealStateRef: RefObject<PlaygroundRevealState>,
  revealPlaybackRef: RefObject<PlaygroundRevealPlayback>,
  cursorTrailConfigRef: RefObject<PlaygroundCursorTrailConfig>,
  clickWaveConfigRef: RefObject<PlaygroundClickWaveConfig>,
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
  exportDisplayGridRef?: RefObject<PlaygroundExportDisplayGridCapture | null>,
  exportGridCaptureRef?: RefObject<PlaygroundExportGridCapture | null>,
  onTextureLuminanceSettingsDetected?: (settings: TextureLuminanceSettings) => void,
): Ticker {
  return ({ app, cleanup }) => {
    const grid = gridConfigRef.current;
    const effectiveCell = effectivePlaygroundCellSize(grid);
    const videoSource = new VideoSource({
      resource: video,
    });
    const texture = new Texture({ source: videoSource });
    const sprite = new Sprite(texture);
    syncSpriteToDisplay(sprite, { kind: "video", element: video }, display, sourceTransformRef.current);

    const onVideoLayoutChange = () =>
      syncSpriteToDisplay(sprite, { kind: "video", element: video }, display, sourceTransformRef.current);
    video.addEventListener("loadedmetadata", onVideoLayoutChange);
    videoSource.on("resize", onVideoLayoutChange);
    videoSource.on("update", onVideoLayoutChange);

    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleCtx) {
      throw new Error("2D canvas context unavailable for texture sampling.");
    }

    const blockGridTexture = new BlockGridTexture(
      display.width,
      display.height,
      effectiveCell.width,
      effectiveCell.height,
    );
    const stripeFilter = createStripeDuotoneFilter(
      display.width,
      display.height,
      blockGridTexture.texture,
      blockGridTexture.cols,
      blockGridTexture.rows,
      stripeColorsRef.current,
      preferP3Ref.current,
      grid,
    );
    const sourceTextureFilter = createSourceTextureFilter({
      ...textureAdjustmentsRef.current,
      gamma: textureGammaRef.current,
    });
    const textureFilterMode = resolveTextureFilterMode(duotoneEnabledRef.current, stripesEnabledRef.current);
    syncStripeSpriteFilters(sprite, textureFilterMode, textureLuminanceSettingsRef.current.mode, stripeFilter);
    app.stage.addChild(sprite);
    const { letterLayer, atlas } = createPlaygroundLetterLayer(app, textureFilterMode === "stripes", grid);
    const cursorTrailState = createCursorTrailState();
    const clickWaveState = createClickWaveState();
    const detachPlaygroundPointerEvents = attachPlaygroundPointerEvents(
      app.canvas as HTMLCanvasElement,
      display,
      cursorTrailState,
      clickWaveState,
      clickWaveConfigRef,
    );

    let lastSampledTime = -1;

    const { tick: renderTick, dispose } = runDuotoneTick({
      app,
      sprite,
      stripeFilter,
      sourceTextureFilter,
      letterLayer,
      duotoneEnabledRef,
      stripesEnabledRef,
      sparkleOptionsRef,
      widthShuffleOptionsRef,
      flamesStateRef,
      flamesConfigRef,
      revealConfigRef,
      revealStateRef,
      revealPlaybackRef,
      stripeColorsRef,
      preferP3Ref,
      textureGammaRef,
      textureAdjustmentsRef,
      textureLuminanceSettingsRef,
      sourceTransformRef,
      gridConfigRef,
      display,
      blockGridTexture,
      atlas,
      cursorTrailConfigRef,
      clickWaveConfigRef,
      cursorTrailState,
      clickWaveState,
      exportStateRef,
      exportDisplayGridRef,
      exportGridCaptureRef,
      syncVisual: () =>
        syncSpriteToDisplay(sprite, { kind: "video", element: video }, display, sourceTransformRef.current),
      shouldSample: () => video.currentTime !== lastSampledTime,
      sampleFrame: () =>
        sampleVideoFrame(video, display.width, display.height, sampleCanvas, sampleCtx, sourceTransformRef.current),
      onSampled: () => {
        lastSampledTime = video.currentTime;
      },
      onTextureLuminanceSettingsDetected,
    });

    app.ticker.add(renderTick);

    if (autoplayRef.current) {
      void video.play().catch(() => {
        // Autoplay may require a user gesture even when muted.
      });
    }

    cleanup(() => {
      if (app.ticker) {
        app.ticker.remove(renderTick);
      }
      video.removeEventListener("loadedmetadata", onVideoLayoutChange);
      videoSource.off("resize", onVideoLayoutChange);
      videoSource.off("update", onVideoLayoutChange);
      detachPlaygroundPointerEvents();
      dispose();
      sprite.destroy({ children: true });
      texture.destroy(true);
    });
  };
}

/** @deprecated Use {@link createTextureSceneTicker}. */
export function createVideoSceneTicker(
  video: HTMLVideoElement,
  display: PlaygroundDisplaySize,
  stripeColorsRef: RefObject<StripeColors>,
  preferP3Ref: RefObject<boolean>,
  duotoneEnabledRef: RefObject<boolean>,
  textureGammaRef: RefObject<number>,
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>,
  widthShuffleOptionsRef: RefObject<PlaygroundWidthShuffleOptions>,
  autoplayRef: RefObject<boolean>,
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
): Ticker {
  return createTextureSceneTicker(
    { kind: "video", element: video },
    display,
    stripeColorsRef,
    preferP3Ref,
    duotoneEnabledRef,
    DEFAULT_STRIPES_ENABLED_REF,
    textureGammaRef,
    sparkleOptionsRef,
    widthShuffleOptionsRef,
    autoplayRef,
    exportStateRef,
  );
}

/** @deprecated Use {@link createTextureSceneTicker}. */
export const createVideoShaderSceneTicker = createVideoSceneTicker;
