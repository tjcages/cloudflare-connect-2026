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

/** Rest layout is a full-bleed overlay; orange exists only during the intro. */
export const SPEAKER_OVERLAY_REST_WIDTH = 1;
/** Grow the overlay iris from the portrait center. */
export const SPEAKER_WIPER_DURATION_MS = 900;
export const SPEAKER_WIPER_STAGGER_MS = 0;
/** Hold the orange field until the water reveal has played. */
export const SPEAKER_WIPER_SHADER_DELAY_MS = SPEAKER_SHADER_CONFIG.reveal.water.durationMs;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Strong ease-out so the iris launches fast and settles gently onto the portrait. */
const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;

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

/** Orange covers the portrait until the overlay iris finishes. */
export const speakerOrangeCoverRect = (aperture: Rect, progress: number): Rect | null => {
  if (progress >= 1) return null;
  if (aperture.width < 0.5 || aperture.height < 0.5) return null;
  return { x: aperture.x, y: aperture.y, width: aperture.width, height: aperture.height };
};

/**
 * Reverse frame: starts at zero in the rest rect's center and grows to that
 * rest size. Default rest is the full portrait.
 */
export const speakerOverlayIrisRect = (rest: Rect, progress: number): Rect => {
  if (rest.width <= 0 || rest.height <= 0) {
    return { x: rest.x, y: rest.y, width: 0, height: 0 };
  }

  if (progress <= 0) {
    return {
      x: rest.x + rest.width / 2,
      y: rest.y + rest.height / 2,
      width: 0,
      height: 0,
    };
  }

  if (progress >= 1) return rest;

  const u = easeOutQuint(Math.min(1, progress));
  const width = rest.width * u;
  const height = rest.height * u;
  return {
    x: rest.x + (rest.width - width) / 2,
    y: rest.y + (rest.height - height) / 2,
    width,
    height,
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
  options: { reducedMotion?: boolean; progressOverride?: number },
): number => {
  if (options.reducedMotion) return 1;
  return speakerWiperProgress(elapsedMs, 0);
};

type WipingFrame = {
  imageIndex: number;
  rect: Rect;
  variant: SpeakerFrameVariantId;
};

/**
 * Orange fills each started portrait, then an overlay iris grows from the
 * center. When the iris completes, orange is gone.
 */
export const resolveWipingFrames = <T extends WipingFrame>(
  authored: readonly T[],
  apertures: readonly Rect[],
  startedAtMs: readonly (number | null)[],
  nowMs: number,
  options: { reducedMotion?: boolean; progressOverride?: number } = {},
): T[] => {
  const frames: T[] = [];
  const progressByImage = new Map<number, number>();

  for (let imageIndex = 0; imageIndex < apertures.length; imageIndex += 1) {
    const aperture = apertures[imageIndex];
    if (!aperture) continue;
    const elapsedMs = frameElapsedMs(imageIndex, startedAtMs, nowMs, options);
    if (elapsedMs == null) continue;
    const progress = frameProgress(elapsedMs, options);
    progressByImage.set(imageIndex, progress);
    const orange = speakerOrangeCoverRect(aperture, progress);
    if (orange) {
      frames.push({ imageIndex, variant: "orange", rect: orange } as T);
    }
  }

  for (const frame of authored) {
    if (frame.variant !== "grey") continue;
    const aperture = apertures[frame.imageIndex];
    if (!aperture) continue;
    const progress = progressByImage.get(frame.imageIndex);
    if (progress == null) continue;
    const rect = speakerOverlayIrisRect(frame.rect, progress);
    if (rect.width < 0.5 || rect.height < 0.5) continue;
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

/** Drop the current clip and arm the same orange-then-iris settle again. */
export const replaySpeakerWiper = (
  clock: SpeakerWiperClock,
  index: number,
  options: { imageReady: boolean; reducedMotion: boolean; nowMs: number },
) => {
  resetSpeakerWiper(clock, index);
  return armSpeakerWiper(clock, index, options);
};
