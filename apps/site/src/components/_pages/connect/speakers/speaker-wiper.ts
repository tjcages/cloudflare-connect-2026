import type { EngineConfig } from "@necatikcl/stripes-engine";
import {
  hexToColorNumber,
  speakerVariantBgNumber,
  speakerVariantEngineConfig,
  type SpeakerFrameSettings,
  type SpeakerFrameVariantId,
} from "./speaker-frame-controls";
import { SPEAKER_SHADER_CONFIG } from "./speaker-shader-config";
import type { Rect } from "./speaker-shader-geometry";

/** Rest width of the orange pane, as a fraction of the portrait. */
export const SPEAKER_WIPER_REST_WIDTH = 0.2;
export const SPEAKER_OVERLAY_REST_WIDTH = 0.8;
/** Collapse from full-width coverage into the rest rect. */
export const SPEAKER_WIPER_DURATION_MS = 900;
export const SPEAKER_WIPER_STAGGER_MS = 0;
/** Hold full coverage until the water reveal has played. */
export const SPEAKER_WIPER_SHADER_DELAY_MS = SPEAKER_SHADER_CONFIG.reveal.water.durationMs;
/** Portrait fade sits in the middle of the collapse. */
export const SPEAKER_IMAGE_FADE_START = 0.4;
export const SPEAKER_IMAGE_FADE_END = 0.7;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const unusedVariant = (value: never): never => {
  throw new Error(`Unhandled speaker frame variant: ${String(value)}`);
};

export const speakerWiperStaggerMs = (variant: SpeakerFrameVariantId): number => {
  switch (variant) {
    case "grey":
    case "orange":
      return 0;
    default:
      return unusedVariant(variant);
  }
};

export const speakerWiperProgress = (elapsedMs: number, staggerMs: number): number => {
  const local = elapsedMs - staggerMs;
  return clamp01(local / SPEAKER_WIPER_DURATION_MS);
};

export const speakerPortraitOpacity = (progress: number): number => {
  if (progress <= SPEAKER_IMAGE_FADE_START) return 0;
  if (progress >= SPEAKER_IMAGE_FADE_END) return 1;
  return easeOutCubic((progress - SPEAKER_IMAGE_FADE_START) / (SPEAKER_IMAGE_FADE_END - SPEAKER_IMAGE_FADE_START));
};

/**
 * The authored frame itself is the wiper: it starts covering the portrait at
 * full width, then settles into its rest rect (orange on the right edge).
 */
export const speakerFrameWiperRect = (aperture: Rect, rest: Rect, progress: number): Rect => {
  if (aperture.width <= 0 || rest.height <= 0) {
    return { x: aperture.x, y: rest.y, width: 0, height: rest.height };
  }

  if (progress <= 0) {
    return { x: aperture.x, y: rest.y, width: aperture.width, height: rest.height };
  }

  const u = easeOutCubic(Math.min(1, progress));
  return {
    x: lerp(aperture.x, rest.x, u),
    y: rest.y,
    width: lerp(aperture.width, rest.width, u),
    height: rest.height,
  };
};

const frameElapsedMs = (
  imageIndex: number,
  startedAtMs: readonly (number | null)[],
  nowMs: number,
  options: { reducedMotion?: boolean; progressOverride?: number },
): number | null => {
  const override = options.progressOverride;
  const hasOverride = typeof override === "number" && Number.isFinite(override);
  if (hasOverride) {
    return override * (SPEAKER_WIPER_DURATION_MS + SPEAKER_WIPER_STAGGER_MS);
  }
  const startedAt = startedAtMs[imageIndex];
  if (startedAt == null) return null;
  return nowMs - startedAt;
};

const frameProgress = (
  elapsedMs: number,
  variant: SpeakerFrameVariantId,
  options: { reducedMotion?: boolean; progressOverride?: number },
): number => {
  if (options.reducedMotion) return 1;
  return speakerWiperProgress(elapsedMs, speakerWiperStaggerMs(variant));
};

type WipingFrame = {
  imageIndex: number;
  rect: Rect;
  variant: SpeakerFrameVariantId;
};

