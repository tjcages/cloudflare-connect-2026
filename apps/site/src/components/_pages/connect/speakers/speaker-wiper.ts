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

/** Rest width of each default pane, as a fraction of the portrait. */
export const SPEAKER_WIPER_REST_WIDTH = 0.1;
export const SPEAKER_OVERLAY_REST_WIDTH = 0.8;
export const SPEAKER_WIPER_DURATION_MS = 1200;
export const SPEAKER_WIPER_STAGGER_MS = 180;
/** Expand (left-edge wipe across the portrait) occupies this share of the clip. */
export const SPEAKER_WIPER_EXPAND_END = 0.6;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const unusedVariant = (value: never): never => {
  throw new Error(`Unhandled speaker frame variant: ${String(value)}`);
};

export const speakerWiperProgress = (elapsedMs: number, paneIndex: number): number => {
  const local = elapsedMs - paneIndex * SPEAKER_WIPER_STAGGER_MS;
  return clamp01(local / SPEAKER_WIPER_DURATION_MS);
};

/**
 * The authored frame itself is the wiper: it grows from the portrait's left
 * edge across the image, then settles into its rest rect.
 */
export const speakerFrameWiperRect = (aperture: Rect, rest: Rect, progress: number): Rect => {
  if (progress <= 0 || aperture.width <= 0 || rest.height <= 0) {
    return { x: aperture.x, y: rest.y, width: 0, height: rest.height };
  }

  if (progress < SPEAKER_WIPER_EXPAND_END) {
    const u = easeOutCubic(progress / SPEAKER_WIPER_EXPAND_END);
    return {
      x: aperture.x,
      y: rest.y,
      width: aperture.width * u,
      height: rest.height,
    };
  }

  const u = easeInOutCubic((progress - SPEAKER_WIPER_EXPAND_END) / (1 - SPEAKER_WIPER_EXPAND_END));
  return {
    x: lerp(aperture.x, rest.x, u),
    y: rest.y,
    width: lerp(aperture.width, rest.width, u),
    height: rest.height,
  };
};

const frameProgress = (
  imageIndex: number,
  paneIndex: number,
  startedAtMs: readonly (number | null)[],
  nowMs: number,
  options: { reducedMotion?: boolean; progressOverride?: number },
): number | null => {
  const override = options.progressOverride;
  const hasOverride = typeof override === "number" && Number.isFinite(override);
  if (hasOverride) {
    return speakerWiperProgress(override * (SPEAKER_WIPER_DURATION_MS + SPEAKER_WIPER_STAGGER_MS), paneIndex);
  }
  const startedAt = startedAtMs[imageIndex];
  if (startedAt == null) return null;
  if (options.reducedMotion) return 1;
  return speakerWiperProgress(nowMs - startedAt, paneIndex);
};

/** Animates each authored frame from a left-edge wipe to its rest rect. */
export const resolveWipingFrames = <T extends { imageIndex: number; rect: Rect }>(
  authored: readonly T[],
  apertures: readonly Rect[],
  startedAtMs: readonly (number | null)[],
  nowMs: number,
  options: { reducedMotion?: boolean; progressOverride?: number } = {},
): T[] => {
  const paneIndexByImage = new Map<number, number>();
  const frames: T[] = [];

  for (const frame of authored) {
    const aperture = apertures[frame.imageIndex];
    if (!aperture) continue;
    const paneIndex = paneIndexByImage.get(frame.imageIndex) ?? 0;
    paneIndexByImage.set(frame.imageIndex, paneIndex + 1);
    const progress = frameProgress(frame.imageIndex, paneIndex, startedAtMs, nowMs, options);
    if (progress == null) continue;
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
    case "white":
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

export const commitPendingSpeakerWipers = (clock: SpeakerWiperClock, nowMs: number) => {
  for (const index of clock.pending) {
    if (clock.startedAtMs[index] == null) clock.startedAtMs[index] = nowMs;
  }
  clock.pending.clear();
};

export const resetSpeakerWiper = (clock: SpeakerWiperClock, index: number) => {
  clock.startedAtMs[index] = null;
  clock.pending.delete(index);
};
