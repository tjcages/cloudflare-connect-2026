import { describe, expect, it } from "vitest";
import {
  applyTimelineEasing,
  evaluateSequence,
  evaluateTrack,
  interpolateTimelineValue,
  normalizeTimelineSequence,
  normalizeTimelineEasing,
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

  it("evaluates all tracks into Leva control keys", () => {
    expect(evaluateSequence({ duration: 2, loop: true, tracks: [track] }, 1)).toEqual({ brightness: 5 });
  });

  it("updates an existing key at the same time instead of duplicating it", () => {
    const updated = upsertKeyframe(track, 2, 12);
    expect(updated.keyframes).toHaveLength(2);
    expect(updated.keyframes[1].value).toBe(12);
  });

  it("defaults new keys to expo easing", () => {
    const updated = upsertKeyframe(track, 1, 5);
    expect(updated.keyframes.find((keyframe) => keyframe.time === 1)?.easing).toBe("easeInOutExpo");
  });

  it("normalizes corrupt persisted settings", () => {
    expect(normalizeTimelineSequence({ duration: -2, loop: false, tracks: "nope" })).toEqual({
      duration: 0.1,
      loop: false,
      tracks: [],
    });
  });
});