/** Animates each authored frame from full-width coverage to its rest rect. */
export const resolveWipingFrames = <T extends WipingFrame>(
  authored: readonly T[],
  apertures: readonly Rect[],
  startedAtMs: readonly (number | null)[],
  nowMs: number,
  options: { reducedMotion?: boolean; progressOverride?: number } = {},
): T[] => {
  const frames: T[] = [];

  for (const frame of authored) {
    const aperture = apertures[frame.imageIndex];
    if (!aperture) continue;
    const elapsedMs = frameElapsedMs(frame.imageIndex, startedAtMs, nowMs, options);
    if (elapsedMs == null) continue;
    const progress = frameProgress(elapsedMs, frame.variant, options);
    const rect = speakerFrameWiperRect(aperture, frame.rect, progress);
    if (rect.width < 0.5) continue;
    frames.push({ ...frame, rect });
  }

  return frames;
};

export const speakerFramePaintConfig = (
  settings: SpeakerFrameSettings,
  variant: SpeakerFrameVariantId,
): Partial<EngineConfig> => {
  const base = speakerVariantEngineConfig(settings, variant);
  const color = speakerVariantBgNumber(settings, variant);
  const background = {
    ...SPEAKER_SHADER_CONFIG.background,
    color,
    stars: { ...SPEAKER_SHADER_CONFIG.background.stars, enabled: false },
    meteors: { ...SPEAKER_SHADER_CONFIG.background.meteors, enabled: false },
  };
  switch (variant) {
    case "orange":
      return { ...base, background };
    case "grey":
      return { ...base, background: { ...background, transparent: true } };
    default:
      return unusedVariant(variant);
  }
};

export const speakerFrameOutlineColor = (hex: string, opacity: number) => {
  const color = hexToColorNumber(hex, 0xd6_d6_d6);
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const parseSpeakerWiperOverride = (search: string): number | undefined => {
  const raw = new URLSearchParams(search).get("speakerWiper");
  if (raw == null || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) return undefined;
  return clamp01(value);
};

export const SPEAKER_WIPER_ENTER_RATIO = 0.28;

/** True once a portrait is far enough on-screen to start (or resume) its wipe. */
export const speakerWiperShouldEnter = (intersectionRatio: number) =>
  intersectionRatio >= SPEAKER_WIPER_ENTER_RATIO;

export type SpeakerWiperClock = {
  startedAtMs: (number | null)[];
  pending: Set<number>;
};

/**
 * Arm a portrait wipe only after its image can be painted. The start timestamp
 * stays pending until the next animation frame so shader init cannot eat the clip.
 */
export const armSpeakerWiper = (
  clock: SpeakerWiperClock,
  index: number,
  options: { imageReady: boolean; reducedMotion: boolean; nowMs: number },
): "pending-image" | "already-started" | "armed" | "rest" => {
  if (clock.startedAtMs[index] != null || clock.pending.has(index)) return "already-started";
  if (!options.imageReady) return "pending-image";
  if (options.reducedMotion) {
    clock.startedAtMs[index] = options.nowMs;
    return "rest";
  }
  clock.pending.add(index);
  return "armed";
};

export const commitPendingSpeakerWipers = (clock: SpeakerWiperClock, nowMs: number, delayMs = 0) => {
  const startAt = nowMs + Math.max(0, delayMs);
  for (const index of clock.pending) {
    if (clock.startedAtMs[index] == null) clock.startedAtMs[index] = startAt;
  }
  clock.pending.clear();
};

export const resetSpeakerWiper = (clock: SpeakerWiperClock, index: number) => {
  clock.startedAtMs[index] = null;
  clock.pending.delete(index);
};

/** Drop the current clip and arm the same full-width settle again. */
export const replaySpeakerWiper = (
  clock: SpeakerWiperClock,
  index: number,
  options: { imageReady: boolean; reducedMotion: boolean; nowMs: number },
) => {
  resetSpeakerWiper(clock, index);
  return armSpeakerWiper(clock, index, options);
};
