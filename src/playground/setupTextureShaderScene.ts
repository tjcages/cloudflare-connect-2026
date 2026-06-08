import { Graphics, Sprite, Texture, VideoSource } from "pixi.js";
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
import { createStripeDuotoneFilter } from "./stripeDuotoneFilter";
import type { StripeColors } from "./stripeColors";
import { buildStripeLetterAtlas, destroyStripeLetterAtlas } from "./stripeLetterFont";
import { stepPlaygroundFlames, PlaygroundFlamesOverlay, type PlaygroundFlamesState } from "./playgroundFlames";
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
  type PlaygroundTextureAdjustments,
} from "./playgroundTextureAdjustments";
import {
  DEFAULT_PLAYGROUND_REVEAL_CONFIG,
  resolvePlaygroundRevealDurationMs,
  type PlaygroundRevealConfig,
} from "./playgroundRevealConfig";
import type { PlaygroundRevealState } from "./playgroundReveal";
import type { TextureLuminanceSettings } from "./colorWhiteness";
import { createSourceTextureFilter } from "./sourceTextureFilter";
import {
  applyCursorTrailToPixels,
  buildCursorTrailVisuals,
  createCursorTrailState,
  setCursorTrailTarget,
  updateCursorTrail,
  type CursorTrailState,
} from "./cursorTrail";

/** Default canvas scale for clips without an explicit per-texture scale. */
export const PLAYGROUND_DISPLAY_SCALE = 0.5;

/** Pixi resolution for the playground canvas (2× backing store for sharper stripes and letters). */
export const PLAYGROUND_PIXI_RESOLUTION = 2;

export const PLAYGROUND_DISPLAY_MAX_PX = 8192;

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
  if (!duotoneEnabled) {
    return "off";
  }
  return stripesEnabled ? "stripes" : "preview";
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

