import { Filter, Sprite, Texture, VideoSource } from "pixi.js";
import type { RefObject } from "react";
import type { Ticker } from "./pixiMount";
import { BlockGridTexture } from "./blockGridTexture";
import { resampleBlockGrid } from "./resampleBlockGrid";
import type { BlockGrid, LumaGrid } from "./computeBlockGrid";
import {
  buildPlaygroundBlockGrid,
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
import type { PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
import type { PlaygroundSparkleOptions } from "./playgroundSparkle";
import type { PlaygroundWidthShuffleOptions } from "./playgroundWidthShuffle";
import { createStripeLetterLayer, type StripeLetterLayer } from "./stripeLetterLayer";
import { effectivePlaygroundCellSize, type PlaygroundGridConfig } from "./playgroundGridConfig";
import { resolvePlaygroundDrawRects, type PlaygroundSourceTransform } from "./playgroundSourceTransform";
import { renderAdjustedPreviewPixels, type PlaygroundTextureAdjustments } from "./playgroundTextureAdjustments";
import { resolvePlaygroundRevealDurationMs, type PlaygroundRevealConfig } from "./playgroundRevealConfig";
import { resolveRevealOvershoot, waveRevealAmountAtCell, type PlaygroundRevealState } from "./playgroundReveal";
import {
  detectTextureBackgroundColor,
  overlayInvertsStripeBucketing,
  normalizeTextureLuminanceMode,
  type TextureLuminanceMode,
  type TextureLuminanceSettings,
} from "./colorWhiteness";
import { createSourceTextureFilter } from "./sourceTextureFilter";
import { normalizePlaygroundCursorTrailConfig, type PlaygroundCursorTrailConfig } from "./playgroundCursorTrailConfig";
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
import { buildStripeIndexLut, resolvePlaygroundPixiTint, resolveStripesForLuminanceMode } from "./stripeColors";
import { normalizePlaygroundClickWaveConfig, type PlaygroundClickWaveConfig } from "./playgroundClickWaveConfig";
import {
  createPlaygroundPerfTimer,
  isPlaygroundPerfProfilingEnabled,
  recordPlaygroundPerfSample,
} from "./playgroundPerfProfile";

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

/** Default state refs used by {@link createStripesShaderScene} when the caller omits them. */
const DEFAULT_FLAMES_STATE_REF: RefObject<PlaygroundFlamesState | null> = { current: null };
const DEFAULT_REVEAL_STATE_REF: RefObject<PlaygroundRevealState> = { current: { progress: 1 } };
export type PlaygroundDisplaySize = { width: number; height: number };

export type PlaygroundSceneExportState = {
  grid: BlockGrid | null;
  colors: StripeColors;
  displayWidth: number;
  displayHeight: number;
};

export type PlaygroundTextureSource =
  | { kind: "video"; element: HTMLVideoElement }
  | { kind: "image"; element: HTMLImageElement };

type TextureFilterMode = "off" | "preview" | "stripes";

export type PlaygroundRevealPlayback = {
  replayKey: number;
  startedAtMs: number;
};

/**
 * The full per-frame configuration the scene reads each tick. Every field maps 1:1 onto an
 * internal ref that {@link runDuotoneTick} already reads; {@link createStripesShaderScene} syncs
 * these onto its internal refs at the top of every tick (before the render logic reads them), so
 * the render path is byte-for-byte identical regardless of who owns the values.
 */
export type StripesSceneConfig = {
  stripeColors: StripeColors;
  preferP3: boolean;
  duotoneEnabled: boolean;
  stripesEnabled: boolean;
  textureGamma: number;
  sparkle: PlaygroundSparkleOptions;
  widthShuffle: PlaygroundWidthShuffleOptions;
  gridConfig: PlaygroundGridConfig;
  textureAdjustments: PlaygroundTextureAdjustments;
  textureLuminanceSettings: TextureLuminanceSettings;
  sourceTransform: PlaygroundSourceTransform;
  flamesConfig: PlaygroundFlamesConfig;
  revealConfig: PlaygroundRevealConfig;
  revealPlayback: PlaygroundRevealPlayback;
  cursorTrailConfig: PlaygroundCursorTrailConfig;
  clickWaveConfig: PlaygroundClickWaveConfig;
};

/**
 * Options for {@link createStripesShaderScene}. `getSource`/`getDisplaySize` are structural and are
 * captured once at setup (the studio remounts via `sceneKey` when either changes). `getConfig` is
 * read live at the top of every tick. The remaining state refs and the luminance-detect callback
 * map straight onto the internal refs/params {@link runDuotoneTick} already uses.
 */
export type StripesShaderSceneOptions = {
  getConfig: () => StripesSceneConfig;
  getSource: () => PlaygroundTextureSource;
  getDisplaySize: () => PlaygroundDisplaySize;
  autoplay?: boolean;
  flamesStateRef?: RefObject<PlaygroundFlamesState | null>;
  revealStateRef?: RefObject<PlaygroundRevealState>;
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>;
  onTextureLuminanceSettingsDetected?: (settings: TextureLuminanceSettings) => void;
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
  syncVisual: () => void;
  shouldSample: () => boolean;
  sampleFrame: () => ImageData | null;
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
    syncVisual,
    shouldSample,
    sampleFrame,
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
  let trailStripeLut: Uint8Array | null = null;
  let trailMap: CursorTrailCellMap | null = null;
  let trailLetterIndices: Uint8Array | null = null;
  let lastTrailNonEmpty = false;
  let lastEffWidth = initialCell.width;
  let lastEffHeight = initialCell.height;
  let lastLetterSize = gridConfigRef.current.letterSize;
  let lastLetterCharset = gridConfigRef.current.letterCharset;
  let lastLetterRatio = gridConfigRef.current.letterRatio;

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
          hasBuiltGrid = true;
        } else {
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
      hasBuiltGrid = false;
      pendingFullResample = true;
    }

    if (gridConfig.letterRatio !== lastLetterRatio) {
      letterLayer.setRatio(gridConfig.letterRatio);
      lastLetterRatio = gridConfig.letterRatio;
      pendingFullResample = true;
    }
  };

  const dispose = () => {
    restoreOriginalSpriteTexture();
    previewTexture.destroy(true);
    blockGridTexture.destroy();
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
    stripeFilter.syncTextureUnderlay(luminanceMode === "overlay");
    const flamesState = flamesStateRef.current;
    const flamesConfig = flamesConfigRef.current;
    if (flamesState && flamesConfig.enabled) {
      stepPlaygroundFlames(flamesState, flamesConfig, display, performance.now());
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
      stripeFilter.syncReveal(null, 1);
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
      // Baked preview is already display-sized (see preview mode); native-source scaling would shrink it.
      bakeAdjustedPreviewTexture();
    } else {
      restoreOriginalSpriteTexture();
      syncVisual();
    }

    const revealConfig = revealConfigRef.current;
    const revealEnabled = revealConfig.enabled;
    const revealPlayback = revealPlaybackRef.current;
    const revealProgressRaw = revealEnabled
      ? Math.max(0, (now - revealPlayback.startedAtMs) / Math.max(1, resolvePlaygroundRevealDurationMs(revealConfig)))
      : 1;
    const revealProgress = Math.min(1, revealProgressRaw);
    revealStateRef.current = { progress: revealProgress };
    const revealActive = revealEnabled && revealProgress < 1;
    // The mask stays bound past nominal progress 1 so trailing band climbs ease out on
    // their own schedule instead of snapping at the deadline (the old CPU smoothing kept
    // converging after the reveal ended the same way).
    const revealDurationMs = Math.max(1, resolvePlaygroundRevealDurationMs(revealConfig));
    const revealBandRamp = Math.min(0.4, Math.max(0.04, 330 / revealDurationMs));
    const revealOvershoot = resolveRevealOvershoot(revealConfig.wave, revealBandRamp);
    const revealAnimating = revealEnabled && revealProgressRaw < 1 + revealOvershoot;

    // The reveal is a GPU mask: the grid stays fully built and only uniforms animate.
    stripeFilter.syncReveal(revealAnimating ? revealConfig : null, revealProgressRaw);

    const colors = stripeColorsRef.current;
    const colorsKey = JSON.stringify({
      colors,
      preferP3: preferP3Ref.current,
      gamma: textureGammaRef.current,
      textureAdjustments: textureAdjustmentsRef.current,
      sourceTransform: sourceTransformRef.current,
      luminanceSettings: textureLuminanceSettingsRef.current,
    });
    const colorsChanged = colorsKey !== lastColorsKey;
    const trailSamplingEnabled = cursorTrailConfig.enabled;
    const clickWaveSamplingEnabled = clickWaveConfig.enabled && !revealActive;
    const sourceTimeChanged = shouldSample();
    const needsSourceFrame = sourceTimeChanged || colorsChanged || !hasBuiltGrid || pendingFullResample;

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
    }

    const gridConfig = gridConfigRef.current;
    const effectiveCell = effectivePlaygroundCellSize(gridConfig);

    const fullResampleReady = now - lastFullResampleMs >= PLAYGROUND_FULL_RESAMPLE_THROTTLE_MS;

    let frame: ImageData | null = null;
    if (needsSourceFrame) {
      const sampleTimer = tickTimer ? createPlaygroundPerfTimer() : null;
      frame = sampleFrame();
      if (sampleTimer) {
        sampleFrameMs += sampleTimer.elapsedMs();
      }
      if (frame) {
        onSampled?.();
      }
    }

    const shouldRebuildGrid =
      frame &&
      (!hasBuiltGrid ||
        (pendingFullResample && fullResampleReady) ||
        (sourceTimeChanged && !pendingFullResample && now - lastGridUpdateMs >= gridConfig.gridUpdateIntervalMs));

    if (shouldRebuildGrid && frame) {
      hasBuiltGrid = true;
      pendingFullResample = false;
      lastGridUpdateMs = now;
      lastFullResampleMs = now;
      if (pendingColorsResample) {
        gridState = {};
        pendingColorsResample = false;
      }

      let luminanceSettings = textureLuminanceSettingsRef.current;
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

      const buildTimer = tickTimer ? createPlaygroundPerfTimer() : null;
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
          luminanceSettings,
        },
      );
      if (buildTimer) {
        buildGridMs += buildTimer.elapsedMs();
      }
      gridState = built.state;
      lastLumaGrid = built.lumaGrid;

      const textureTimer = tickTimer ? createPlaygroundPerfTimer() : null;
      blockGridTexture.update(built.grid);
      if (textureTimer) {
        blockTextureMs += textureTimer.elapsedMs();
      }
      stripeFilter.updateBlockMap(blockGridTexture.texture);
      stripeFilter.updateCellColorMap(blockGridTexture.colorTexture);
      letterLayer.sync(built.grid);
      const sparkleTimeSec = performance.now() / 1000;
      letterLayer.applySparkle(sparkleTimeSec, sparkleOptionsRef.current);

      if (exportStateRef) {
        exportStateRef.current = {
          grid: built.grid,
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

    const lettersRevealActive = revealAnimating && hasBuiltGrid;
    if (
      ((pointerActive && trailMap) || lettersRevealActive) &&
      gridState.stableIndices &&
      lastLumaGrid?.luma &&
      trailStripeLut
    ) {
      // Letters mirror the shader's per-cell band math on the CPU grid (trail + reveal).
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
        const whiteAlpha = pointerActive && trailMap ? (trailMap.whiteAlpha[i] ?? 0) : 0;
        const tear = pointerActive && trailMap ? (trailMap.tear[i] ?? 0) : 0;
        let revealMask = 1;
        if (lettersRevealActive) {
          const col = i % cols;
          const row = (i - col) / cols;
          revealMask = waveRevealAmountAtCell(
            col,
            row,
            cols,
            rows,
            revealProgressRaw,
            revealConfig.wave,
            revealBandRamp,
          );
        }
        if (revealMask >= 1 && whiteAlpha <= 0.002 && tear <= 0.002) {
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
        let band = !inverted && tear <= 0.002 ? Math.max(base[i] ?? 0, trailBand) : trailBand;
        if (revealMask < 1) {
          // Band-space ramp across the wave's feathered front, mirroring the shader.
          band = Math.min(band, Math.floor(band * revealMask + 0.5));
        }
        adjusted[i] = band;
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
    stripeFilter.syncScreenScale(app.renderer.resolution);
    stripeFilter.syncSparkle(sparkleOptions, sparkleTimeSec);
    stripeFilter.syncWidthShuffle(widthShuffleOptionsRef.current, sparkleTimeSec);
    letterLayer.applySparkle(sparkleTimeSec, sparkleOptions);

    if (hasBuiltGrid) {
      letterLayer.tickLetterShuffle(performance.now());
    }

    const renderTimer = tickTimer ? createPlaygroundPerfTimer() : null;
    app.render();
    if (tickTimer) {
      recordPlaygroundPerfSample({
        sampleFrameMs,
        pointerCompositeMs,
        buildGridMs,
        blockTextureMs,
        renderMs: renderTimer?.elapsedMs() ?? 0,
        tickTotalMs: tickTimer.elapsedMs(),
        partialGrid: false,
      });
    }
  };

  return { tick, dispose };
}

/**
 * The getter-based scene factory. It owns an INTERNAL ref-set — the exact refs {@link runDuotoneTick}
 * already reads — sets up the image/video scene exactly as the legacy ticker did, and syncs the
 * internal refs from `options.getConfig()` at the TOP of each per-frame tick (before the render logic
 * reads them). Structural inputs (`getSource`/`getDisplaySize`) are captured once at setup; the
 * studio remounts via `sceneKey` when either changes. Render math, uniform syncs, pointer wiring,
 * sceneKey logic, and the reveal time-base are unchanged — only the SOURCE of the per-frame values
 * differs (a getter copied into internal refs vs. externally-owned refs).
 */
export function createStripesShaderScene(options: StripesShaderSceneOptions): Ticker {
  const source = options.getSource();
  const display = options.getDisplaySize();

  // Internal ref-set: the same refs the per-frame tick reads today. Seeded from the first
  // getConfig() so the initial scene construction sees identical values, then re-synced each tick.
  const initial = options.getConfig();
  const stripeColorsRef: RefObject<StripeColors> = { current: initial.stripeColors };
  const preferP3Ref: RefObject<boolean> = { current: initial.preferP3 };
  const duotoneEnabledRef: RefObject<boolean> = { current: initial.duotoneEnabled };
  const stripesEnabledRef: RefObject<boolean> = { current: initial.stripesEnabled };
  const textureGammaRef: RefObject<number> = { current: initial.textureGamma };
  const sparkleOptionsRef: RefObject<PlaygroundSparkleOptions> = { current: initial.sparkle };
  const widthShuffleOptionsRef: RefObject<PlaygroundWidthShuffleOptions> = { current: initial.widthShuffle };
  const gridConfigRef: RefObject<PlaygroundGridConfig> = { current: initial.gridConfig };
  const textureAdjustmentsRef: RefObject<PlaygroundTextureAdjustments> = { current: initial.textureAdjustments };
  const textureLuminanceSettingsRef: RefObject<TextureLuminanceSettings> = {
    current: initial.textureLuminanceSettings,
  };
  const sourceTransformRef: RefObject<PlaygroundSourceTransform> = { current: initial.sourceTransform };
  const flamesConfigRef: RefObject<PlaygroundFlamesConfig> = { current: initial.flamesConfig };
  const revealConfigRef: RefObject<PlaygroundRevealConfig> = { current: initial.revealConfig };
  const revealPlaybackRef: RefObject<PlaygroundRevealPlayback> = { current: initial.revealPlayback };
  const cursorTrailConfigRef: RefObject<PlaygroundCursorTrailConfig> = { current: initial.cursorTrailConfig };
  const clickWaveConfigRef: RefObject<PlaygroundClickWaveConfig> = { current: initial.clickWaveConfig };

  // State refs and the detect callback map straight onto the existing params. flamesState defaults
  // to { current: null } exactly as the legacy default — runDuotoneTick reads it at setup to decide
  // whether to allocate a flames overlay, so it must be the real owner ref (not a getConfig field).
  const flamesStateRef = options.flamesStateRef ?? DEFAULT_FLAMES_STATE_REF;
  const revealStateRef = options.revealStateRef ?? DEFAULT_REVEAL_STATE_REF;
  const exportStateRef = options.exportStateRef;
  const autoplayRef: RefObject<boolean> = { current: options.autoplay ?? false };

  // Copy the live config onto the internal refs. Called once before setup and at the top of every
  // tick (via beforeTick) — before runDuotoneTick's logic reads them, so render order is unchanged.
  // The luminance ref is the same two-way slot the tick mutates in place for colors auto-detect; the
  // owner reconciles via onTextureLuminanceSettingsDetected and surfaces the result through getConfig.
  const syncInternalRefs = () => {
    const config = options.getConfig();
    stripeColorsRef.current = config.stripeColors;
    preferP3Ref.current = config.preferP3;
    duotoneEnabledRef.current = config.duotoneEnabled;
    stripesEnabledRef.current = config.stripesEnabled;
    textureGammaRef.current = config.textureGamma;
    sparkleOptionsRef.current = config.sparkle;
    widthShuffleOptionsRef.current = config.widthShuffle;
    gridConfigRef.current = config.gridConfig;
    textureAdjustmentsRef.current = config.textureAdjustments;
    textureLuminanceSettingsRef.current = config.textureLuminanceSettings;
    sourceTransformRef.current = config.sourceTransform;
    flamesConfigRef.current = config.flamesConfig;
    revealConfigRef.current = config.revealConfig;
    revealPlaybackRef.current = config.revealPlayback;
    cursorTrailConfigRef.current = config.cursorTrailConfig;
    clickWaveConfigRef.current = config.clickWaveConfig;
  };

  // Seed before setup so scene construction (filters, sprite layout, letter layer) reads the same
  // values it reads today. (No-op relative to the seeds above, but keeps the single source of truth.)
  syncInternalRefs();

  const { onTextureLuminanceSettingsDetected } = options;

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
      onTextureLuminanceSettingsDetected,
      syncInternalRefs,
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
    onTextureLuminanceSettingsDetected,
    syncInternalRefs,
  );
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
  onTextureLuminanceSettingsDetected?: (settings: TextureLuminanceSettings) => void,
  beforeTick?: () => void,
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
      syncVisual: () =>
        syncSpriteToDisplay(sprite, { kind: "image", element: image }, display, sourceTransformRef.current),
      shouldSample: () => false,
      sampleFrame: () =>
        sampleTextureFrame(image, display.width, display.height, sampleCanvas, sampleCtx, sourceTransformRef.current),
      onTextureLuminanceSettingsDetected,
    });

    // Sync the live config onto the internal refs before the render logic reads them, then run the
    // unchanged tick. Without a beforeTick hook (legacy direct callers) renderTick runs as-is.
    const tick = beforeTick
      ? () => {
          beforeTick();
          renderTick();
        }
      : renderTick;

    app.ticker.add(tick);

    cleanup(() => {
      if (app.ticker) {
        app.ticker.remove(tick);
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
  onTextureLuminanceSettingsDetected?: (settings: TextureLuminanceSettings) => void,
  beforeTick?: () => void,
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

    // Sync the live config onto the internal refs before the render logic reads them, then run the
    // unchanged tick. Without a beforeTick hook (legacy direct callers) renderTick runs as-is.
    const tick = beforeTick
      ? () => {
          beforeTick();
          renderTick();
        }
      : renderTick;

    app.ticker.add(tick);

    if (autoplayRef.current) {
      void video.play().catch(() => {
        // Autoplay may require a user gesture even when muted.
      });
    }

    cleanup(() => {
      if (app.ticker) {
        app.ticker.remove(tick);
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
