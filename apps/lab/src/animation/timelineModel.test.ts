import { describe, expect, it } from "vitest";
import {
  advanceTimelinePlayback,
  animationFrameDeltaSeconds,
  applyTimelineEasing,
  clampTimelineKeyframeDelta,
  evaluateSequence,
  evaluateTrack,
  interpolateTimelineValue,
  normalizeTimelineSequence,
  normalizeTimelineEasing,
  offsetTimelineKeyframes,
  shouldSynchronizeTimelineMotion,
  snapTimelineTimeToWholeSecond,
  updateKeyframeValueById,
  upsertKeyframe,
  type TimelineTrack,
} from "./timelineModel";

const track: TimelineTrack = {
  id: "brightness",
  propertyKey: "brightness",
  propertyPath: "Adjustments.brightness",
  label: "Brightness",
  valueType: "number",
  keyframes: [
    { id: "a", time: 0, value: 0, easing: "linear" },
    { id: "b", time: 2, value: 10, easing: "linear" },
  ],
};

describe("timeline model", () => {
  it("preserves wall-clock pacing through a slow rendered frame", () => {
    expect(animationFrameDeltaSeconds(1000, 1250)).toBe(0.25);
    expect(animationFrameDeltaSeconds(1000, 3000)).toBe(0.5);
  });

  it("only loops playback when Loop is enabled", () => {
    expect(advanceTimelinePlayback(5.9, 0.2, 6, false)).toEqual({ time: 6, playing: false, wrapped: false });
    expect(advanceTimelinePlayback(5.9, 0.2, 6, true)).toEqual({
      time: expect.closeTo(0.1),
      playing: true,
      wrapped: true,
    });
  });

  it("synchronizes canvas motion only at playback boundaries", () => {
    expect(shouldSynchronizeTimelineMotion({ playing: true, wrapped: false })).toBe(false);
    expect(shouldSynchronizeTimelineMotion({ playing: true, wrapped: true })).toBe(true);
    expect(shouldSynchronizeTimelineMotion({ playing: false, wrapped: false })).toBe(true);
  });

  it("interpolates numeric tracks and clamps outside their keys", () => {
    expect(evaluateTrack(track, -1)).toBe(0);
    expect(evaluateTrack(track, 1)).toBe(5);
    expect(evaluateTrack(track, 3)).toBe(10);
  });

  it("interpolates colors channel-by-channel", () => {
    expect(interpolateTimelineValue("#000000", "#ffffff", 0.5, "color")).toBe("#808080");
  });

  it("holds discrete values until the next key", () => {
    expect(interpolateTimelineValue(false, true, 0.99, "discrete")).toBe(false);
    expect(interpolateTimelineValue(false, true, 1, "discrete")).toBe(true);
  });

  it("uses the outgoing keyframe easing", () => {
    const eased = {
      ...track,
      keyframes: [{ ...track.keyframes[0], easing: "easeInExpo" as const }, track.keyframes[1]],
    };
    expect(evaluateTrack(eased, 1)).toBeCloseTo(0.3125);
    expect(applyTimelineEasing(0.5, "easeOutExpo")).toBeCloseTo(0.96875);
  });

  it("supports custom cubic bezier easing", () => {
    expect(applyTimelineEasing(0.5, "custom:0.42,0,0.58,1")).toBeCloseTo(0.5);
  });

  it("migrates legacy easing names to expo and defaults unknown values", () => {
    expect(normalizeTimelineEasing("easeIn")).toBe("easeInExpo");
    expect(normalizeTimelineEasing("easeOut")).toBe("easeOutExpo");
    expect(normalizeTimelineEasing("easeInOut")).toBe("easeInOutExpo");
    expect(normalizeTimelineEasing("not-real")).toBe("easeInOutExpo");
  });

  it("evaluates all tracks into exact Leva control paths", () => {
    expect(evaluateSequence({ duration: 2, loop: true, tracks: [track] }, 1)).toEqual({
      "Adjustments.brightness": 5,
    });
  });

  it("keeps controls with the same final key independently animatable", () => {
    const duplicateKeyTrack: TimelineTrack = {
      ...track,
      id: "other-brightness",
      propertyPath: "Shader.brightness",
      keyframes: [
        { id: "c", time: 0, value: 20, easing: "linear" },
        { id: "d", time: 2, value: 40, easing: "linear" },
      ],
    };

    expect(evaluateSequence({ duration: 2, loop: true, tracks: [track, duplicateKeyTrack] }, 1)).toEqual({
      "Adjustments.brightness": 5,
      "Shader.brightness": 30,
    });
  });

  it("updates an existing key at the same time instead of duplicating it", () => {
    const updated = upsertKeyframe(track, 2, 12);
    expect(updated.keyframes).toHaveLength(2);
    expect(updated.keyframes[1].value).toBe(12);
  });

  it("updates only the selected keyframe when its value changes", () => {
    const updated = updateKeyframeValueById(track, "a", 7);
    expect(updated.keyframes).toEqual([{ ...track.keyframes[0], value: 7 }, track.keyframes[1]]);
    expect(updateKeyframeValueById(track, "missing", 7)).toBe(track);
  });

  it("moves selected keyframes across tracks by one shared delta", () => {
    const secondTrack: TimelineTrack = {
      ...track,
      id: "contrast",
      propertyKey: "contrast",
      propertyPath: "Adjustments.contrast",
      keyframes: [
        { id: "c", time: 0.5, value: 2, easing: "linear" },
        { id: "d", time: 1.5, value: 4, easing: "linear" },
      ],
    };
    const sequence = { duration: 2, loop: true, tracks: [track, secondTrack] };
    const moved = offsetTimelineKeyframes(sequence, new Set(["a", "c"]), 0.1);

    expect(moved.tracks[0].keyframes.find((keyframe) => keyframe.id === "a")?.time).toBe(0.1);
    expect(moved.tracks[1].keyframes.find((keyframe) => keyframe.id === "c")?.time).toBe(0.6);
    expect(clampTimelineKeyframeDelta(sequence, new Set(["b", "c"]), 0.1)).toBe(0);
  });

  it("clamps grouped movement at the timeline bounds without changing spacing", () => {
    const sequence = { duration: 2, loop: true, tracks: [track] };
    expect(clampTimelineKeyframeDelta(sequence, new Set(["a", "b"]), -0.4)).toBe(0);
    const moved = offsetTimelineKeyframes(sequence, new Set(["a", "b"]), -0.4);
    expect(moved.tracks[0].keyframes.map((keyframe) => keyframe.time)).toEqual([0, 2]);
  });

  it("defaults new keys to expo easing", () => {
    const updated = upsertKeyframe(track, 1, 5);
    expect(updated.keyframes.find((keyframe) => keyframe.time === 1)?.easing).toBe("easeInOutExpo");
  });

  it("subtly snaps key times to whole seconds using a pixel threshold", () => {
    expect(snapTimelineTimeToWholeSecond(1.03, 6, 900)).toEqual({ time: 1, snapped: true });
    expect(snapTimelineTimeToWholeSecond(1.08, 6, 900)).toEqual({ time: 1.08, snapped: false });
    expect(snapTimelineTimeToWholeSecond(5.98, 6, 900, 0)).toEqual({ time: 5.98, snapped: false });
  });

  it("normalizes corrupt persisted settings", () => {
    expect(normalizeTimelineSequence({ duration: -2, loop: false, tracks: "nope" })).toEqual({
      duration: 0.1,
      loop: false,
      tracks: [],
    });
  });
});
