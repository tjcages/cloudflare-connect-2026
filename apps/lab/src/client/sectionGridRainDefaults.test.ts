import { describe, expect, it } from "vitest";
import { DEFAULT_LAB_ENGINE_CONFIG } from "../defaultLabConfig";
import { DEFAULT_LAB_SETTINGS } from "../persistence";
import {
  buildSectionGridRainPreset,
  rainEngineNeedsFactorySeed,
  sectionGridRainEditableStripes,
  sectionGridRainEngineConfig,
  sectionGridRainEnterLevaPatch,
  sectionGridRainStripes,
} from "./sectionGridRainDefaults";

describe("sectionGridRainDefaults", () => {
  it("uses factoryDefaults engine verbatim (opaque multi-band, 7×7 / 0°)", () => {
    const config = sectionGridRainEngineConfig();
    expect(config.grid?.cellWidth).toBe(DEFAULT_LAB_ENGINE_CONFIG.grid.cellWidth);
    expect(config.grid?.cellHeight).toBe(DEFAULT_LAB_ENGINE_CONFIG.grid.cellHeight);
    expect(config.grid?.angleDeg).toBe(DEFAULT_LAB_ENGINE_CONFIG.grid.angleDeg);
    expect(config.adjustments?.brightness).toBe(DEFAULT_LAB_ENGINE_CONFIG.adjustments.brightness);
    expect(config.fieldScale).toBe(DEFAULT_LAB_ENGINE_CONFIG.fieldScale);
    expect(config.stripes).toEqual(DEFAULT_LAB_ENGINE_CONFIG.stripes);
    expect(config.sparkle?.gaps?.enabled).toBe(true);
    expect(config.sparkle?.gaps?.coverage).toBe(DEFAULT_LAB_ENGINE_CONFIG.sparkle.gaps.coverage);
    expect(config).not.toBe(DEFAULT_LAB_ENGINE_CONFIG);
  });

  it("exports factory stripes", () => {
    const stripes = sectionGridRainStripes();
    expect(stripes).toEqual(DEFAULT_LAB_ENGINE_CONFIG.stripes);
    expect(stripes.every((s) => s.opacity > 0)).toBe(true);
  });

  it("enter-Rain Leva patch uses continuous gaps (not Banner blank coverage)", () => {
    const patch = sectionGridRainEnterLevaPatch();
    expect(patch.shader.sparkleGapsCoverage).toBe(DEFAULT_LAB_ENGINE_CONFIG.sparkle.gaps.coverage * 100);
    expect(patch.shader.sparkleGapsCoverage).toBe(0);
    expect(patch.shader.cellWidth).toBe(DEFAULT_LAB_ENGINE_CONFIG.grid.cellWidth);
    expect(patch.shader.orientationRotationMode).toBe(DEFAULT_LAB_ENGINE_CONFIG.grid.rotationMode);
    expect(patch.shader.stripeBlendMode).toBe(DEFAULT_LAB_ENGINE_CONFIG.colors.stripeBlendMode);
    expect(patch.texture.textureDpr).toBe(DEFAULT_LAB_ENGINE_CONFIG.fieldScale);
  });

  it("seeds Banner-blank rain and keeps authored multi-band rain (CF-76)", () => {
    expect(
      rainEngineNeedsFactorySeed({
        stripes: [{ opacity: 0 }],
        coverage: 1,
      }),
    ).toBe(true);
    expect(
      rainEngineNeedsFactorySeed({
        stripes: DEFAULT_LAB_ENGINE_CONFIG.stripes,
        coverage: DEFAULT_LAB_ENGINE_CONFIG.sparkle.gaps.coverage,
      }),
    ).toBe(false);
    expect(sectionGridRainEditableStripes().length).toBe(DEFAULT_LAB_ENGINE_CONFIG.stripes.length);
    expect(sectionGridRainEditableStripes().every((stripe) => stripe.opacity > 0)).toBe(true);
  });

  it("builds a Factory-reset-equivalent preset for Rain / Both", () => {
    const rain = buildSectionGridRainPreset("rain");
    expect(rain.kind).toBe("stripes-engine-lab-settings");
    expect(rain.config.grid?.cellWidth).toBe(7);
    expect(rain.config.sparkle?.gaps?.enabled).toBe(true);
    expect(rain.lab?.shaderPresetId).toBe("spiral");
    expect(rain.lab?.shaderPresetId).toBe(DEFAULT_LAB_SETTINGS.shaderPresetId);
    expect(rain.lab?.twizzlerEnabled).toBe(false);
    expect(rain.lab?.connectShapeType).toBe(DEFAULT_LAB_SETTINGS.connectShapeType);
    expect(rain.lab?.connectCameraDistance).toBe(DEFAULT_LAB_SETTINGS.connectCameraDistance);

    const both = buildSectionGridRainPreset("both", { canvasWidth: 1600, canvasHeight: 320 });
    expect(both.lab?.twizzlerEnabled).toBe(true);
    expect(both.lab?.canvasWidth).toBe(1600);
    expect(both.config.sparkle?.gaps?.enabled).toBe(true);
  });
});
