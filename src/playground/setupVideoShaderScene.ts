import { Sprite, Texture, VideoSource } from "pixi.js";
import type { RefObject } from "react";
import type { Ticker } from "../components/pixi";
import { BlockGridTexture } from "./blockGridTexture";
import type { BlockGrid } from "./computeBlockGrid";
import { buildPlaygroundBlockGrid, sampleVideoFrame, type PlaygroundGridBuildState } from "./samplePlaygroundFrame";
import { createStripeDuotoneFilter } from "./stripeDuotoneFilter";
import type { StripeColors } from "./stripeColors";
import type { StripeDuotoneOptions } from "./stripeFilterOptions";

/** Default canvas scale for clips without an explicit per-video scale. */
export const PLAYGROUND_DISPLAY_SCALE = 0.5;

/** Pixi resolution for the playground canvas (1 keeps filter pixels aligned with CPU grid). */
export const PLAYGROUND_PIXI_RESOLUTION = 1;

/** Minimum ms between block-grid rebuilds (reduces temporal shimmer on noisy clips). */
export const PLAYGROUND_GRID_UPDATE_INTERVAL_MS = 66;

export type PlaygroundDisplaySize = { width: number; height: number };

export type PlaygroundSceneExportState = {
  grid: BlockGrid | null;
  colors: StripeColors;
  displayWidth: number;
  displayHeight: number;
};

/** Scaled display size; height derived from width so aspect ratio stays exact. */
export function getPlaygroundDisplaySize(
  video: HTMLVideoElement,
  displayScale = PLAYGROUND_DISPLAY_SCALE,
): PlaygroundDisplaySize {
  const nativeW = video.videoWidth;
  const nativeH = video.videoHeight;
  if (nativeW <= 0 || nativeH <= 0) {
    return { width: 0, height: 0 };
  }

  const width = Math.round(nativeW * displayScale);
  const height = Math.round((width * nativeH) / nativeW);
  return { width, height };
}

/** Scale the video texture to the canvas using video metadata. */
function syncSpriteToDisplay(sprite: Sprite, video: HTMLVideoElement, display: PlaygroundDisplaySize) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw <= 0 || vh <= 0 || display.width <= 0 || display.height <= 0) {
    return;
  }

  sprite.anchor.set(0, 0);
  sprite.position.set(0, 0);
  sprite.scale.set(display.width / vw, display.height / vh);
}

export function createVideoSceneTicker(
  video: HTMLVideoElement,
  displayScale: number,
  stripeOptionsRef: RefObject<StripeDuotoneOptions>,
  stripeColorsRef: RefObject<StripeColors>,
  duotoneEnabledRef: RefObject<boolean>,
  autoplayRef: RefObject<boolean>,
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>,
): Ticker {
  const display = getPlaygroundDisplaySize(video, displayScale);

  return ({ app, cleanup }) => {
    const source = new VideoSource({
      resource: video,
    });
    const texture = new Texture({ source });
    const sprite = new Sprite(texture);
    syncSpriteToDisplay(sprite, video, display);

    const onVideoLayoutChange = () => syncSpriteToDisplay(sprite, video, display);
    video.addEventListener("loadedmetadata", onVideoLayoutChange);
    source.on("resize", onVideoLayoutChange);
    source.on("update", onVideoLayoutChange);

    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleCtx) {
      throw new Error("2D canvas context unavailable for video sampling.");
    }

    const blockGridTexture = new BlockGridTexture(display.width, display.height);
    const stripeFilter = createStripeDuotoneFilter(
      display.width,
      display.height,
      blockGridTexture.texture,
      blockGridTexture.cols,
      blockGridTexture.rows,
      stripeColorsRef.current,
      stripeOptionsRef.current,
    );
    let duotoneActive = duotoneEnabledRef.current;
    sprite.filters = duotoneActive ? [stripeFilter] : null;
    app.stage.addChild(sprite);

    let lastSampledTime = -1;
    let lastOptionsKey = "";
    let lastColorsKey = "";
    let gridState: PlaygroundGridBuildState = {};
    let lastGridUpdateMs = 0;

    const renderTick = () => {
      syncSpriteToDisplay(sprite, video, display);

      const duotoneEnabled = duotoneEnabledRef.current;
      if (duotoneEnabled !== duotoneActive) {
        duotoneActive = duotoneEnabled;
        sprite.filters = duotoneActive ? [stripeFilter] : null;
        if (duotoneActive) {
          lastOptionsKey = "";
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
      const timeChanged = video.currentTime !== lastSampledTime;
      const optionsChanged = optionsKey !== lastOptionsKey;
      const colorsChanged = colorsKey !== lastColorsKey;

      if (colorsChanged) {
        lastColorsKey = colorsKey;
        stripeFilter.syncColors(colors);
      }

      const frame =
        timeChanged && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          ? sampleVideoFrame(video, display.width, display.height, sampleCanvas, sampleCtx)
          : null;

      if (frame) {
        lastSampledTime = video.currentTime;
      }

      const shouldRebuildGrid =
        frame &&
        (optionsChanged || (timeChanged && performance.now() - lastGridUpdateMs >= PLAYGROUND_GRID_UPDATE_INTERVAL_MS));

      if (shouldRebuildGrid && frame) {
        lastOptionsKey = optionsKey;
        lastGridUpdateMs = performance.now();
        if (optionsChanged) {
          gridState = {};
        }

        const built = buildPlaygroundBlockGrid(frame, display.width, display.height, options, gridState);
        gridState = built.state;
        blockGridTexture.update(built.grid);
        stripeFilter.updateBlockMap(blockGridTexture.texture);

        if (exportStateRef) {
          exportStateRef.current = {
            grid: built.grid,
            colors,
            displayWidth: display.width,
            displayHeight: display.height,
          };
        }
      } else if (exportStateRef && gridState.stableWidths) {
        exportStateRef.current = {
          grid: {
            cols: blockGridTexture.cols,
            rows: blockGridTexture.rows,
            widths: gridState.stableWidths,
          },
          colors,
          displayWidth: display.width,
          displayHeight: display.height,
        };
      }

      app.render();
    };
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
      source.off("resize", onVideoLayoutChange);
      source.off("update", onVideoLayoutChange);
      blockGridTexture.destroy();
      sprite.destroy({ children: true });
      texture.destroy(true);
    });
  };
}

/** @deprecated Use {@link createVideoSceneTicker}. */
export const createVideoShaderSceneTicker = createVideoSceneTicker;
