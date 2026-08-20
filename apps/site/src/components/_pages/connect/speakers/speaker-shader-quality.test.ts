import { describe, expect, it } from "vitest";
import { SPEAKER_SHADER_CONFIG, SPEAKER_SHADER_MAX_DPR } from "./speaker-shader-config";
import {
  readSpeakerShaderQualityInput,
  readSpeakerShaderSaveData,
  resolveSpeakerShaderQuality,
  speakerLowPowerEngineConfig,
  speakerShaderPrefersLowPower,
  SPEAKER_SHADER_DESKTOP_MAX_FPS,
  SPEAKER_SHADER_HYDRATE_ROOT_MARGIN,
  SPEAKER_SHADER_MOBILE_MAX_DPR,
  SPEAKER_SHADER_MOBILE_MAX_FPS,
  SPEAKER_SHADER_RENDER_ROOT_MARGIN,
} from "./speaker-shader-quality";

describe("speaker shader quality", () => {
  it("keeps rest overlays mounted with a wide hydrate margin and a tight render gate", () => {
    expect(SPEAKER_SHADER_RENDER_ROOT_MARGIN).toBe("0px");
    expect(SPEAKER_SHADER_HYDRATE_ROOT_MARGIN).toBe("100% 0px");
  });

  it("treats coarse pointers, narrow viewports, and save-data as low power", () => {
    expect(
      speakerShaderPrefersLowPower({
        coarsePointer: false,
        narrowViewport: false,
        saveData: false,
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(
      speakerShaderPrefersLowPower({
        coarsePointer: true,
        narrowViewport: false,
        saveData: false,
        reducedMotion: false,
      }),
    ).toBe(true);
    expect(
      speakerShaderPrefersLowPower({
        coarsePointer: false,
        narrowViewport: true,
        saveData: false,
        reducedMotion: false,
      }),
    ).toBe(true);
    expect(readSpeakerShaderSaveData({ saveData: true })).toBe(true);
    expect(readSpeakerShaderSaveData(undefined)).toBe(false);
  });

  it("caps mobile to 1× DPR / 24fps, freezes rest, and disables live effects", () => {
    const mobile = resolveSpeakerShaderQuality({
      coarsePointer: true,
      narrowViewport: true,
      saveData: false,
      reducedMotion: false,
    });
    expect(mobile).toEqual({
      maxDpr: SPEAKER_SHADER_MOBILE_MAX_DPR,
      maxFps: SPEAKER_SHADER_MOBILE_MAX_FPS,
      pauseWhenResting: true,
      liveEffects: false,
      pointerEffects: false,
    });
    expect(SPEAKER_SHADER_MOBILE_MAX_DPR).toBe(1);
    expect(SPEAKER_SHADER_MOBILE_MAX_FPS).toBe(24);

    const desktop = resolveSpeakerShaderQuality({
      coarsePointer: false,
      narrowViewport: false,
      saveData: false,
      reducedMotion: false,
    });
    expect(desktop).toEqual({
      maxDpr: SPEAKER_SHADER_MAX_DPR,
      maxFps: SPEAKER_SHADER_DESKTOP_MAX_FPS,
      pauseWhenResting: false,
      liveEffects: true,
      pointerEffects: true,
    });
  });

  it("reads media and network hints from the environment", () => {
    const media = {
      matchMedia: (query: string) => ({
        matches: query.includes("pointer: coarse") || query.includes("max-width"),
      }),
    };
    expect(readSpeakerShaderQualityInput(media, { saveData: true })).toEqual({
      coarsePointer: true,
      narrowViewport: true,
      saveData: true,
      reducedMotion: false,
    });
  });

  it("turns off sparkle, decorative frames, flames, and pointer FX for the rest blit", () => {
    const config = speakerLowPowerEngineConfig();
    expect(config.sparkle?.width.enabled).toBe(false);
    expect(config.sparkle?.stripe.enabled).toBe(false);
    expect(config.stripeDots?.enabled).toBe(false);
    expect(config.frames?.enabled).toBe(false);
    expect(config.flames?.enabled).toBe(false);
    expect(config.cursorTrail?.enabled).toBe(false);
    expect(config.clickWave?.enabled).toBe(false);
    expect(config.maxFps).toBe(SPEAKER_SHADER_MOBILE_MAX_FPS);
    expect(SPEAKER_SHADER_CONFIG.sparkle.width.enabled).toBe(true);
  });
});
