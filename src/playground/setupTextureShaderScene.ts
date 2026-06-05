import { Sprite, Texture, VideoSource } from "pixi.js";
import type { RefObject } from "react";
import type { Ticker } from "../components/pixi";
import { BlockGridTexture } from "./blockGridTexture";
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
import type { PlaygroundSparkleOptions } from "./playgroundSparkle";
import type { PlaygroundWidthShuffleOptions } from "./playgroundWidthShuffle";
import { createStripeLetterLayer, type StripeLetterLayer } from "./stripeLetterLayer";
import {
  DEFAULT_PLAYGROUND_GRID_CONFIG,
  effectivePlaygroundCellSize,
  type PlaygroundGridConfig,
} from "./playgroundGridConfig";

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

/** Static ref used when a caller does not provide a live grid-config ref. */
const DEFAULT_GRID_CONFIG_REF: RefObject<PlaygroundGridConfig> = { current: DEFAULT_PLAYGROUND_GRID_CONFIG };

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

function syncSpriteToDisplay(sprite: Sprite, source: PlaygroundTextureSource, display: PlaygroundDisplaySize) {
  const native = getPlaygroundTextureNativeSize(source);
  if (native.width <= 0 || native.height <= 0 || display.width <= 0 || display.height <= 0) {
    return;
  }

  sprite.anchor.set(0, 0);
  sprite.position.set(0, 0);
  sprite.scale.set(display.width / native.width, display.height / native.height);
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

function runDuotoneTick(params: {
  app: Parameters<Ticker>[0]["app"];
  sprite: Sprite;
  stripeFilter: ReturnType<typeof createStripeDuotoneFilter>;
  letterLayer: StripeLetterLayer;
  duotoneEnabledRef: RefObject<boolean>;
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>;
  widthShuffleOptionsRef: RefObject<PlaygroundWidthShuffleOptions>;
  stripeColorsRef: RefObject<StripeColors>;
  preferP3Ref: RefObject<boolean>;
  textureGammaRef: RefObject<number>;
  gridConfigRef: RefObject<PlaygroundGridConfig>;
  display: PlaygroundDisplaySize;
  blockGridTexture: BlockGridTexture;
  atlas: ReturnType<typeof buildStripeLetterAtlas>;
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
    letterLayer,
    duotoneEnabledRef,
    sparkleOptionsRef,
    widthShuffleOptionsRef,
    stripeColorsRef,
    preferP3Ref,
    textureGammaRef,
    gridConfigRef,
    display,
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

  let duotoneActive = duotoneEnabledRef.current;
  let lastColorsKey = "";
  let gridState: PlaygroundGridBuildState = {};
  let lastGridUpdateMs = 0;
  let hasBuiltGrid = false;

  const initialCell = effectivePlaygroundCellSize(gridConfigRef.current);
  let lastEffWidth = initialCell.width;
  let lastEffHeight = initialCell.height;
  let lastLetterSize = gridConfigRef.current.letterSize;
  let lastLetterCharset = gridConfigRef.current.letterCharset;
  let lastLetterRatio = gridConfigRef.current.letterRatio;

  const applyStructuralChanges = (gridConfig: PlaygroundGridConfig) => {
    const eff = effectivePlaygroundCellSize(gridConfig);
    if (eff.width !== lastEffWidth || eff.height !== lastEffHeight) {
      const next = new BlockGridTexture(display.width, display.height, eff.width, eff.height);
      blockGridTexture.destroy();
      blockGridTexture = next;
      stripeFilter.updateBlockMap(next.texture);
      stripeFilter.resizeGrid(next.cols, next.rows, eff.width, eff.height);
      letterLayer.setCellSize(eff.width, eff.height);
      lastEffWidth = eff.width;
      lastEffHeight = eff.height;
      // Grid dimensions changed; resample and rebuild from scratch.
      gridState = {};
      hasBuiltGrid = false;
      lastColorsKey = "";
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
    }

    if (gridConfig.letterRatio !== lastLetterRatio) {
      letterLayer.setRatio(gridConfig.letterRatio);
      lastLetterRatio = gridConfig.letterRatio;
      hasBuiltGrid = false;
    }
  };

  const dispose = () => {
    blockGridTexture.destroy();
    letterLayer.destroy();
    destroyStripeLetterAtlas(atlas);
  };

  const tick = () => {
    syncVisual();
    stripeFilter.syncGrid(gridConfigRef.current);
    letterLayer.setTint(gridConfigRef.current.letterColor);
    letterLayer.setShuffleSpeed(gridConfigRef.current.letterShuffleSpeed);
    applyStructuralChanges(gridConfigRef.current);

    const duotoneEnabled = duotoneEnabledRef.current;
    if (duotoneEnabled !== duotoneActive) {
      duotoneActive = duotoneEnabled;
      sprite.filters = duotoneActive ? [stripeFilter] : null;
      letterLayer.setVisible(duotoneActive);
      if (duotoneActive) {
        lastColorsKey = "";
        hasBuiltGrid = false;
      } else {
        letterLayer.sync(null);
      }
    }

    if (!duotoneActive) {
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

    const colors = stripeColorsRef.current;
    const colorsKey = JSON.stringify({
      colors,
      preferP3: preferP3Ref.current,
      gamma: textureGammaRef.current,
    });
    const colorsChanged = colorsKey !== lastColorsKey;
    const timeChanged = shouldSample();
    const needsSample = timeChanged || colorsChanged || !hasBuiltGrid;

    if (colorsChanged) {
      lastColorsKey = colorsKey;
      stripeFilter.syncColors(colors, preferP3Ref.current);
    }

    const frame = needsSample ? sampleFrame() : null;
    if (frame) {
      onSampled?.();
    }

    const gridConfig = gridConfigRef.current;
    const shouldRebuildGrid =
      frame &&
      (colorsChanged ||
        !hasBuiltGrid ||
        (timeChanged && performance.now() - lastGridUpdateMs >= gridConfig.gridUpdateIntervalMs));

    if (shouldRebuildGrid && frame) {
      hasBuiltGrid = true;
      lastGridUpdateMs = performance.now();
      // Re-bucketing thresholds change the index mapping; snap rather than smear.
      if (colorsChanged) {
        gridState = {};
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
          smoothingMaxStep: gridConfig.smoothingMaxStep,
        },
      );
      gridState = built.state;
      blockGridTexture.update(built.grid);
      stripeFilter.updateBlockMap(blockGridTexture.texture);
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
  textureGammaRef: RefObject<number>,
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>,
  widthShuffleOptionsRef: RefObject<PlaygroundWidthShuffleOptions>,
  autoplayRef: RefObject<boolean>,
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
  gridConfigRef: RefObject<PlaygroundGridConfig> = DEFAULT_GRID_CONFIG_REF,
): Ticker {
  if (source.kind === "image") {
    return createImageSceneTicker(
      source.element,
      display,
      stripeColorsRef,
      preferP3Ref,
      duotoneEnabledRef,
      textureGammaRef,
      sparkleOptionsRef,
      widthShuffleOptionsRef,
      gridConfigRef,
      exportStateRef,
    );
  }
  return createVideoSceneTickerInternal(
    source.element,
    display,
    stripeColorsRef,
    preferP3Ref,
    duotoneEnabledRef,
    textureGammaRef,
    sparkleOptionsRef,
    widthShuffleOptionsRef,
    autoplayRef,
    gridConfigRef,
    exportStateRef,
  );
}

function createImageSceneTicker(
  image: HTMLImageElement,
  display: PlaygroundDisplaySize,
  stripeColorsRef: RefObject<StripeColors>,
  preferP3Ref: RefObject<boolean>,
  duotoneEnabledRef: RefObject<boolean>,
  textureGammaRef: RefObject<number>,
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>,
  widthShuffleOptionsRef: RefObject<PlaygroundWidthShuffleOptions>,
  gridConfigRef: RefObject<PlaygroundGridConfig>,
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
): Ticker {
  return ({ app, cleanup }) => {
    const grid = gridConfigRef.current;
    const effectiveCell = effectivePlaygroundCellSize(grid);
    const texture = Texture.from(image);
    const sprite = new Sprite(texture);
    syncSpriteToDisplay(sprite, { kind: "image", element: image }, display);

    const onLayoutChange = () => syncSpriteToDisplay(sprite, { kind: "image", element: image }, display);
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
    const duotoneActive = duotoneEnabledRef.current;
    sprite.filters = duotoneActive ? [stripeFilter] : null;
    app.stage.addChild(sprite);
    const { letterLayer, atlas } = createPlaygroundLetterLayer(app, duotoneActive, grid);

    const { tick: renderTick, dispose } = runDuotoneTick({
      app,
      sprite,
      stripeFilter,
      letterLayer,
      duotoneEnabledRef,
      sparkleOptionsRef,
      widthShuffleOptionsRef,
      stripeColorsRef,
      preferP3Ref,
      textureGammaRef,
      gridConfigRef,
      display,
      blockGridTexture,
      atlas,
      exportStateRef,
      syncVisual: () => syncSpriteToDisplay(sprite, { kind: "image", element: image }, display),
      shouldSample: () => false,
      sampleFrame: () => sampleTextureFrame(image, display.width, display.height, sampleCanvas, sampleCtx),
    });

    app.ticker.add(renderTick);

    cleanup(() => {
      if (app.ticker) {
        app.ticker.remove(renderTick);
      }
      image.removeEventListener("load", onLayoutChange);
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
  textureGammaRef: RefObject<number>,
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>,
  widthShuffleOptionsRef: RefObject<PlaygroundWidthShuffleOptions>,
  autoplayRef: RefObject<boolean>,
  gridConfigRef: RefObject<PlaygroundGridConfig>,
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
    syncSpriteToDisplay(sprite, { kind: "video", element: video }, display);

    const onVideoLayoutChange = () => syncSpriteToDisplay(sprite, { kind: "video", element: video }, display);
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
    const duotoneActive = duotoneEnabledRef.current;
    sprite.filters = duotoneActive ? [stripeFilter] : null;
    app.stage.addChild(sprite);
    const { letterLayer, atlas } = createPlaygroundLetterLayer(app, duotoneActive, grid);

    let lastSampledTime = -1;

    const { tick: renderTick, dispose } = runDuotoneTick({
      app,
      sprite,
      stripeFilter,
      letterLayer,
      duotoneEnabledRef,
      sparkleOptionsRef,
      widthShuffleOptionsRef,
      stripeColorsRef,
      preferP3Ref,
      textureGammaRef,
      gridConfigRef,
      display,
      blockGridTexture,
      atlas,
      exportStateRef,
      syncVisual: () => syncSpriteToDisplay(sprite, { kind: "video", element: video }, display),
      shouldSample: () => video.currentTime !== lastSampledTime,
      sampleFrame: () => sampleVideoFrame(video, display.width, display.height, sampleCanvas, sampleCtx),
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
    textureGammaRef,
    sparkleOptionsRef,
    widthShuffleOptionsRef,
    autoplayRef,
    exportStateRef,
  );
}

/** @deprecated Use {@link createTextureSceneTicker}. */
export const createVideoShaderSceneTicker = createVideoSceneTicker;
