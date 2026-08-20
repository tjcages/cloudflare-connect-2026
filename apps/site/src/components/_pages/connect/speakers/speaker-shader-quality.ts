import type { EngineConfig } from "@necatikcl/stripes-engine";
import { SPEAKER_SHADER_CONFIG, SPEAKER_SHADER_MAX_DPR } from "./speaker-shader-config";

/** Desktop overlay loop cap. Matches the previous rAF throttle. */
export const SPEAKER_SHADER_DESKTOP_MAX_FPS = 60;
/**
 * Mobile overlay loop cap. 24fps is enough for the orange/iris intro and
 * drops fill-rate + fragment work enough to keep phones cooler than 30/60.
 */
export const SPEAKER_SHADER_MOBILE_MAX_FPS = 24;
/** 3× phones otherwise spend ~3× the fragment work for no extra stripe detail. */
export const SPEAKER_SHADER_MOBILE_MAX_DPR = 1;

/**
 * Render-gate margin for the speakers canvas. Same rule as footer / shared
 * `<StripesShader>`: any on-screen pixel keeps the last frame; offscreen
 * pauses the loop. Do not reset content here.
 */
export const SPEAKER_SHADER_RENDER_ROOT_MARGIN = "0px";

/**
 * Hydration margin so Astro does not unmount the island the moment the grid
 * leaves the viewport (that would snap portraits back to `opacity-0`).
 * The render loop is still gated at {@link SPEAKER_SHADER_RENDER_ROOT_MARGIN}.
 */
export const SPEAKER_SHADER_HYDRATE_ROOT_MARGIN = "100% 0px";

const NARROW_VIEWPORT_PX = 700;

export type SpeakerShaderQualityInput = {
  coarsePointer: boolean;
  narrowViewport: boolean;
  saveData: boolean;
  reducedMotion: boolean;
};

export type SpeakerShaderQuality = {
  maxDpr: number;
  maxFps: number;
  pauseWhenResting: boolean;
  liveEffects: boolean;
  pointerEffects: boolean;
};

export const readSpeakerShaderSaveData = (connection: { saveData?: boolean } | null | undefined): boolean =>
  Boolean(connection?.saveData);

export const speakerShaderPrefersLowPower = (input: SpeakerShaderQualityInput): boolean =>
  input.saveData || input.coarsePointer || input.narrowViewport;

export const readSpeakerShaderQualityInput = (
  media: { matchMedia: (query: string) => { matches: boolean } },
  connection?: { saveData?: boolean } | null,
): SpeakerShaderQualityInput => ({
  coarsePointer: media.matchMedia("(pointer: coarse)").matches,
  narrowViewport: media.matchMedia(`(max-width: ${NARROW_VIEWPORT_PX}px)`).matches,
  saveData: readSpeakerShaderSaveData(connection),
  reducedMotion: media.matchMedia("(prefers-reduced-motion: reduce)").matches,
});

export const resolveSpeakerShaderQuality = (input: SpeakerShaderQualityInput): SpeakerShaderQuality => {
  if (input.reducedMotion) {
    return {
      maxDpr:
        input.coarsePointer || input.narrowViewport || input.saveData
          ? SPEAKER_SHADER_MOBILE_MAX_DPR
          : SPEAKER_SHADER_MAX_DPR,
      maxFps: 0,
      pauseWhenResting: true,
      liveEffects: false,
      pointerEffects: false,
    };
  }
  if (speakerShaderPrefersLowPower(input)) {
    return {
      maxDpr: SPEAKER_SHADER_MOBILE_MAX_DPR,
      maxFps: SPEAKER_SHADER_MOBILE_MAX_FPS,
      pauseWhenResting: true,
      liveEffects: false,
      pointerEffects: false,
    };
  }
  return {
    maxDpr: SPEAKER_SHADER_MAX_DPR,
    maxFps: SPEAKER_SHADER_DESKTOP_MAX_FPS,
    pauseWhenResting: false,
    liveEffects: true,
    pointerEffects: true,
  };
};

/** Strip per-frame sparkle / frames / trail / flames so a rest overlay can freeze. */
export const speakerLowPowerEngineConfig = (): Partial<EngineConfig> => ({
  sparkle: {
    ...SPEAKER_SHADER_CONFIG.sparkle,
    gaps: { ...SPEAKER_SHADER_CONFIG.sparkle.gaps, enabled: false },
    width: { ...SPEAKER_SHADER_CONFIG.sparkle.width, enabled: false },
    stripe: { ...SPEAKER_SHADER_CONFIG.sparkle.stripe, enabled: false },
    motion: { ...SPEAKER_SHADER_CONFIG.sparkle.motion, enabled: false },
  },
  stripeDots: { ...SPEAKER_SHADER_CONFIG.stripeDots, enabled: false },
  stripeBorder: { ...SPEAKER_SHADER_CONFIG.stripeBorder, enabled: false },
  gridLines: { ...SPEAKER_SHADER_CONFIG.gridLines, enabled: false },
  frames: { ...SPEAKER_SHADER_CONFIG.frames, enabled: false },
  flames: { ...SPEAKER_SHADER_CONFIG.flames, enabled: false },
  cursorTrail: { ...SPEAKER_SHADER_CONFIG.cursorTrail, enabled: false },
  clickWave: { ...SPEAKER_SHADER_CONFIG.clickWave, enabled: false },
  maxFps: SPEAKER_SHADER_MOBILE_MAX_FPS,
});
