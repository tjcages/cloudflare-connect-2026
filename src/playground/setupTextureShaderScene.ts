import { Filter, Sprite, Texture, VideoSource } from "pixi.js";
import type { RefObject } from "react";
import type { Ticker } from "../components/pixi";
import { BlockGridTexture } from "./blockGridTexture";
import { resampleBlockGrid } from "./resampleBlockGrid";
import type { BlockGrid } from "./computeBlockGrid";
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
  resolveCursorTrailEffectSize,
  type PlaygroundCursorTrailConfig,
} from "./playgroundCursorTrailConfig";
import {
  addClickWave,
  applyClickWavesToEffectPixels,
  createClickWaveState,
  mergePointerEffectBounds,
  updateClickWave,
  type ClickWaveGridContext,
  type ClickWaveSample,
  type ClickWaveState,
} from "./clickWave";
import {
  applyCursorTrailToEffectPixels,
  createCursorTrailState,
  downsamplePixelsNearest,
  setCursorTrailTarget,
  updateCursorTrail,
  upscalePixelsNearest,
  type CursorTrailPixelBounds,
  type CursorTrailSample,
  type CursorTrailState,
} from "./cursorTrail";
import { resolvePlaygroundPixiTint, resolveStripesForLuminanceMode } from "./stripeColors";
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

export type PlaygroundTextureSource =
  | { kind: "video"; element: HTMLVideoElement }
  | { kind: "image"; element: HTMLImageElement };

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

