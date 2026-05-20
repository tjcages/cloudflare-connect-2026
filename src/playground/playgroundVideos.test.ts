import { describe, expect, it } from "vitest";
import { DEFAULT_STRIPE_DUOTONE_OPTIONS } from "./stripeFilterOptions";
import { DEFAULT_PLAYGROUND_VIDEO_ID, getPlaygroundVideoOption, PLAYGROUND_VIDEOS } from "./playgroundVideos";

describe("playgroundVideos", () => {
  it("lists example clips with per-clip duotone defaults", () => {
    expect(PLAYGROUND_VIDEOS.map((entry) => entry.id)).toEqual(["example", "example2", "example3", "example4"]);
    expect(DEFAULT_PLAYGROUND_VIDEO_ID).toBe("example4");
    expect(getPlaygroundVideoOption("example2").duotone.ignoreTolerance).toBe(0.16);
    expect(getPlaygroundVideoOption("example2").duotone.gamma).toBe(0.3);
    expect(getPlaygroundVideoOption("example3").duotone).toEqual({
      ignoreColorHex: "#000000",
      ignoreTolerance: 0.015,
      gamma: 4,
      threshold: 0.05,
      density: 1.05,
    });
    expect(getPlaygroundVideoOption("example").duotone.ignoreTolerance).toBe(
      DEFAULT_STRIPE_DUOTONE_OPTIONS.ignoreTolerance,
    );
  });
});
