import { describe, expect, it } from "vitest";
import { FOOTER_TEXTURE_CONFIG } from "./texture-config";
import {
  FOOTER_SHADER_CURRENT,
  FOOTER_SHADER_DEFAULTS,
  footerTextureConfigFromSettings,
} from "./footer-shader-controls";

describe("footer shader controls", () => {
  it("ships the authored footer texture as Reset and empty-storage defaults", () => {
    expect(FOOTER_SHADER_DEFAULTS.rainEnabled).toBe(true);
    expect(FOOTER_SHADER_DEFAULTS.gapsCoverage).toBe(0);
    expect(FOOTER_SHADER_DEFAULTS.gridCellWidth).toBe(7);
    expect(FOOTER_SHADER_DEFAULTS.gridCellHeight).toBe(5);
    expect(FOOTER_SHADER_DEFAULTS.gridAngle).toBe(45);
    expect(FOOTER_SHADER_DEFAULTS.gridOverlap).toBe(1.2);
    expect(FOOTER_SHADER_DEFAULTS.fieldScale).toBe(0.25);
    expect(FOOTER_SHADER_DEFAULTS.sparkleWidthCoverage).toBe(0.22);
    expect(FOOTER_SHADER_DEFAULTS.sparkleStripeCoverage).toBe(0.12);
    expect(FOOTER_SHADER_DEFAULTS.flamesEnabled).toBe(true);
    expect(FOOTER_SHADER_DEFAULTS.engineFramesEnabled).toBe(true);
    expect(FOOTER_SHADER_DEFAULTS.stripes[0].color).toBe("#fafafa");
    expect(FOOTER_SHADER_CURRENT).toEqual(FOOTER_SHADER_DEFAULTS);
  });

  it("mirrors those values in the production texture config", () => {
    expect(FOOTER_TEXTURE_CONFIG.sparkle?.gaps?.enabled).toBe(true);
    expect(FOOTER_TEXTURE_CONFIG.grid?.cellHeight).toBe(5);
    expect(FOOTER_TEXTURE_CONFIG.grid?.angleDeg).toBe(45);
    expect(FOOTER_TEXTURE_CONFIG.fieldScale).toBe(0.25);
    expect(FOOTER_TEXTURE_CONFIG.sparkle?.width?.coverage).toBe(0.22);
  });

  it("projects current settings onto the footer engine config", () => {
    const config = footerTextureConfigFromSettings(FOOTER_SHADER_CURRENT);
    expect(config.sparkle?.gaps?.enabled).toBe(true);
    expect(config.grid?.cellWidth).toBe(7);
    expect(config.grid?.cellHeight).toBe(5);
    expect(config.grid?.angleDeg).toBe(45);
    expect(config.fieldScale).toBe(0.25);
    expect(config.flames?.enabled).toBe(true);
    expect(config.frames?.enabled).toBe(true);
  });
});