function buildDisplayFrameWithPointerEffects(
  cachedEffectBase: Uint8ClampedArray,
  effectWidth: number,
  effectHeight: number,
  displayWidth: number,
  displayHeight: number,
  trailSamples: readonly CursorTrailSample[],
  cursorTrailConfig: PlaygroundCursorTrailConfig,
  clickWaveSamples: readonly ClickWaveSample[],
  clickWaveConfig: PlaygroundClickWaveConfig,
  clickWaveGrid: ClickWaveGridContext,
  luminanceSettings: TextureLuminanceSettings,
  workingEffect?: Uint8ClampedArray,
  displayPixels?: Uint8ClampedArray,
): { data: Uint8ClampedArray; bounds: CursorTrailPixelBounds | null } {
  const effect = workingEffect ?? new Uint8ClampedArray(cachedEffectBase);
  if (effect !== cachedEffectBase) {
    effect.set(cachedEffectBase);
  }

  let bounds =
    clickWaveSamples.length > 0
      ? applyClickWavesToEffectPixels(
          effect,
          effectWidth,
          effectHeight,
          displayWidth,
          displayHeight,
          clickWaveSamples,
          clickWaveConfig,
          clickWaveGrid,
        )
      : null;
  if (trailSamples.length > 0) {
    bounds = mergePointerEffectBounds(
      bounds,
      applyCursorTrailToEffectPixels(
        effect,
        effectWidth,
        effectHeight,
        displayWidth,
        displayHeight,
        trailSamples,
        cursorTrailConfig,
        luminanceSettings,
      ),
    );
  }

  const output = displayPixels ?? new Uint8ClampedArray(displayWidth * displayHeight * 4);
  upscalePixelsNearest(effect, effectWidth, effectHeight, output, displayWidth, displayHeight);
  return { data: output, bounds };
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
  let lastEffWidth = initialCell.width;
  let lastEffHeight = initialCell.height;
  let lastLetterSize = gridConfigRef.current.letterSize;
  let lastLetterCharset = gridConfigRef.current.letterCharset;
  let lastLetterRatio = gridConfigRef.current.letterRatio;
  let lastRevealReplayKey = revealPlaybackRef.current.replayKey;
  let cachedEffectBase: Uint8ClampedArray | null = null;
  let cachedEffectBaseKey = "";
  let workingEffectPixels: Uint8ClampedArray | null = null;
  let displayFramePixels: Uint8ClampedArray | null = null;
  let displayFrameImageData: ImageData | null = null;

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
    letterLayer.destroy();
    destroyStripeLetterAtlas(atlas);
  };

  const frameFromDisplayPixels = (pixels: Uint8ClampedArray): ImageData => {
    if (
      !displayFrameImageData ||
      displayFrameImageData.width !== display.width ||
      displayFrameImageData.height !== display.height ||
      displayFrameImageData.data !== pixels
    ) {
      displayFrameImageData = new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, display.width, display.height);
    }
    return displayFrameImageData;
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
    const revealPlayback = revealPlaybackRef.current;
    if (revealPlayback.replayKey !== lastRevealReplayKey) {
      lastRevealReplayKey = revealPlayback.replayKey;
      pendingFullResample = true;
      gridState = {};
    }
    const revealProgress = Math.min(
      1,
      Math.max(0, (now - revealPlayback.startedAtMs) / Math.max(1, resolvePlaygroundRevealDurationMs(revealConfig))),
    );
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
    const revealActive = revealProgress < 1;
    const trailSamplingEnabled = cursorTrailConfig.enabled;
    const clickWaveSamplingEnabled = clickWaveConfig.enabled && !revealActive;
    const pointerEffectsChanged =
      (trailSamplingEnabled && trail.changed) || (clickWaveSamplingEnabled && clickWave.changed);
    const sourceTimeChanged = shouldSample() || revealActive;
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
      lastColorsKey = colorsKey;
      pendingFullResample = true;
      pendingColorsResample = true;
      cachedEffectBase = null;
      cachedEffectBaseKey = "";
    }

    const gridConfig = gridConfigRef.current;
    const effectiveCell = effectivePlaygroundCellSize(gridConfig);
    const effectSize = resolveCursorTrailEffectSize(
      display.width,
      display.height,
      cursorTrailConfig,
      effectiveCell.width,
      effectiveCell.height,
    );
    const effectPixelCount = effectSize.width * effectSize.height * 4;
    const displayPixelCount = display.width * display.height * 4;
    const frameCacheKey = `${display.width}x${display.height}:${colorsKey}:${effectSize.width}x${effectSize.height}`;

    if (needsSourceFrame) {
      const sampleTimer = tickTimer ? createPlaygroundPerfTimer() : null;
      const sampled = sampleFrame();
      if (sampleTimer) {
        sampleFrameMs += sampleTimer.elapsedMs();
      }
      if (sampled) {
        if (!cachedEffectBase || cachedEffectBase.length !== effectPixelCount) {
          cachedEffectBase = new Uint8ClampedArray(effectPixelCount);
        }
        downsamplePixelsNearest(
          sampled.data,
          display.width,
          display.height,
          cachedEffectBase,
          effectSize.width,
          effectSize.height,
        );
        cachedEffectBaseKey = frameCacheKey;
      } else {
        cachedEffectBase = null;
        cachedEffectBaseKey = "";
      }
    }

    const fullResampleReady = now - lastFullResampleMs >= PLAYGROUND_FULL_RESAMPLE_THROTTLE_MS;

    let frame: ImageData | null = null;
    const needsPointerEffectsFrame =
      pointerEffectsChanged &&
      cachedEffectBase &&
      cachedEffectBaseKey === frameCacheKey &&
      (trailSamplingEnabled ||
        clickWaveSamplingEnabled ||
        (trail.samples.length === 0 && clickWave.samples.length === 0));
    const trailSamples = trailSamplingEnabled ? trail.samples : [];
    const clickWaveSamples = clickWaveSamplingEnabled ? clickWave.samples : [];

    if (needsPointerEffectsFrame && cachedEffectBase) {
      const compositeTimer = tickTimer ? createPlaygroundPerfTimer() : null;
      if (!workingEffectPixels || workingEffectPixels.length !== effectPixelCount) {
        workingEffectPixels = new Uint8ClampedArray(effectPixelCount);
      }
      if (!displayFramePixels || displayFramePixels.length !== displayPixelCount) {
        displayFramePixels = new Uint8ClampedArray(displayPixelCount);
      }
      const composited = buildDisplayFrameWithPointerEffects(
        cachedEffectBase,
        effectSize.width,
        effectSize.height,
        display.width,
        display.height,
        trailSamples,
        cursorTrailConfig,
        clickWaveSamples,
        clickWaveConfig,
        { gridCellWidth: effectiveCell.width, gridCellHeight: effectiveCell.height },
        textureLuminanceSettingsRef.current,
        workingEffectPixels,
        displayFramePixels,
      );
      frame = frameFromDisplayPixels(composited.data);
      if (compositeTimer) {
        pointerCompositeMs += compositeTimer.elapsedMs();
      }
      onSampled?.();
    } else if (needsSourceFrame && cachedEffectBase && cachedEffectBaseKey === frameCacheKey) {
      if (!displayFramePixels || displayFramePixels.length !== displayPixelCount) {
        displayFramePixels = new Uint8ClampedArray(displayPixelCount);
      }
      buildDisplayFrameWithPointerEffects(
        cachedEffectBase,
        effectSize.width,
        effectSize.height,
        display.width,
        display.height,
        [],
        cursorTrailConfig,
        [],
        clickWaveConfig,
        { gridCellWidth: effectiveCell.width, gridCellHeight: effectiveCell.height },
        textureLuminanceSettingsRef.current,
        workingEffectPixels ?? undefined,
        displayFramePixels,
      );
      frame = frameFromDisplayPixels(displayFramePixels);
      onSampled?.();
    } else if (needsSourceFrame) {
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
        pointerEffectsChanged ||
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
      if (pointerEffectsChanged) {
        gridState = {};
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
          reveal: {
            config: revealConfig,
            progress: revealProgress,
            replayKey: revealPlayback.replayKey,
          },
        },
      );
      if (buildTimer) {
        buildGridMs += buildTimer.elapsedMs();
      }
      gridState = built.state;

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
): Ticker {
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
