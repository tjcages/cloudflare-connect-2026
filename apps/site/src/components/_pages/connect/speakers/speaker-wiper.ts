import type { EngineConfig } from "@necatikcl/stripes-engine";
import {
  hexToColorNumber,
  speakerVariantBgNumber,
  speakerVariantEngineConfig,
  type SpeakerFrameSettings,
  type SpeakerFrameVariantId,
} from "./speaker-frame-controls";
import { SPEAKER_SHADER_CONFIG } from "./speaker-shader-config";
import { intersectRects, type Rect } from "./speaker-shader-geometry";

/** Rest layout is a full-bleed overlay; orange exists only during the intro. */
export const SPEAKER_OVERLAY_REST_WIDTH = 1;
/** Grow the overlay iris from the portrait center. */
export const SPEAKER_WIPER_DURATION_MS = 900;
/** Per-portrait delay when several irises start in the same wave (reading order). */
export const SPEAKER_WIPER_STAGGER_MS = 140;
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

const MIN_RECT_PX = 0.5;

const pushRect = (rects: Rect[], rect: Rect) => {
  if (rect.width >= MIN_RECT_PX && rect.height >= MIN_RECT_PX) rects.push(rect);
};

/** Orange remains only outside the overlay iris — a hole punched through the field. */
export const speakerOrangeMaskRects = (aperture: Rect, hole: Rect | null): Rect[] => {
  if (aperture.width < MIN_RECT_PX || aperture.height < MIN_RECT_PX) return [];
  const clipped =
    hole && hole.width >= MIN_RECT_PX && hole.height >= MIN_RECT_PX ? intersectRects(aperture, hole) : null;
  if (!clipped) return [{ x: aperture.x, y: aperture.y, width: aperture.width, height: aperture.height }];

  const apertureRight = aperture.x + aperture.width;
  const apertureBottom = aperture.y + aperture.height;
  const holeRight = clipped.x + clipped.width;
  const holeBottom = clipped.y + clipped.height;
  const rects: Rect[] = [];

  pushRect(rects, {
    x: aperture.x,
    y: aperture.y,
    width: aperture.width,
    height: clipped.y - aperture.y,
  });
  pushRect(rects, {
    x: aperture.x,
    y: holeBottom,
    width: aperture.width,
    height: apertureBottom - holeBottom,
  });
  pushRect(rects, {
    x: aperture.x,
    y: clipped.y,
    width: clipped.x - aperture.x,
    height: clipped.height,
  });
  pushRect(rects, {
    x: holeRight,
    y: clipped.y,
    width: apertureRight - holeRight,
    height: clipped.height,
  });

  return rects;
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

const frameProgress = (elapsedMs: number, options: { reducedMotion?: boolean; progressOverride?: number }): number => {
  if (options.reducedMotion) return 1;
  return speakerWiperProgress(elapsedMs, 0);
};

/** Overlay iris progress for one portrait, or null if that wipe has not started. */
export const speakerWiperImageProgress = (
  imageIndex: number,
  startedAtMs: readonly (number | null)[],
  nowMs: number,
  options: { reducedMotion?: boolean; progressOverride?: number } = {},
): number | null => {
  const elapsedMs = frameElapsedMs(imageIndex, startedAtMs, nowMs, options);
  if (elapsedMs == null) return null;
  return frameProgress(elapsedMs, options);
};

type WipingFrame = {
  imageIndex: number;
  rect: Rect;
  variant: SpeakerFrameVariantId;
};

/**
 * Orange fills each started portrait around the overlay iris. When the iris
 * completes, orange is gone.
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
  const irisByImage = new Map<number, Rect>();

  for (let imageIndex = 0; imageIndex < apertures.length; imageIndex += 1) {
    const elapsedMs = frameElapsedMs(imageIndex, startedAtMs, nowMs, options);
    if (elapsedMs == null) continue;
    progressByImage.set(imageIndex, frameProgress(elapsedMs, options));
  }

  for (const frame of authored) {
    if (frame.variant !== "grey") continue;
    const progress = progressByImage.get(frame.imageIndex);
    if (progress == null) continue;
    const rect = speakerOverlayIrisRect(frame.rect, progress);
    const existing = irisByImage.get(frame.imageIndex);
    if (!existing || rect.width * rect.height > existing.width * existing.height) {
      irisByImage.set(frame.imageIndex, rect);
    }
    if (rect.width < MIN_RECT_PX || rect.height < MIN_RECT_PX) continue;
    frames.push({ ...frame, rect });
  }

  for (const [imageIndex, progress] of progressByImage) {
    if (progress >= 1) continue;
    const aperture = apertures[imageIndex];
    if (!aperture) continue;
    const hole = irisByImage.get(imageIndex) ?? null;
    for (const rect of speakerOrangeMaskRects(aperture, hole)) {
      frames.push({ imageIndex, variant: "orange", rect } as T);
    }
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
export const speakerWiperShouldEnter = (intersectionRatio: number) => intersectionRatio >= SPEAKER_WIPER_ENTER_RATIO;

/**
 * Tracking helper only: the portrait is fully offscreen. Do not reset the
 * overlay when this becomes true — footer/agenda shaders keep their last
 * frame, and speakers should too. Leaving just stops counting the card as
 * in-view so a later enter can arm a portrait that never started.
 */
export const speakerWiperShouldLeave = (intersectionRatio: number) => intersectionRatio <= 0;

/** True while orange hold or iris growth still needs a live clock. */
export const speakerWiperNeedsLiveClock = (
  startedAtMs: number | null | undefined,
  nowMs: number,
  pending: boolean,
): boolean => {
  if (pending) return true;
  if (startedAtMs == null) return false;
  return nowMs < startedAtMs + SPEAKER_WIPER_DURATION_MS;
};

export type SpeakerWiperClock = {
  startedAtMs: (number | null)[];
  pending: Set<number>;
};

export const speakerWiperClockIsLive = (clock: SpeakerWiperClock, nowMs: number): boolean => {
  if (clock.pending.size > 0) return true;
  return clock.startedAtMs.some((startedAt) => speakerWiperNeedsLiveClock(startedAt, nowMs, false));
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

export const commitPendingSpeakerWipers = (
  clock: SpeakerWiperClock,
  nowMs: number,
  delayMs = 0,
  visualOrder: readonly number[] = [],
) => {
  if (clock.pending.size === 0) return;
  const startBase = nowMs + Math.max(0, delayMs);
  const stillPlaying: number[] = [];
  for (let index = 0; index < clock.startedAtMs.length; index += 1) {
    const startedAt = clock.startedAtMs[index];
    if (startedAt == null) continue;
    if (nowMs >= startedAt + SPEAKER_WIPER_DURATION_MS) continue;
    stillPlaying.push(index);
  }
  const wave = new Set<number>([...clock.pending, ...stillPlaying]);
  const waveOrder: number[] = [];
  const seen = new Set<number>();
  const pushWaveIndex = (index: number) => {
    if (!wave.has(index) || seen.has(index)) return;
    seen.add(index);
    waveOrder.push(index);
  };
  for (const index of visualOrder) pushWaveIndex(index);
  for (const index of [...wave].sort((a, b) => a - b)) pushWaveIndex(index);

  let waveOrigin = startBase;
  for (const index of stillPlaying) {
    const startedAt = clock.startedAtMs[index];
    if (startedAt == null) continue;
    const rank = waveOrder.indexOf(index);
    if (rank < 0) continue;
    waveOrigin = Math.min(waveOrigin, startedAt - rank * SPEAKER_WIPER_STAGGER_MS);
  }

  for (const index of clock.pending) {
    if (clock.startedAtMs[index] != null) continue;
    const rank = waveOrder.indexOf(index);
    const staggeredRank = rank >= 0 ? rank : 0;
    clock.startedAtMs[index] = Math.max(startBase, waveOrigin + staggeredRank * SPEAKER_WIPER_STAGGER_MS);
  }
  clock.pending.clear();
};

/** Reading order for a speaker grid: left to right, then top to bottom. */
export const speakerWiperVisualOrder = (rects: readonly Pick<Rect, "x" | "y">[]): number[] =>
  rects
    .map((rect, index) => ({ index, x: rect.x, y: rect.y }))
    .sort((a, b) => Math.round(a.y) - Math.round(b.y) || Math.round(a.x) - Math.round(b.x) || a.index - b.index)
    .map((item) => item.index);

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
