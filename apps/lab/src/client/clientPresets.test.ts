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

  it("builds from Banner 5:1 with solid white stage and rain off by default", () => {
    const bundle = buildClientPreviewBundle(DEFAULT_CLIENT_PREVIEW_STATE);
    expect(bundle.canvasWidth).toBe(1600);
    expect(bundle.canvasHeight).toBe(320);
    expect(bundle.engineConfig.background?.transparent).toBe(false);
    expect(bundle.engineConfig.background?.color).toBe(0xffffff);
    expect(bundle.engineConfig.sparkle?.gaps?.enabled).toBe(false);
    expect(bundle.twizzler.lineCount).toBe(56);
    expect(bundle.twizzler.lineWidth).toBeCloseTo(1.15);
    expect(bundle.twizzler.color).toBe("#f46021");
    expect(bundle.twizzler.colorFar).toBe("#fea700");
    expect(bundle.twizzler.colorEdge).toBe("#e92e28");
    expect(bundle.twizzler.opacity).toBeCloseTo(1);
    expect(bundle.twizzler.rotateXDeg).toBeCloseTo(12);
    expect(bundle.twizzler.rotateYDeg).toBeCloseTo(-18);
    expect(bundle.twizzler.rotateZDeg).toBeCloseTo(0);
    expect(bundle.twizzler.gradientXEnabled).toBe(true);
    expect(bundle.twizzler.gradientYEnabled).toBe(true);
    expect(bundle.twizzler.gradientZEnabled).toBe(true);
    expect(bundle.twizzler.gradientsEnabled).toBe(true);
    expect(bundle.twizzler.ribbonColorMode).toBe("baked");
    expect(bundle.twizzler.depthTerrain).toBe(0);
  });

  it("toggles rain via sparkle.gaps without exposing camera state", () => {
    const withRain = buildClientPreviewBundle({ ...DEFAULT_CLIENT_PREVIEW_STATE, rainEnabled: true });
    expect(withRain.engineConfig.sparkle?.gaps?.enabled).toBe(true);
    expect(withRain.engineConfig.stripesEnabled).toBe(true);
    expect(JSON.stringify(withRain.engineConfig)).not.toMatch(/rotateX|connectCamera|shaderView/i);

    const noRain = buildClientPreviewBundle({ ...DEFAULT_CLIENT_PREVIEW_STATE, rainEnabled: false });
    expect(noRain.engineConfig.sparkle?.gaps?.enabled).toBe(false);
    expect(noRain.engineConfig.stripesEnabled).toBe(false);
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
    expect(bundle.twizzler.color).toBe("#5c5c5c");
    expect(bundle.twizzler.rotateYDeg).toBeCloseTo(-28);
    expect(bundle.twizzler.centerY).toBeCloseTo(0.38);
  });

  it("lets tweaks override layout/color for standard knobs only", () => {
    const bundle = buildClientPreviewBundle({
      ...DEFAULT_CLIENT_PREVIEW_STATE,
      tweaks: {
        opacity: 0.5,
        scale: 0.9,
        twist: 2,
        rotateXDeg: 20,
        rotateYDeg: -30,
        rotateZDeg: 5,
        amplitude: 0.7,
        centerY: 0.55,
        speed: 0.2,
      },
    });
    expect(bundle.twizzler.opacity).toBeCloseTo(0.5);
    expect(bundle.twizzler.rotateXDeg).toBeCloseTo(20);
    expect(bundle.twizzler.rotateYDeg).toBeCloseTo(-30);
    expect(bundle.twizzler.speed).toBeCloseTo(0.2);
    expect(bundle.twizzler.lineCount).toBe(56);
  });
});
