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
/** Left-edge intro swipe for each portrait. Slow enough to read on phone. */
export const SPEAKER_WIPER_DURATION_MS = 1800;
export const SPEAKER_WIPER_STAGGER_MS = 180;
/** Dark used to wait a second stagger (pane index 2). It now starts almost with the overlay. */
export const SPEAKER_WIPER_DARK_STAGGER_MS = 70;
/** Expand (left-edge wipe across the portrait) occupies this share of the clip. */
export const SPEAKER_WIPER_EXPAND_END = 0.6;
/** After both edge panes rest, they trade width for this long, then settle. */
export const SPEAKER_PANE_WIGGLE_DURATION_MS = 9_000;
export const SPEAKER_PANE_WIGGLE_PERIOD_MS = 2_400;
/** Peak extra width, as a fraction of the smaller pane. */
export const SPEAKER_PANE_WIGGLE_AMPLITUDE = 0.34;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const unusedVariant = (value: never): never => {
  throw new Error(`Unhandled speaker frame variant: ${String(value)}`);
};

export const speakerWiperStaggerMs = (variant: SpeakerFrameVariantId): number => {
  switch (variant) {
    case "grey":
      return 0;
    case "dark":
      return SPEAKER_WIPER_DARK_STAGGER_MS;
    case "orange":
      return SPEAKER_WIPER_STAGGER_MS;
    default:
      return unusedVariant(variant);
  }
};

export const speakerWiperProgress = (elapsedMs: number, staggerMs: number): number => {
  const local = elapsedMs - staggerMs;
  return clamp01(local / SPEAKER_WIPER_DURATION_MS);
};

const speakerWiperFinishMs = (variant: SpeakerFrameVariantId) =>
  speakerWiperStaggerMs(variant) + SPEAKER_WIPER_DURATION_MS;

const panesBothClosedMs = () =>
  Math.max(speakerWiperFinishMs("orange"), speakerWiperFinishMs("dark"));

/** Extra width for the left pane; the right pane takes the remainder. */
export const speakerPaneWiggleShift = (elapsedSinceBothRestMs: number, smallerWidth: number): number => {
  if (elapsedSinceBothRestMs <= 0 || smallerWidth <= 0) return 0;
  const u = clamp01(elapsedSinceBothRestMs / SPEAKER_PANE_WIGGLE_DURATION_MS);
  const hold = 0.45;
  const envelope = u <= hold ? 1 : 1 - easeInOutCubic((u - hold) / (1 - hold));
  if (envelope <= 0) return 0;
  return smallerWidth * SPEAKER_PANE_WIGGLE_AMPLITUDE * Math.sin((elapsedSinceBothRestMs / SPEAKER_PANE_WIGGLE_PERIOD_MS) * Math.PI * 2) * envelope;
};

export const speakerPaneWiggleRects = (orange: Rect, dark: Rect, shift: number): { orange: Rect; dark: Rect } => {
  const orangeOnLeft = orange.x <= dark.x;
  const left = orangeOnLeft ? orange : dark;
  const right = orangeOnLeft ? dark : orange;
  const pairWidth = left.width + right.width;
  const minWidth = Math.min(left.width, right.width) * 0.45;
  const leftWidth = Math.min(pairWidth - minWidth, Math.max(minWidth, left.width + shift));
  const nextLeft = { ...left, x: left.x, width: leftWidth };
  const nextRight = { ...right, x: left.x + leftWidth, width: pairWidth - leftWidth };
  return orangeOnLeft ? { orange: nextLeft, dark: nextRight } : { orange: nextRight, dark: nextLeft };
};

const panesAreAdjacent = (a: Rect, b: Rect) => {
  if (Math.abs(a.y - b.y) > 1 || Math.abs(a.height - b.height) > 1) return false;
  return Math.abs(a.x + a.width - b.x) <= 1 || Math.abs(b.x + b.width - a.x) <= 1;
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

/** Animates each authored frame from a left-edge wipe to its rest rect. */
export const resolveWipingFrames = <T extends WipingFrame>(
  authored: readonly T[],
  apertures: readonly Rect[],
  startedAtMs: readonly (number | null)[],
  nowMs: number,
  options: { reducedMotion?: boolean; progressOverride?: number } = {},
): T[] => {
  const freezeWiggle = options.reducedMotion === true || typeof options.progressOverride === "number";
  const prepared: { frame: T; aperture: Rect; rest: Rect; progress: number; elapsedMs: number }[] = [];

  for (const frame of authored) {
    const aperture = apertures[frame.imageIndex];
    if (!aperture) continue;
    const elapsedMs = frameElapsedMs(frame.imageIndex, startedAtMs, nowMs, options);
    if (elapsedMs == null) continue;
    const progress = frameProgress(elapsedMs, frame.variant, options);
    prepared.push({ frame, aperture, rest: frame.rect, progress, elapsedMs });
  }

  const items = prepared.map((item) => ({
    ...item,
    rect: speakerFrameWiperRect(item.aperture, item.rest, item.progress),
  }));

  const byImage = new Map<number, typeof items>();
  for (const item of items) {
    const list = byImage.get(item.frame.imageIndex) ?? [];
    list.push(item);
    byImage.set(item.frame.imageIndex, list);
  }

  if (!freezeWiggle) {
    for (const group of byImage.values()) {
      const orange = group.find((item) => item.frame.variant === "orange" && item.progress >= 1);
      const dark = group.find((item) => item.frame.variant === "dark" && item.progress >= 1);
      const elapsedMs = orange?.elapsedMs ?? dark?.elapsedMs;
      if (!orange || !dark || elapsedMs == null || !panesAreAdjacent(orange.rest, dark.rest)) continue;
      const wiggleElapsed = elapsedMs - panesBothClosedMs();
      const shift = speakerPaneWiggleShift(wiggleElapsed, Math.min(orange.rest.width, dark.rest.width));
      if (shift === 0) continue;
      const wiggled = speakerPaneWiggleRects(orange.rest, dark.rest, shift);
      orange.rect = wiggled.orange;
      dark.rect = wiggled.dark;
    }
  }

  const frames: T[] = [];
  for (const item of items) {
    if (item.rect.width < 0.5) continue;
    frames.push({ ...item.frame, rect: item.rect });
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
    case "dark":
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

/** Drop the current clip and arm the same left-edge wipe again. */
export const replaySpeakerWiper = (
  clock: SpeakerWiperClock,
  index: number,
  options: { imageReady: boolean; reducedMotion: boolean; nowMs: number },
) => {
  resetSpeakerWiper(clock, index);
  return armSpeakerWiper(clock, index, options);
};
