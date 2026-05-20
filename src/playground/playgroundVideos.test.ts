import { describe, expect, it } from "vitest";
import { getPlaygroundVideoOption, PLAYGROUND_VIDEOS } from "./playgroundVideos";

describe("playgroundVideos", () => {
  it("lists question and lock samples", () => {
    expect(PLAYGROUND_VIDEOS.map((entry) => entry.id)).toEqual(["question", "lock"]);
    expect(getPlaygroundVideoOption("question").url).toBe("/playground/question.mp4");
    expect(getPlaygroundVideoOption("lock").url).toBe("/playground/lock.mp4");
  });
});
