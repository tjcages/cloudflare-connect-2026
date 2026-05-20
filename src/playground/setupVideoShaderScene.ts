import { Sprite, Texture, VideoSource } from "pixi.js";
import type { RefObject } from "react";
import type { Ticker } from "../components/pixi";
import { bgWhiteness, sampleReferenceWhitenessFromFrame } from "./colorWhiteness";
import { BlockGridTexture } from "./blockGridTexture";
import { computeBlockGrid } from "./computeBlockGrid";
import { createStripeDuotoneFilter } from "./stripeDuotoneFilter";
import type { StripeColors } from "./stripeColors";
import type { StripeDuotoneOptions } from "./stripeFilterOptions";

/** Canvas / Pixi logical size relative to native video (video is scaled to fit this). */
export const PLAYGROUND_DISPLAY_SCALE = 0.5;

/** When false, VideoPlayground shows a native HTML video preview instead of Pixi. */
export const PLAYGROUND_STRIPE_FILTER_ENABLED = true;

/** Pixi resolution for the playground canvas (1 keeps filter pixels aligned with CPU grid). */
export const PLAYGROUND_PIXI_RESOLUTION = 1;

export type PlaygroundDisplaySize = { width: number; height: number };

/** Half native size; height derived from width so aspect ratio stays exact. */
export function getPlaygroundDisplaySize(video: HTMLVideoElement): PlaygroundDisplaySize {
  const nativeW = video.videoWidth;
  const nativeH = video.videoHeight;
  if (nativeW <= 0 || nativeH <= 0) {
    return { width: 0, height: 0 };
  }

  const width = Math.round(nativeW * PLAYGROUND_DISPLAY_SCALE);
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

export function createVideoShaderSceneTicker(
  video: HTMLVideoElement,
  stripeOptionsRef: RefObject<StripeDuotoneOptions>,
  stripeColorsRef: RefObject<StripeColors>,
): Ticker {
  const display = getPlaygroundDisplaySize(video);

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
    sampleCanvas.width = display.width;
    sampleCanvas.height = display.height;
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
    sprite.filters = [stripeFilter];
    app.stage.addChild(sprite);

    let lastSampledTime = -1;
    let lastOptionsKey = "";
    let lastColorsKey = "";
    let cachedFrame: ImageData | null = null;

    const renderTick = () => {
      syncSpriteToDisplay(sprite, video, display);

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

      if (timeChanged && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        lastSampledTime = video.currentTime;
        sampleCtx.drawImage(video, 0, 0, display.width, display.height);
        cachedFrame = sampleCtx.getImageData(0, 0, display.width, display.height);
      }

      if (cachedFrame && (timeChanged || optionsChanged)) {
        lastOptionsKey = optionsKey;
        const cornerWhiteness = sampleReferenceWhitenessFromFrame(cachedFrame.data, display.width, display.height);
        const grid = computeBlockGrid(cachedFrame.data, display.width, display.height, {
          ...options,
          referenceWhiteness: Math.max(bgWhiteness(options.ignoreColorRgb), cornerWhiteness),
        });
        blockGridTexture.update(grid);
        stripeFilter.updateBlockMap(blockGridTexture.texture);
      }

      app.render();
    };
    app.ticker.add(renderTick);

    void video.play().catch(() => {
      // Autoplay may require a user gesture even when muted.
    });

    cleanup(() => {
      app.ticker.remove(renderTick);
      video.removeEventListener("loadedmetadata", onVideoLayoutChange);
      source.off("resize", onVideoLayoutChange);
      source.off("update", onVideoLayoutChange);
      video.pause();
      video.removeAttribute("src");
      video.load();
      blockGridTexture.destroy();
      sprite.destroy({ children: true });
      texture.destroy(true);
    });
  };
}
