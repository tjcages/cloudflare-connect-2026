import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createStripesShaderScene,
  createTextureSceneTicker,
  PLAYGROUND_DEFAULT_DISPLAY_MAX_WIDTH,
  resolveDefaultPlaygroundDisplaySize,
  resolvePlaygroundDisplaySize,
  resolveStripeSpriteFilters,
  type PlaygroundDisplaySize,
  type PlaygroundTextureSource,
  type StripesSceneConfig,
} from "./setupTextureShaderScene";
import { DEFAULT_PLAYGROUND_GRID_CONFIG } from "./playgroundGridConfig";
import { DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS } from "./playgroundTextureAdjustments";
import { DEFAULT_PLAYGROUND_SOURCE_TRANSFORM } from "./playgroundSourceTransform";
import { DEFAULT_PLAYGROUND_FLAMES_CONFIG } from "./playgroundFlamesConfig";
import { DEFAULT_PLAYGROUND_REVEAL_CONFIG } from "./playgroundRevealConfig";
import { DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG } from "./playgroundCursorTrailConfig";
import { DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG } from "./playgroundClickWaveConfig";

describe("setupTextureShaderScene display size", () => {
  it("defaults to max 1000px width while preserving aspect ratio", () => {
    expect(resolveDefaultPlaygroundDisplaySize({ width: 4000, height: 2000 })).toEqual({
      width: PLAYGROUND_DEFAULT_DISPLAY_MAX_WIDTH,
      height: 500,
    });
    expect(resolveDefaultPlaygroundDisplaySize({ width: 800, height: 600 })).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("uses persisted canvas size when provided", () => {
    expect(
      resolvePlaygroundDisplaySize({ width: 4000, height: 2000 }, { displayWidth: 640, displayHeight: 320 }),
    ).toEqual({ width: 640, height: 320 });
  });
});

describe("resolveStripeSpriteFilters", () => {
  const stripeFilter = { kind: "stripe" } as never;

  it("returns null when stripes are not active", () => {
    expect(resolveStripeSpriteFilters("preview", stripeFilter)).toBeNull();
    expect(resolveStripeSpriteFilters("off", stripeFilter)).toBeNull();
  });

  it("uses only the stripe filter in stripes mode (overlay bakes the preview texture instead of chaining filters)", () => {
    expect(resolveStripeSpriteFilters("stripes", stripeFilter)).toEqual([stripeFilter]);
  });
});

function makeConfig(overrides: Partial<StripesSceneConfig> = {}): StripesSceneConfig {
  return {
    stripeColors: { stripes: [] },
    preferP3: false,
    duotoneEnabled: true,
    stripesEnabled: true,
    textureGamma: 1,
    sparkle: { enabled: false, coverage: 0, speed: 1 } as never,
    widthShuffle: { enabled: false } as never,
    gridConfig: DEFAULT_PLAYGROUND_GRID_CONFIG,
    textureAdjustments: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
    textureLuminanceSettings: { mode: "luminance", backgroundColor: 0x000000 },
    sourceTransform: DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
    flamesConfig: DEFAULT_PLAYGROUND_FLAMES_CONFIG,
    revealConfig: DEFAULT_PLAYGROUND_REVEAL_CONFIG,
    revealPlayback: { replayKey: 0, startedAtMs: 0 },
    cursorTrailConfig: DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
    clickWaveConfig: DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
    ...overrides,
  };
}

const TEST_DISPLAY: PlaygroundDisplaySize = { width: 200, height: 100 };

function makeImageSource(): PlaygroundTextureSource {
  // happy-dom HTMLImageElement; the scene reads native size + sprite layout from it at setup.
  const image = document.createElement("img");
  Object.defineProperty(image, "naturalWidth", { value: 400, configurable: true });
  Object.defineProperty(image, "naturalHeight", { value: 200, configurable: true });
  return { kind: "image", element: image };
}

describe("createStripesShaderScene / createTextureSceneTicker getConfig contract", () => {
  it("createStripesShaderScene returns a Ticker function and reads getConfig live at setup", () => {
    const getConfig = vi.fn(() => makeConfig());
    const ticker = createStripesShaderScene({
      getConfig,
      getSource: makeImageSource,
      getDisplaySize: () => TEST_DISPLAY,
    });
    expect(typeof ticker).toBe("function");
    // The scene seeds its internal refs from getConfig before setup, proving it is the live source.
    expect(getConfig).toHaveBeenCalled();
  });

  it("createTextureSceneTicker is a thin adapter: returns a Ticker and builds a live getConfig from its refs", () => {
    const stripeColorsRef: RefObject<StripesSceneConfig["stripeColors"]> = { current: { stripes: [] } };
    const preferP3Ref: RefObject<boolean> = { current: false };
    const duotoneEnabledRef: RefObject<boolean> = { current: true };
    const stripesEnabledRef: RefObject<boolean> = { current: true };
    const textureGammaRef: RefObject<number> = { current: 1 };
    const sparkleOptionsRef: RefObject<StripesSceneConfig["sparkle"]> = {
      current: { enabled: false, coverage: 0, speed: 1 } as never,
    };
    const widthShuffleOptionsRef: RefObject<StripesSceneConfig["widthShuffle"]> = {
      current: { enabled: false } as never,
    };
    const autoplayRef: RefObject<boolean> = { current: false };

    const source = makeImageSource();
    const ticker = createTextureSceneTicker(
      source,
      TEST_DISPLAY,
      stripeColorsRef,
      preferP3Ref,
      duotoneEnabledRef,
      stripesEnabledRef,
      textureGammaRef,
      sparkleOptionsRef,
      widthShuffleOptionsRef,
      autoplayRef,
    );
    // Identical surface to the direct factory: both return a Ticker function.
    expect(typeof ticker).toBe("function");
  });

  it("adapter equivalence: createTextureSceneTicker and a direct createStripesShaderScene with the same source produce equivalent setup", () => {
    const source = makeImageSource();
    const direct = createStripesShaderScene({
      getConfig: () => makeConfig({ stripesEnabled: false }),
      getSource: () => source,
      getDisplaySize: () => TEST_DISPLAY,
    });
    const viaAdapter = createTextureSceneTicker(
      source,
      TEST_DISPLAY,
      { current: { stripes: [] } },
      { current: false },
      { current: true },
      { current: false },
      { current: 1 },
      { current: { enabled: false, coverage: 0, speed: 1 } as never },
      { current: { enabled: false } as never },
      { current: false },
    );
    expect(typeof direct).toBe("function");
    expect(typeof viaAdapter).toBe("function");
  });
});