/** Uses explicit canvas size when both dimensions are positive; otherwise native source size. */
export function resolvePlaygroundDisplaySize(
  native: PlaygroundDisplaySize,
  canvas?: { displayWidth?: number; displayHeight?: number },
): PlaygroundDisplaySize {
  const width = canvas?.displayWidth;
  const height = canvas?.displayHeight;
  if (width && width > 0 && height && height > 0) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  return native;
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

function attachCursorTrailEvents(
  canvas: HTMLCanvasElement,
  display: PlaygroundDisplaySize,
  state: CursorTrailState,
): () => void {
  const onPointerMove = (event: PointerEvent) => {
    setCursorTrailTarget(state, cursorTrailPointFromEvent(event, canvas, display));
  };
  const onPointerLeave = () => {
    setCursorTrailTarget(state, null);
  };

  window.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointercancel", onPointerLeave);
  window.addEventListener("blur", onPointerLeave);

  return () => {
    window.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("pointercancel", onPointerLeave);
    window.removeEventListener("blur", onPointerLeave);
  };
}

function syncCursorTrailLayer(layer: Graphics, samples: ReturnType<typeof updateCursorTrail>["samples"]): void {
  layer.clear();
  for (const visual of buildCursorTrailVisuals(samples)) {
    layer.circle(visual.x, visual.y, visual.radius);
    layer.fill({ color: visual.color, alpha: visual.alpha });
  }
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
  cursorTrailLayer: Graphics;
  cursorTrailState: CursorTrailState;
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>;
  syncVisual: () => void;
  shouldSample: () => boolean;
  sampleFrame: () => ImageData | null;
  onSampled?: () => void;
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
    cursorTrailLayer,
    cursorTrailState,
    exportStateRef,
    syncVisual,
    shouldSample,
    sampleFrame,
    onSampled,
  } = params;

  // These GPU resources are reallocated in place when the cell/gap or letters change, so a
  // config tweak updates the live scene instead of remounting the whole Pixi app.
  let blockGridTexture = params.blockGridTexture;
  let atlas = params.atlas;

  let textureFilterMode = resolveTextureFilterMode(duotoneEnabledRef.current, stripesEnabledRef.current);
  let lastColorsKey = "";
  let gridState: PlaygroundGridBuildState = {};
  let lastGridUpdateMs = 0;
  let lastFullResampleMs = 0;
  let lastTrailTickMs = performance.now();
  let hasBuiltGrid = false;
  let pendingFullResample = false;
  let pendingColorsResample = false;
  const flamesOverlay = flamesStateRef.current ? new PlaygroundFlamesOverlay(display.width, display.height) : null;

  const initialCell = effectivePlaygroundCellSize(gridConfigRef.current);
  let lastEffWidth = initialCell.width;
  let lastEffHeight = initialCell.height;
  let lastLetterSize = gridConfigRef.current.letterSize;
  let lastLetterCharset = gridConfigRef.current.letterCharset;
  let lastLetterRatio = gridConfigRef.current.letterRatio;
  let lastRevealReplayKey = revealPlaybackRef.current.replayKey;

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
    blockGridTexture.destroy();
    flamesOverlay?.destroy();
    cursorTrailLayer.destroy();
    letterLayer.destroy();
    destroyStripeLetterAtlas(atlas);
  };

  const tick = () => {
    const now = performance.now();
    const trail = updateCursorTrail(cursorTrailState, now - lastTrailTickMs);
    lastTrailTickMs = now;
    syncCursorTrailLayer(cursorTrailLayer, trail.samples);
    syncVisual();
    sourceTextureFilter.syncAdjustments({
      ...textureAdjustmentsRef.current,
      gamma: textureGammaRef.current,
    });
    stripeFilter.syncUseCellColors(textureLuminanceSettingsRef.current.mode === "colors");
    const flamesState = flamesStateRef.current;
    const flamesConfig = flamesConfigRef.current;
    if (flamesState && flamesConfig.enabled) {
      stepPlaygroundFlames(flamesState, flamesConfig, display, performance.now());
    }

    stripeFilter.syncGrid(gridConfigRef.current);
    letterLayer.setTint(gridConfigRef.current.letterColor);
    letterLayer.setShuffleSpeed(gridConfigRef.current.letterShuffleSpeed);
    applyStructuralChanges(gridConfigRef.current);

    const nextTextureFilterMode = resolveTextureFilterMode(duotoneEnabledRef.current, stripesEnabledRef.current);
    if (nextTextureFilterMode !== textureFilterMode) {
      textureFilterMode = nextTextureFilterMode;
      sprite.filters =
        textureFilterMode === "stripes"
          ? [stripeFilter]
          : textureFilterMode === "preview"
            ? [sourceTextureFilter]
            : null;
      letterLayer.setVisible(textureFilterMode === "stripes");
      if (textureFilterMode === "stripes") {
        lastColorsKey = "";
        hasBuiltGrid = false;
      } else {
        letterLayer.sync(null);
      }
    }

    if (textureFilterMode !== "stripes") {
      const flamesActive = Boolean(flamesState && flamesConfig.enabled);
      if (flamesOverlay && textureFilterMode === "preview" && flamesActive) {
        flamesOverlay.sync(flamesState, flamesConfig);
        sourceTextureFilter.syncFlames(flamesOverlay.texture, flamesConfig);
      } else {
        sourceTextureFilter.syncFlames(null, null);
      }
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
    const timeChanged = shouldSample() || (flamesState != null && flamesConfig.enabled) || revealProgress < 1;
    const trailChanged = trail.changed;
    const needsSample = timeChanged || colorsChanged || trailChanged || !hasBuiltGrid || pendingFullResample;

    if (colorsChanged) {
      stripeFilter.syncColors(colors, preferP3Ref.current);
      lastColorsKey = colorsKey;
      pendingFullResample = true;
      pendingColorsResample = true;
    }

    const frame = needsSample ? sampleFrame() : null;
    if (frame) {
      // Cursor density must be part of the sampled pixels before stripe cells are rebuilt.
      applyCursorTrailToPixels(frame.data, display.width, display.height, trail.samples);
      onSampled?.();
    }

    const gridConfig = gridConfigRef.current;
    const fullResampleReady = now - lastFullResampleMs >= PLAYGROUND_FULL_RESAMPLE_THROTTLE_MS;
    const shouldRebuildGrid =
      frame &&
      (!hasBuiltGrid ||
        (pendingFullResample && fullResampleReady) ||
        trailChanged ||
        (timeChanged && !pendingFullResample && now - lastGridUpdateMs >= gridConfig.gridUpdateIntervalMs));

    if (shouldRebuildGrid && frame) {
      hasBuiltGrid = true;
      pendingFullResample = false;
      lastGridUpdateMs = now;
      lastFullResampleMs = now;
      // Re-bucketing thresholds change the index mapping; snap rather than smear.
      if (pendingColorsResample) {
        gridState = {};
        pendingColorsResample = false;
      }

      const effectiveCell = effectivePlaygroundCellSize(gridConfig);
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
          reveal: {
            config: revealConfig,
            progress: revealProgress,
            replayKey: revealPlayback.replayKey,
          },
        },
      );
      gridState = built.state;
      blockGridTexture.update(built.grid);
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

    app.render();
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
      exportStateRef,
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
    exportStateRef,
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
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
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
    sprite.filters =
      textureFilterMode === "stripes" ? [stripeFilter] : textureFilterMode === "preview" ? [sourceTextureFilter] : null;
    app.stage.addChild(sprite);
    const { letterLayer, atlas } = createPlaygroundLetterLayer(app, textureFilterMode === "stripes", grid);
    const cursorTrailState = createCursorTrailState();
    const cursorTrailLayer = new Graphics();
    cursorTrailLayer.zIndex = 1000;
    app.stage.sortableChildren = true;
    app.stage.addChild(cursorTrailLayer);
    const detachCursorTrailEvents = attachCursorTrailEvents(app.canvas as HTMLCanvasElement, display, cursorTrailState);

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
      cursorTrailLayer,
      cursorTrailState,
      exportStateRef,
      syncVisual: () =>
        syncSpriteToDisplay(sprite, { kind: "image", element: image }, display, sourceTransformRef.current),
      shouldSample: () => false,
      sampleFrame: () =>
        sampleTextureFrame(image, display.width, display.height, sampleCanvas, sampleCtx, sourceTransformRef.current),
    });

    app.ticker.add(renderTick);

    cleanup(() => {
      if (app.ticker) {
        app.ticker.remove(renderTick);
      }
      image.removeEventListener("load", onLayoutChange);
      detachCursorTrailEvents();
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
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
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
    sprite.filters =
      textureFilterMode === "stripes" ? [stripeFilter] : textureFilterMode === "preview" ? [sourceTextureFilter] : null;
    app.stage.addChild(sprite);
    const { letterLayer, atlas } = createPlaygroundLetterLayer(app, textureFilterMode === "stripes", grid);
    const cursorTrailState = createCursorTrailState();
    const cursorTrailLayer = new Graphics();
    cursorTrailLayer.zIndex = 1000;
    app.stage.sortableChildren = true;
    app.stage.addChild(cursorTrailLayer);
    const detachCursorTrailEvents = attachCursorTrailEvents(app.canvas as HTMLCanvasElement, display, cursorTrailState);

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
      cursorTrailLayer,
      cursorTrailState,
      exportStateRef,
      syncVisual: () =>
        syncSpriteToDisplay(sprite, { kind: "video", element: video }, display, sourceTransformRef.current),
      shouldSample: () => video.currentTime !== lastSampledTime,
      sampleFrame: () =>
        sampleVideoFrame(video, display.width, display.height, sampleCanvas, sampleCtx, sourceTransformRef.current),
      onSampled: () => {
        lastSampledTime = video.currentTime;
      },
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
      detachCursorTrailEvents();
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
