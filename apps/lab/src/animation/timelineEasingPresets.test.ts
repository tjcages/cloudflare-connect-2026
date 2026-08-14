import { describe, expect, it, vi } from "vitest";
import { normalizeTimelineEasingPresets, upsertTimelineEasingPreset } from "./timelineEasingPresets";

describe("timeline easing presets", () => {
  it("normalizes persisted presets and drops invalid entries", () => {
    expect(
      normalizeTimelineEasingPresets([
        { id: "one", name: "  Fast finish  ", easing: "custom:0.2,0,0.1,1" },
        { id: "two", name: "", easing: "easeOutExpo" },
        null,
      ]),
    ).toEqual([{ id: "one", name: "Fast finish", easing: "custom:0.2,0,0.1,1" }]);
  });

  it("creates named presets and replaces names case-insensitively", () => {
    vi.spyOn(Date, "now").mockReturnValue(1);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const created = upsertTimelineEasingPreset([], "Hero settle", "easeOutExpo");
    const updated = upsertTimelineEasingPreset(created.presets, "hero SETTLE", "custom:0,0,0.2,1");

    expect(updated.presets).toHaveLength(1);
    expect(updated.preset).toEqual({
      id: created.preset.id,
      name: "hero SETTLE",
      easing: "custom:0,0,0.2,1",
    });
  });
});
