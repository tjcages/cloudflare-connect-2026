import { createStripesEngine } from "@necatikcl/stripes-engine";
import { describe, expect, it } from "vitest";
import { SPEAKER_FRAME_DEFAULTS } from "./speaker-frame-controls";
import { SPEAKER_SHADER_CONFIG, SPEAKER_SHADER_MAX_DPR } from "./speaker-shader-config";

describe("speaker shader production contract", () => {
  it("uses the single imperative engine API", () => {
    expect(createStripesEngine).toBeTypeOf("function");
  });

  it("keeps authored interaction and reveal features enabled", () => {
    expect(SPEAKER_SHADER_CONFIG.frames.enabled).toBe(true);
    expect(SPEAKER_SHADER_CONFIG.cursorTrail.enabled).toBe(true);
    expect(SPEAKER_SHADER_CONFIG.clickWave.enabled).toBe(true);
    expect(SPEAKER_SHADER_CONFIG.reveal.type).toBe("water");
    expect(SPEAKER_SHADER_MAX_DPR).toBe(1.75);
  });

  it("omits legacy frame controls that the current engine no longer accepts", () => {
    const frames = SPEAKER_SHADER_CONFIG.frames as Record<string, unknown>;
    expect(frames).not.toHaveProperty("strokeWidthPx");
    expect(frames).not.toHaveProperty("cornerSizePx");
    expect(frames).not.toHaveProperty("dashLengthPx");
    expect(frames).not.toHaveProperty("dashGapPx");
  });

  it("projects the authored grid and stripe palette into editable panel defaults", () => {
    expect(SPEAKER_FRAME_DEFAULTS.gridCellWidth).toBe(SPEAKER_SHADER_CONFIG.grid.cellWidth);
    expect(SPEAKER_FRAME_DEFAULTS.gridCellHeight).toBe(SPEAKER_SHADER_CONFIG.grid.cellHeight);
    expect(SPEAKER_FRAME_DEFAULTS.grey.stripes).toHaveLength(SPEAKER_SHADER_CONFIG.stripes.length);
    expect(SPEAKER_FRAME_DEFAULTS.grey.stripes[0]).toMatchObject({
      startFrom: SPEAKER_SHADER_CONFIG.stripes[0].startFrom,
      width: SPEAKER_SHADER_CONFIG.stripes[0].width,
      opacity: SPEAKER_SHADER_CONFIG.stripes[0].opacity,
    });
    expect(SPEAKER_FRAME_DEFAULTS.orange.stripes[0]).toMatchObject({
      color: "#fc682b",
      startFrom: 0,
      width: 0.5,
      opacity: 1,
    });
    expect(SPEAKER_SHADER_CONFIG.stripes[0].opacity).toBe(0.41);
    expect(SPEAKER_SHADER_CONFIG.grid.angleDeg).toBe(45);
    expect(SPEAKER_FRAME_DEFAULTS.dark.stripes[0]).toMatchObject({
      color: "#261106",
      startFrom: 0,
      width: 0.5,
      opacity: 1,
    });
    expect(SPEAKER_FRAME_DEFAULTS.dark.grid).toMatchObject({
      cellWidth: 7,
      cellHeight: 7,
      gapX: 0,
      gapY: 0,
      angleDeg: 0,
      overlapAmount: 1.2,
      fieldScale: 1,
    });
    expect(SPEAKER_FRAME_DEFAULTS.orange.grid).toMatchObject({
      cellWidth: 7,
      cellHeight: 7,
      angleDeg: 0,
      overlapAmount: 1.2,
      fieldScale: 1,
    });
  });

  it("keeps render, tone, and stripe-detail controls aligned with the production config", () => {
    expect(SPEAKER_FRAME_DEFAULTS.renderMode).toBe(SPEAKER_SHADER_CONFIG.renderMode);
    expect(SPEAKER_FRAME_DEFAULTS.orange.brightness).toBe(SPEAKER_SHADER_CONFIG.adjustments.brightness);
    expect(SPEAKER_FRAME_DEFAULTS.sparkleStripeCoverage).toBe(SPEAKER_SHADER_CONFIG.sparkle.stripe.coverage);
    expect(SPEAKER_FRAME_DEFAULTS.dotsDensity).toBe(SPEAKER_SHADER_CONFIG.stripeDots.density);
    expect(SPEAKER_FRAME_DEFAULTS.stripeBlendMode).toBe(SPEAKER_SHADER_CONFIG.colors.stripeBlendMode);
  });
});
