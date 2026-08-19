import { describe, expect, it } from "vitest";
import { LOWER_PAGE_RAIN_NUDGE } from "@/components/stripes-texture/rain-nudge";
import {
  FOOTER_SHADER_CURRENT,
  FOOTER_SHADER_DEFAULTS,
  footerTextureConfigFromSettings,
} from "./footer-shader-controls";

describe("footer shader controls", () => {
  it("keeps the shipped footer texture as Reset defaults", () => {
    expect(FOOTER_SHADER_DEFAULTS.rainEnabled).toBe(false);
    expect(FOOTER_SHADER_DEFAULTS.gridCellWidth).toBe(7);
    expect(FOOTER_SHADER_DEFAULTS.gridAngle).toBe(0);
    expect(FOOTER_SHADER_DEFAULTS.gridOverlap).toBe(1.2);
    expect(FOOTER_SHADER_DEFAULTS.flamesEnabled).toBe(true);
    expect(FOOTER_SHADER_DEFAULTS.engineFramesEnabled).toBe(true);
    expect(FOOTER_SHADER_DEFAULTS.stripes[0].color).toBe("#fafafa");
  });

  it("nudges the current config toward rain without rewriting defaults", () => {
    expect(FOOTER_SHADER_CURRENT.rainEnabled).toBe(true);
    expect(FOOTER_SHADER_CURRENT.gridCellWidth).toBe(LOWER_PAGE_RAIN_NUDGE.gridCellWidth);
    expect(FOOTER_SHADER_CURRENT.gridAngle).toBe(LOWER_PAGE_RAIN_NUDGE.gridAngle);
    expect(FOOTER_SHADER_CURRENT.fieldScale).toBe(LOWER_PAGE_RAIN_NUDGE.fieldScale);
    expect(FOOTER_SHADER_DEFAULTS.rainEnabled).toBe(false);
    expect(FOOTER_SHADER_DEFAULTS.fieldScale).toBe(1);
  });

  it("projects current settings onto the footer engine config", () => {
    const config = footerTextureConfigFromSettings(FOOTER_SHADER_CURRENT);
    expect(config.sparkle?.gaps?.enabled).toBe(true);
    expect(config.grid?.cellWidth).toBe(13);
    expect(config.grid?.angleDeg).toBe(45);
    expect(config.flames?.enabled).toBe(true);
    expect(config.frames?.enabled).toBe(true);
  });
});
