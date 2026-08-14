import { EASING_OPTIONS, easeValue, parseCustomEasing, type EasingName } from "../controls/easing";

export const TIMELINE_STORAGE_KEY = "stripes-engine-lab-timeline-v1";

export type TimelineValue = number | string | boolean;

export type TimelineEasing = EasingName | "spring" | "hold";

export const DEFAULT_TIMELINE_EASING: TimelineEasing = "easeInOutExpo";

export type TimelineKeyframe = {
  id: string;
  time: number;
  value: TimelineValue;
  easing: TimelineEasing;
};

export type TimelineTrack = {
  id: string;
  propertyKey: string;
  propertyPath: string;
  label: string;
  valueType: "number" | "color" | "discrete";
  keyframes: TimelineKeyframe[];
};

export type TimelineSequence = {
  duration: number;
  loop: boolean;
  tracks: TimelineTrack[];
};

export type TimelineProperty = {
  key: string;
  path: string;
  group: string;
  label: string;
  value: TimelineValue;
  valueType: TimelineTrack["valueType"];
  min?: number;
  max?: number;
  step?: number;
};

export const DEFAULT_TIMELINE_SEQUENCE: TimelineSequence = {
  duration: 6,
  loop: true,
  tracks: [],
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const PRESET_TIMELINE_EASINGS = new Set<string>(Object.values(EASING_OPTIONS));

export function createTimelineId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function clampTimelineTime(time: number, duration: number): number {
  return Math.min(Math.max(0, duration), Math.max(0, Number.isFinite(time) ? time : 0));
}

export function advanceTimelinePlayback(
  time: number,
  elapsed: number,
  duration: number,
  loop: boolean,
): { time: number; playing: boolean; wrapped: boolean } {
  const safeDuration = Math.max(0.000001, duration);
  const next = Math.max(0, time) + Math.max(0, elapsed);
  if (next < safeDuration) return { time: next, playing: true, wrapped: false };
  if (!loop) return { time: safeDuration, playing: false, wrapped: false };
  return { time: next % safeDuration, playing: true, wrapped: true };
}

export function shouldSynchronizeTimelineMotion(playback: { playing: boolean; wrapped: boolean }): boolean {
  return playback.wrapped || !playback.playing;
}

export function snapTimelineTimeToWholeSecond(
  time: number,
  duration: number,
  canvasWidth: number,
  pixelThreshold = 6,
): { time: number; snapped: boolean } {
  const clamped = clampTimelineTime(time, duration);
  if (canvasWidth <= 0 || pixelThreshold <= 0) return { time: clamped, snapped: false };
  const nearestSecond = Math.round(clamped);
  if (nearestSecond < 0 || nearestSecond > duration) return { time: clamped, snapped: false };
  const thresholdSeconds = Math.min(0.12, (duration * pixelThreshold) / canvasWidth);
  return Math.abs(clamped - nearestSecond) <= thresholdSeconds
    ? { time: nearestSecond, snapped: true }
    : { time: clamped, snapped: false };
}

export function sortKeyframes(keyframes: readonly TimelineKeyframe[]): TimelineKeyframe[] {
  return [...keyframes].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

export function clampTimelineKeyframeDelta(
  sequence: TimelineSequence,
  selectedKeyIds: ReadonlySet<string>,
  requestedDelta: number,
): number {
  const times = sequence.tracks.flatMap((track) =>
    track.keyframes.filter((keyframe) => selectedKeyIds.has(keyframe.id)).map((keyframe) => keyframe.time),
  );
  if (times.length === 0 || !Number.isFinite(requestedDelta)) return 0;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const delta = Math.max(-minTime, Math.min(sequence.duration - maxTime, requestedDelta));
  return Math.abs(delta) < 0.000001 ? 0 : delta;
}

export function offsetTimelineKeyframes(
  sequence: TimelineSequence,
  selectedKeyIds: ReadonlySet<string>,
  requestedDelta: number,
): TimelineSequence {
  const delta = clampTimelineKeyframeDelta(sequence, selectedKeyIds, requestedDelta);
  if (Math.abs(delta) < 0.000001) return sequence;
  return {
    ...sequence,
    tracks: sequence.tracks.map((track) => ({
      ...track,
      keyframes: sortKeyframes(
        track.keyframes.map((keyframe) =>
          selectedKeyIds.has(keyframe.id)
            ? { ...keyframe, time: Number((keyframe.time + delta).toFixed(6)) }
            : keyframe,
        ),
      ),
    })),
  };
}

export function applyTimelineEasing(progress: number, easing: TimelineEasing): number {
  const t = Math.min(1, Math.max(0, progress));
  switch (easing) {
    case "spring": {
      if (t === 0 || t === 1) return t;
      return 1 - Math.cos(t * Math.PI * 4.5) * Math.exp(-t * 6);
    }
    case "hold":
      return 0;
    default:
      return easeValue(t, easing);
  }
}

export function normalizeTimelineEasing(value: unknown): TimelineEasing {
  if (typeof value !== "string") return DEFAULT_TIMELINE_EASING;
  if (value === "easeIn") return "easeInExpo";
  if (value === "easeOut") return "easeOutExpo";
  if (value === "easeInOut") return "easeInOutExpo";
  if (value === "spring" || value === "hold" || parseCustomEasing(value)) return value as TimelineEasing;
  return PRESET_TIMELINE_EASINGS.has(value) ? (value as TimelineEasing) : DEFAULT_TIMELINE_EASING;
}

function interpolateHex(from: string, to: string, progress: number): string {
  const a = Number.parseInt(from.slice(1), 16);
  const b = Number.parseInt(to.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * progress);
  return `#${[channel(16), channel(8), channel(0)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function interpolateTimelineValue(
  from: TimelineValue,
  to: TimelineValue,
  progress: number,
  valueType: TimelineTrack["valueType"],
): TimelineValue {
  if (valueType === "number" && typeof from === "number" && typeof to === "number") {
    return from + (to - from) * progress;
  }
  if (
    valueType === "color" &&
    typeof from === "string" &&
    typeof to === "string" &&
    HEX_COLOR.test(from) &&
    HEX_COLOR.test(to)
  ) {
    return interpolateHex(from, to, progress);
  }
  return progress < 1 ? from : to;
}

export function evaluateTrack(track: TimelineTrack, time: number): TimelineValue | undefined {
  const frames = sortKeyframes(track.keyframes);
  if (frames.length === 0) return undefined;
  if (time <= frames[0].time) return frames[0].value;
  const last = frames[frames.length - 1];
  if (time >= last.time) return last.value;

  for (let index = 0; index < frames.length - 1; index += 1) {
    const from = frames[index];
    const to = frames[index + 1];
    if (time > to.time) continue;
    const span = Math.max(0.000001, to.time - from.time);
    const eased = applyTimelineEasing((time - from.time) / span, from.easing);
    return interpolateTimelineValue(from.value, to.value, eased, track.valueType);
  }
  return last.value;
}

export function evaluateSequence(sequence: TimelineSequence, time: number): Record<string, TimelineValue> {
  const values: Record<string, TimelineValue> = {};
  for (const track of sequence.tracks) {
    const value = evaluateTrack(track, time);
    if (value !== undefined) values[track.propertyPath] = value;
  }
  return values;
}

export function upsertKeyframe(
  track: TimelineTrack,
  time: number,
  value: TimelineValue,
  easing: TimelineEasing = DEFAULT_TIMELINE_EASING,
): TimelineTrack {
  const existing = track.keyframes.find((frame) => Math.abs(frame.time - time) < 0.001);
  const keyframes = existing
    ? track.keyframes.map((frame) => (frame.id === existing.id ? { ...frame, value } : frame))
    : [...track.keyframes, { id: createTimelineId("key"), time, value, easing }];
  return { ...track, keyframes: sortKeyframes(keyframes) };
}

export function updateKeyframeValueById(track: TimelineTrack, keyframeId: string, value: TimelineValue): TimelineTrack {
  if (!track.keyframes.some((keyframe) => keyframe.id === keyframeId)) return track;
  return {
    ...track,
    keyframes: track.keyframes.map((keyframe) => (keyframe.id === keyframeId ? { ...keyframe, value } : keyframe)),
  };
}

export function normalizeTimelineSequence(value: unknown): TimelineSequence {
  if (!value || typeof value !== "object") return DEFAULT_TIMELINE_SEQUENCE;
  const raw = value as Partial<TimelineSequence>;
  const duration =
    typeof raw.duration === "number" && Number.isFinite(raw.duration)
      ? Math.min(3600, Math.max(0.1, raw.duration))
      : DEFAULT_TIMELINE_SEQUENCE.duration;
  const tracks = Array.isArray(raw.tracks)
    ? raw.tracks
        .filter((track): track is TimelineTrack => {
          if (!track || typeof track !== "object") return false;
          const candidate = track as TimelineTrack;
          return (
            typeof candidate.id === "string" &&
            typeof candidate.propertyKey === "string" &&
            typeof candidate.propertyPath === "string" &&
            Array.isArray(candidate.keyframes)
          );
        })
        .map((track) => ({
          ...track,
          keyframes: track.keyframes.map((keyframe) => ({
            ...keyframe,
            easing: normalizeTimelineEasing(keyframe.easing),
          })),
        }))
    : [];
  return { duration, loop: raw.loop !== false, tracks };
}

export function loadTimelineSequence(): TimelineSequence {
  if (typeof localStorage === "undefined") return DEFAULT_TIMELINE_SEQUENCE;
  try {
    const raw = localStorage.getItem(TIMELINE_STORAGE_KEY);
    return raw ? normalizeTimelineSequence(JSON.parse(raw)) : DEFAULT_TIMELINE_SEQUENCE;
  } catch {
    return DEFAULT_TIMELINE_SEQUENCE;
  }
}

export function saveTimelineSequence(sequence: TimelineSequence): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(sequence));
  } catch {
    // Timeline editing remains usable when storage is unavailable.
  }
}
