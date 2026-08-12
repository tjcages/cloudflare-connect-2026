import { describe, expect, it } from "vitest";
import { DEFAULT_LAB_ENGINE_CONFIG } from "../defaultLabConfig";
import {
  sectionGridRainEngineConfig,
  sectionGridRainLabSettingsPatch,
  sectionGridRainLevaPatch,
  sectionGridRainStripes,
} from "./sectionGridRainDefaults";

describe("sectionGridRainDefaults", () => {
  it("exports factory stripes (opaque, multi-band)", () => {
    const stripes = sectionGridRainStripes();
    expect(stripes.length).toBe(DEFAULT_LAB_ENGINE_CONFIG.stripes.length);
    expect(stripes.every((s) => s.opacity > 0)).toBe(true);
    expect(stripes).not.toBe(DEFAULT_LAB_ENGINE_CONFIG.stripes);
  });

  it("leva patch matches section-grid factory grid / gaps / tone", () => {
    const patch = sectionGridRainLevaPatch();
    expect(patch.cellWidth).toBe(7);
    expect(patch.cellHeight).toBe(7);
    expect(patch.orientationAngleDeg).toBe(0);
    expect(patch.gapX).toBe(0);
    expect(patch.gapY).toBe(0);
    expect(patch.sparkleGapsCoverage).toBe(0);
    expect(patch.textureDpr).toBe(DEFAULT_LAB_ENGINE_CONFIG.fieldScale);
    expect(patch.brightness).toBe(DEFAULT_LAB_ENGINE_CONFIG.adjustments.brightness);
    expect(patch.exposure).toBe(DEFAULT_LAB_ENGINE_CONFIG.adjustments.exposure);
    expect(patch.connectCameraDistance).toBeDefined();
    expect(patch.connectSpeed).toBeDefined();
  });

  it("lab settings patch selects Connect spiral", () => {
    const lab = sectionGridRainLabSettingsPatch();
    expect(lab.shaderPresetId).toBe("connect");
    expect(lab.textureSourceMode).toBe("shader");
    expect(lab.connectShapeType).toBe("spiral");
    expect(lab.connectShaderParams).toBeTruthy();
  });

  it("engine config clone matches factory rain", () => {
    const config = sectionGridRainEngineConfig();
    expect(config.grid.cellWidth).toBe(7);
    expect(config.grid.angleDeg).toBe(0);
    expect(config.sparkle.gaps.coverage).toBe(0);
    expect(config).not.toBe(DEFAULT_LAB_ENGINE_CONFIG);
  });
});
