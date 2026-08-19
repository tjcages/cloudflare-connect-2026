import type { EngineConfig } from "@necatikcl/stripes-engine";
import {
  speakerVariantEngineConfig,
  type SpeakerFrameSettings,
} from "./speaker-frame-controls";
import { SPEAKER_SHADER_CONFIG } from "./speaker-shader-config";
import type { Rect } from "./speaker-shader-geometry";

export const SPEAKER_WIPER_PANE_IDS = ["inverted", "white"] as const;
export type SpeakerWiperPaneId = (typeof SPEAKER_WIPER_PANE_IDS)[number];

export type SpeakerWiperFrame = {
  imageIndex: number;
  pane: SpeakerWiperPaneId;
  rect: Rect;
};

/** Rest width of each pane, as a fraction of the portrait. */
export const SPEAKER_WIPER_REST_WIDTH = 0.1;
export const SPEAKER_WIPER_DURATION_MS = 1200;
export const SPEAKER_WIPER_STAGGER_MS = 180;
/** Expand (left-edge wipe across the portrait) occupies this share of the clip. */
export const SPEAKER_WIPER_EXPAND_END = 0.6;

const CONNECT_ORANGE = 0xff_bf_14;
const WHITE = 0xff_ff_ff;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const unusedPane = (value: never): never => {
  throw new Error(`Unhandled speaker wiper pane: ${String(value)}`);
};

export const speakerWiperProgress = (elapsedMs: number, paneIndex: number): number => {
  const local = elapsedMs - paneIndex * SPEAKER_WIPER_STAGGER_MS;
  return clamp01(local / SPEAKER_WIPER_DURATION_MS);
};

/**
 * Left-edge wipe that covers the portrait, then settles into a 10% strip.
 * Pane 0 rests at 0–10%; pane 1 rests at 10–20%.
 */
export const speakerWiperRect = (aperture: Rect, paneIndex: number, progress: number): Rect => {
  const restWidth = aperture.width * SPEAKER_WIPER_REST_WIDTH;
  const restX = aperture.x + paneIndex * restWidth;
  if (progress <= 0 || aperture.width <= 0 || aperture.height <= 0) {
    return { x: aperture.x, y: aperture.y, width: 0, height: aperture.height };
  }

  if (progress < SPEAKER_WIPER_EXPAND_END) {
    const u = easeOutCubic(progress / SPEAKER_WIPER_EXPAND_END);
    return {
      x: aperture.x,
      y: aperture.y,
      width: aperture.width * u,
      height: aperture.height,
    };
  }

  const u = easeInOutCubic((progress - SPEAKER_WIPER_EXPAND_END) / (1 - SPEAKER_WIPER_EXPAND_END));
  return {
    x: lerp(aperture.x, restX, u),
    y: aperture.y,
    width: lerp(aperture.width, restWidth, u),
    height: aperture.height,
  };
};

export const resolveSpeakerWipers = (
  apertures: readonly Rect[],
  startedAtMs: readonly (number | null)[],
  nowMs: number,
  options: { reducedMotion?: boolean; progressOverride?: number } = {},
): SpeakerWiperFrame[] => {
  const frames: SpeakerWiperFrame[] = [];
  const override = options.progressOverride;
  const hasOverride = typeof override === "number" && Number.isFinite(override);

  for (let imageIndex = 0; imageIndex < apertures.length; imageIndex += 1) {
    const aperture = apertures[imageIndex];
    const startedAt = startedAtMs[imageIndex];
    if (!aperture) continue;
    if (!hasOverride && startedAt == null) continue;

    for (let paneIndex = 0; paneIndex < SPEAKER_WIPER_PANE_IDS.length; paneIndex += 1) {
      const pane = SPEAKER_WIPER_PANE_IDS[paneIndex];
      const progress = options.reducedMotion
        ? 1
        : hasOverride
          ? speakerWiperProgress(override * (SPEAKER_WIPER_DURATION_MS + SPEAKER_WIPER_STAGGER_MS), paneIndex)
          : speakerWiperProgress(nowMs - (startedAt ?? nowMs), paneIndex);
      const rect = speakerWiperRect(aperture, paneIndex, progress);
      if (rect.width < 0.5) continue;
      frames.push({ imageIndex, pane, rect });
    }
  }

  return frames;
};

export const speakerWiperEngineConfig = (
  settings: SpeakerFrameSettings,
  pane: SpeakerWiperPaneId,
): Partial<EngineConfig> => {
  const orange = speakerVariantEngineConfig(settings, "orange");
  switch (pane) {
    case "inverted":
      return {
        ...orange,
        adjustments: {
          ...SPEAKER_SHADER_CONFIG.adjustments,
          ...orange.adjustments,
          invert: true,
        },
        background: {
          ...SPEAKER_SHADER_CONFIG.background,
          color: CONNECT_ORANGE,
        },
      };
    case "white":
      return {
        ...orange,
        adjustments: {
          ...SPEAKER_SHADER_CONFIG.adjustments,
          ...orange.adjustments,
          invert: false,
          brightness: Math.max(orange.adjustments?.brightness ?? 0.33, 0.55),
          exposure: Math.max(orange.adjustments?.exposure ?? 0.87, 1.05),
        },
        background: {
          ...SPEAKER_SHADER_CONFIG.background,
          color: WHITE,
        },
      };
    default:
      return unusedPane(pane);
  }
};

export const speakerWiperOutlineColor = (pane: SpeakerWiperPaneId, opacity: number) => {
  switch (pane) {
    case "inverted":
      return `rgba(255, 191, 20, ${opacity})`;
    case "white":
      return `rgba(255, 255, 255, ${opacity})`;
    default:
      return unusedPane(pane);
  }
};

export const parseSpeakerWiperOverride = (search: string): number | undefined => {
  const raw = new URLSearchParams(search).get("speakerWiper");
  if (raw == null || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) return undefined;
  return clamp01(value);
};
