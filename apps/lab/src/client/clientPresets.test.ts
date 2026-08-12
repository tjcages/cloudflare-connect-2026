import { describe, expect, it } from "vitest";
import {
  buildClientPreviewBundle,
  CLIENT_COLOR_PRESETS,
  CLIENT_LAYOUT_PRESETS,
  CLIENT_SIZE_PRESETS,
  DEFAULT_CLIENT_PREVIEW_STATE,
  findClientColorPreset,
  findClientLayoutPreset,
  findClientSizePreset,
  resetTweaksForPresets,
} from "./clientPresets";

describe("client preview presets", () => {
  it("ships size, layout, and color preset catalogs", () => {
    expect(CLIENT_SIZE_PRESETS.map((p) => p.id)).toEqual(["banner-5x1", "wide-3x1", "hero-16x9", "square"]);
    expect(CLIENT_LAYOUT_PRESETS).toHaveLength(4);
    expect(CLIENT_COLOR_PRESETS).toHaveLength(4);
  });

  it("builds from Banner 5:1 with transparent WebGL and rain off by default", () => {
    const bundle = buildClientPreviewBundle(DEFAULT_CLIENT_PREVIEW_STATE);
    expect(bundle.canvasWidth).toBe(1600);
    expect(bundle.canvasHeight).toBe(320);
    expect(bundle.engineConfig.background?.transparent).toBe(true);
    expect(bundle.engineConfig.sparkle?.gaps?.enabled).toBe(false);
    expect(bundle.twizzler.lineCount).toBe(240);
    expect(bundle.twizzler.opacity).toBeCloseTo(0.88);
  });

  it("toggles rain via sparkle.gaps without exposing camera state", () => {
    const withRain = buildClientPreviewBundle({ ...DEFAULT_CLIENT_PREVIEW_STATE, rainEnabled: true });
    expect(withRain.engineConfig.sparkle?.gaps?.enabled).toBe(true);
    expect(JSON.stringify(withRain.engineConfig)).not.toMatch(/rotateX|connectCamera|shaderView/i);
  });

  it("applies size, layout, and color overlays", () => {
    const size = findClientSizePreset("square");
    const layout = findClientLayoutPreset("high-fan");
    const color = findClientColorPreset("graphite");
    const bundle = buildClientPreviewBundle({
      ...DEFAULT_CLIENT_PREVIEW_STATE,
      sizeId: size.id,
      layoutId: layout.id,
      colorId: color.id,
      tweaks: resetTweaksForPresets(layout.id, color.id),
    });
    expect(bundle.canvasWidth).toBe(800);
    expect(bundle.canvasHeight).toBe(800);
    expect(bundle.twizzler.color).toBe("#4a4a4a");
    expect(bundle.twizzler.depthSpread).toBeGreaterThan(1.2);
  });

  it("lets tweaks override layout/color for standard knobs only", () => {
    const bundle = buildClientPreviewBundle({
      ...DEFAULT_CLIENT_PREVIEW_STATE,
      tweaks: {
        opacity: 0.5,
        scale: 0.9,
        twist: 2,
        amplitude: 0.7,
        centerY: 0.55,
        speed: 0.2,
      },
    });
    expect(bundle.twizzler.opacity).toBeCloseTo(0.5);
    expect(bundle.twizzler.twist).toBeCloseTo(2);
    expect(bundle.twizzler.speed).toBeCloseTo(0.2);
    expect(bundle.twizzler.lineCount).toBe(240);
  });
});
