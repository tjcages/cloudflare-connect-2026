import { createStripesEngine } from "@necatikcl/stripes-engine";
import { describe, expect, it } from "vitest";
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
});
