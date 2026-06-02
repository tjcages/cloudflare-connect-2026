import { Sprite, Texture, VideoSource } from "pixi.js";
import type { RefObject } from "react";
import type { Ticker } from "./pixi";
import { createStripeDuotoneFilter } from "./shaders";
import type { StripeBandColors } from "./types";
import { BlockGridTexture } from "./runtime/blockGridTexture";
import type { BlockGrid } from "./runtime/computeBlockGrid";
import {
  buildPlaygroundBlockGrid,
  sampleTextureFrame,
  sampleVideoFrame,
  type PlaygroundGridBuildState,
} from "./runtime/samplePlaygroundFrame";
import type { StripeDuotoneOptions } from "./runtime/stripeFilterOptions";
import { buildStripeLetterAtlas, destroyStripeLetterAtlas } from "./runtime/stripeLetterFont";
import type { PlaygroundSparkleOptions } from "./runtime/playgroundSparkle";
import { createStripeLetterLayer, type StripeLetterLayer } from "./runtime/stripeLetterLayer";

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

export type PlaygroundDisplaySize = { width: number; height: number };

export type PlaygroundSceneExportState = {
  grid: BlockGrid | null;
  colors: StripeBandColors;
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
): { letterLayer: StripeLetterLayer; atlas: ReturnType<typeof buildStripeLetterAtlas> } {
  const atlas = buildStripeLetterAtlas();
  const letterLayer = createStripeLetterLayer(atlas);
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
  stripeOptionsRef: RefObject<StripeDuotoneOptions>;
  stripeColorsRef: RefObject<StripeBandColors>;
  preferP3Ref: RefObject<boolean>;
  display: PlaygroundDisplaySize;
  blockGridTexture: BlockGridTexture;
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>;
  syncVisual: () => void;
  shouldSample: () => boolean;
  sampleFrame: () => ImageData | null;
  onSampled?: () => void;
}): () => void {
  const {
    app,
    sprite,
    stripeFilter,
    letterLayer,
    duotoneEnabledRef,
    sparkleOptionsRef,
    stripeOptionsRef,
    stripeColorsRef,
    preferP3Ref,
    display,
    blockGridTexture,
    exportStateRef,
    syncVisual,
    shouldSample,
    sampleFrame,
    onSampled,
  } = params;

  let duotoneActive = duotoneEnabledRef.current;
  let lastOptionsKey = "";
  let lastColorsKey = "";
  let gridState: PlaygroundGridBuildState = {};
  let lastGridUpdateMs = 0;
  let hasBuiltGrid = false;

  return () => {
    syncVisual();

    const duotoneEnabled = duotoneEnabledRef.current;
    if (duotoneEnabled !== duotoneActive) {
      duotoneActive = duotoneEnabled;
      sprite.filters = duotoneActive ? [stripeFilter] : null;
      letterLayer.setVisible(duotoneActive);
      if (duotoneActive) {
        lastOptionsKey = "";
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

    const options = stripeOptionsRef.current;
    const colors = stripeColorsRef.current;
    const optionsKey = JSON.stringify(options);
    const colorsKey = JSON.stringify(colors);
    const optionsChanged = optionsKey !== lastOptionsKey;
    const colorsChanged = colorsKey !== lastColorsKey;
    const timeChanged = shouldSample();
    const needsSample = timeChanged || optionsChanged || colorsChanged || !hasBuiltGrid;

    if (colorsChanged) {
      lastColorsKey = colorsKey;
      stripeFilter.syncColors(colors, preferP3Ref.current);
    }

    const frame = needsSample ? sampleFrame() : null;
    if (frame) {
      onSampled?.();
    }

    const shouldRebuildGrid =
      frame &&
      (optionsChanged ||
        colorsChanged ||
        !hasBuiltGrid ||
        (timeChanged && performance.now() - lastGridUpdateMs >= PLAYGROUND_GRID_UPDATE_INTERVAL_MS));

    if (shouldRebuildGrid && frame) {
      hasBuiltGrid = true;
      lastOptionsKey = optionsKey;
      lastGridUpdateMs = performance.now();
      if (optionsChanged) {
        gridState = {};
      }

      const built = buildPlaygroundBlockGrid(frame, display.width, display.height, options, gridState);
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
    } else if (exportStateRef && gridState.stableBands) {
      exportStateRef.current = {
        grid: {
          cols: blockGridTexture.cols,
          rows: blockGridTexture.rows,
          bands: gridState.stableBands,
        },
        colors,
        displayWidth: display.width,
        displayHeight: display.height,
      };
    }

    const sparkleTimeSec = performance.now() / 1000;
    const sparkleOptions = sparkleOptionsRef.current;
    stripeFilter.syncSparkle(sparkleOptions, sparkleTimeSec);
    letterLayer.applySparkle(sparkleTimeSec, sparkleOptions);

    app.render();
  };
}

export function createTextureSceneTicker(
  source: PlaygroundTextureSource,
  display: PlaygroundDisplaySize,
  stripeOptionsRef: RefObject<StripeDuotoneOptions>,
  stripeColorsRef: RefObject<StripeBandColors>,
  preferP3Ref: RefObject<boolean>,
  duotoneEnabledRef: RefObject<boolean>,
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>,
  autoplayRef: RefObject<boolean>,
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
): Ticker {
  if (source.kind === "image") {
    return createImageSceneTicker(
      source.element,
      display,
      stripeOptionsRef,
      stripeColorsRef,
      preferP3Ref,
      duotoneEnabledRef,
      sparkleOptionsRef,
      exportStateRef,
    );
  }
  return createVideoSceneTickerInternal(
    source.element,
    display,
    stripeOptionsRef,
    stripeColorsRef,
    preferP3Ref,
    duotoneEnabledRef,
    sparkleOptionsRef,
    autoplayRef,
    exportStateRef,
  );
}

function createImageSceneTicker(
  image: HTMLImageElement,
  display: PlaygroundDisplaySize,
  stripeOptionsRef: RefObject<StripeDuotoneOptions>,
  stripeColorsRef: RefObject<StripeBandColors>,
  preferP3Ref: RefObject<boolean>,
  duotoneEnabledRef: RefObject<boolean>,
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>,
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
): Ticker {
  return ({ app, cleanup }) => {
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

    const blockGridTexture = new BlockGridTexture(display.width, display.height);
    const stripeFilter = createStripeDuotoneFilter(
      display.width,
      display.height,
      blockGridTexture.texture,
      blockGridTexture.cols,
      blockGridTexture.rows,
      stripeColorsRef.current,
      preferP3Ref.current,
    );
    let duotoneActive = duotoneEnabledRef.current;
    sprite.filters = duotoneActive ? [stripeFilter] : null;
    app.stage.addChild(sprite);
    const { letterLayer, atlas } = createPlaygroundLetterLayer(app, duotoneActive);

    const renderTick = runDuotoneTick({
      app,
      sprite,
      stripeFilter,
      letterLayer,
      duotoneEnabledRef,
      sparkleOptionsRef,
      stripeOptionsRef,
      stripeColorsRef,
      preferP3Ref,
      display,
      blockGridTexture,
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
      blockGridTexture.destroy();
      letterLayer.destroy();
      destroyStripeLetterAtlas(atlas);
      sprite.destroy({ children: true });
      texture.destroy(true);
    });
  };
}

function createVideoSceneTickerInternal(
  video: HTMLVideoElement,
  display: PlaygroundDisplaySize,
  stripeOptionsRef: RefObject<StripeDuotoneOptions>,
  stripeColorsRef: RefObject<StripeBandColors>,
  preferP3Ref: RefObject<boolean>,
  duotoneEnabledRef: RefObject<boolean>,
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>,
  autoplayRef: RefObject<boolean>,
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
): Ticker {
  return ({ app, cleanup }) => {
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

    const blockGridTexture = new BlockGridTexture(display.width, display.height);
    const stripeFilter = createStripeDuotoneFilter(
      display.width,
      display.height,
      blockGridTexture.texture,
      blockGridTexture.cols,
      blockGridTexture.rows,
      stripeColorsRef.current,
      preferP3Ref.current,
    );
    let duotoneActive = duotoneEnabledRef.current;
    sprite.filters = duotoneActive ? [stripeFilter] : null;
    app.stage.addChild(sprite);
    const { letterLayer, atlas } = createPlaygroundLetterLayer(app, duotoneActive);

    let lastSampledTime = -1;

    const renderTick = runDuotoneTick({
      app,
      sprite,
      stripeFilter,
      letterLayer,
      duotoneEnabledRef,
      sparkleOptionsRef,
      stripeOptionsRef,
      stripeColorsRef,
      preferP3Ref,
      display,
      blockGridTexture,
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
      blockGridTexture.destroy();
      letterLayer.destroy();
      destroyStripeLetterAtlas(atlas);
      sprite.destroy({ children: true });
      texture.destroy(true);
    });
  };
}

/** @deprecated Use {@link createTextureSceneTicker}. */
export function createVideoSceneTicker(
  video: HTMLVideoElement,
  display: PlaygroundDisplaySize,
  stripeOptionsRef: RefObject<StripeDuotoneOptions>,
  stripeColorsRef: RefObject<StripeBandColors>,
  preferP3Ref: RefObject<boolean>,
  duotoneEnabledRef: RefObject<boolean>,
  sparkleOptionsRef: RefObject<PlaygroundSparkleOptions>,
  autoplayRef: RefObject<boolean>,
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
): Ticker {
  return createTextureSceneTicker(
    { kind: "video", element: video },
    display,
    stripeOptionsRef,
    stripeColorsRef,
    preferP3Ref,
    duotoneEnabledRef,
    sparkleOptionsRef,
    autoplayRef,
    exportStateRef,
  );
}

/** @deprecated Use {@link createTextureSceneTicker}. */
export const createVideoShaderSceneTicker = createVideoSceneTicker;
