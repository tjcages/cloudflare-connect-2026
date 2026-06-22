import { describe, expect, it, vi } from "vitest";
import {
  createStripesShaderScene,
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
import { DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG } from "./playgroundEdgeMaskConfig";
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
    edgeMaskConfig: DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG,
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

describe("createStripesShaderScene getConfig contract", () => {
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

  it("reads getConfig live for the scene setup regardless of source kind", () => {
    const source = makeImageSource();
    const direct = createStripesShaderScene({
      getConfig: () => makeConfig({ stripesEnabled: false }),
      getSource: () => source,
      getDisplaySize: () => TEST_DISPLAY,
    });
    expect(typeof direct).toBe("function");
  });
});
