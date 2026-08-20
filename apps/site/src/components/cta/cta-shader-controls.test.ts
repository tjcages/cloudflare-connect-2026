import { describe, expect, it } from "vitest";
import { CTA_COMET_LOGO_SETTINGS, CTA_TEXTURE_CONFIG } from "./texture-config";
import {
  CTA_SHADER_CURRENT,
  CTA_SHADER_DEFAULTS,
  cometSettingsFromCta,
  ctaTextureConfigFromSettings,
} from "./cta-shader-controls";

describe("cta shader controls", () => {
  it("ships the authored comet CTA as Reset and empty-storage defaults", () => {
    expect(CTA_SHADER_DEFAULTS.rainEnabled).toBe(true);
    expect(CTA_SHADER_DEFAULTS.gapsCoverage).toBe(0);
    expect(CTA_SHADER_DEFAULTS.gridCellWidth).toBe(7);
    expect(CTA_SHADER_DEFAULTS.gridCellHeight).toBe(6);
    expect(CTA_SHADER_DEFAULTS.gridAngle).toBe(45);
    expect(CTA_SHADER_DEFAULTS.gridOverlap).toBe(1.2);
    expect(CTA_SHADER_DEFAULTS.fieldScale).toBe(0.25);
    expect(CTA_SHADER_DEFAULTS.brightness).toBe(0.03);
    expect(CTA_SHADER_DEFAULTS.sparkleWidthCoverage).toBe(0.22);
    expect(CTA_SHADER_DEFAULTS.sparkleStripeCoverage).toBe(0.12);
    expect(CTA_SHADER_DEFAULTS.fieldSpeed).toBe(CTA_COMET_LOGO_SETTINGS.fieldSpeed);
    expect(CTA_SHADER_DEFAULTS.stripes).toHaveLength(10);
    expect(CTA_SHADER_DEFAULTS.stripes[0].color).toBe("#f5f5f5");
    expect(CTA_SHADER_CURRENT).toEqual(CTA_SHADER_DEFAULTS);
  });

  it("mirrors those values in the production texture config", () => {
    expect(CTA_TEXTURE_CONFIG.sparkle?.gaps?.enabled).toBe(true);
    expect(CTA_TEXTURE_CONFIG.grid?.cellHeight).toBe(6);
    expect(CTA_TEXTURE_CONFIG.grid?.angleDeg).toBe(45);
    expect(CTA_TEXTURE_CONFIG.fieldScale).toBe(0.25);
    expect(CTA_TEXTURE_CONFIG.adjustments?.brightness).toBe(0.03);
    expect(CTA_TEXTURE_CONFIG.sparkle?.width?.coverage).toBe(0.22);
  });

  it("projects current settings onto the comet-logo engine config", () => {
    const config = ctaTextureConfigFromSettings(CTA_SHADER_CURRENT);
    expect(config.sparkle?.gaps?.enabled).toBe(true);
    expect(config.grid?.cellWidth).toBe(7);
    expect(config.grid?.cellHeight).toBe(6);
    expect(config.grid?.angleDeg).toBe(45);
    expect(config.fieldScale).toBe(0.25);
    expect(config.stripes?.[0].color).toBe(0xf5f5f5);
    const comet = cometSettingsFromCta(CTA_SHADER_CURRENT);
    expect(comet.logoScale).toBe(CTA_COMET_LOGO_SETTINGS.logoScale);
    expect(comet.fieldSpeed).toBe(CTA_COMET_LOGO_SETTINGS.fieldSpeed);
  });
});
