import { describe, expect, it } from "vitest";
import { LOWER_PAGE_RAIN_NUDGE } from "@/components/stripes-texture/rain-nudge";
import { CTA_COMET_LOGO_SETTINGS } from "./texture-config";
import {
  CTA_SHADER_CURRENT,
  CTA_SHADER_DEFAULTS,
  cometSettingsFromCta,
  ctaTextureConfigFromSettings,
} from "./cta-shader-controls";

describe("cta shader controls", () => {
  it("keeps the shipped comet CTA as Reset defaults", () => {
    expect(CTA_SHADER_DEFAULTS.rainEnabled).toBe(false);
    expect(CTA_SHADER_DEFAULTS.gridCellWidth).toBe(7);
    expect(CTA_SHADER_DEFAULTS.gridCellHeight).toBe(7);
    expect(CTA_SHADER_DEFAULTS.gridAngle).toBe(0);
    expect(CTA_SHADER_DEFAULTS.fieldScale).toBe(1);
    expect(CTA_SHADER_DEFAULTS.sparkleWidthCoverage).toBe(0.5);
    expect(CTA_SHADER_DEFAULTS.fieldSpeed).toBe(CTA_COMET_LOGO_SETTINGS.fieldSpeed);
    expect(CTA_SHADER_DEFAULTS.stripes).toHaveLength(10);
    expect(CTA_SHADER_DEFAULTS.stripes[0].color).toBe("#f5f5f5");
  });

  it("nudges the current config toward rain without rewriting defaults", () => {
    expect(CTA_SHADER_CURRENT.rainEnabled).toBe(true);
    expect(CTA_SHADER_CURRENT.gridCellWidth).toBe(LOWER_PAGE_RAIN_NUDGE.gridCellWidth);
    expect(CTA_SHADER_CURRENT.gridCellHeight).toBe(LOWER_PAGE_RAIN_NUDGE.gridCellHeight);
    expect(CTA_SHADER_CURRENT.gridGapX).toBe(LOWER_PAGE_RAIN_NUDGE.gridGapX);
    expect(CTA_SHADER_CURRENT.gridAngle).toBe(LOWER_PAGE_RAIN_NUDGE.gridAngle);
    expect(CTA_SHADER_CURRENT.fieldScale).toBe(LOWER_PAGE_RAIN_NUDGE.fieldScale);
    expect(CTA_SHADER_DEFAULTS.rainEnabled).toBe(false);
    expect(CTA_SHADER_DEFAULTS.gridAngle).toBe(0);
    expect(CTA_SHADER_DEFAULTS.fieldScale).toBe(1);
  });

  it("projects current settings onto the comet-logo engine config", () => {
    const config = ctaTextureConfigFromSettings(CTA_SHADER_CURRENT);
    expect(config.sparkle?.gaps?.enabled).toBe(true);
    expect(config.grid?.cellWidth).toBe(13);
    expect(config.grid?.angleDeg).toBe(45);
    expect(config.fieldScale).toBe(0.25);
    expect(config.stripes?.[0].color).toBe(0xf5f5f5);
    const comet = cometSettingsFromCta(CTA_SHADER_CURRENT);
    expect(comet.logoScale).toBe(CTA_COMET_LOGO_SETTINGS.logoScale);
    expect(comet.fieldSpeed).toBe(CTA_COMET_LOGO_SETTINGS.fieldSpeed);
  });
});
