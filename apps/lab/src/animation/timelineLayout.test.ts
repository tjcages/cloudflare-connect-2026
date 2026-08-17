import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TIMELINE_LAYOUT,
  TIMELINE_LAYOUT_STORAGE_KEY,
  clampTimelineHeight,
  clampTimelineInspectorWidth,
  loadTimelineLayout,
  normalizeTimelineLayout,
  saveTimelineLayout,
} from "./timelineLayout";

describe("timeline layout persistence", () => {
  it("clamps timeline and inspector resizing to usable bounds", () => {
    expect(clampTimelineHeight(50, 900)).toBe(180);
    expect(clampTimelineHeight(1000, 900)).toBe(804);
    expect(clampTimelineInspectorWidth(100, 1200)).toBe(220);
    expect(clampTimelineInspectorWidth(900, 1200)).toBe(520);
    expect(clampTimelineInspectorWidth(400, 500)).toBe(340);
  });

  it("normalizes incomplete and invalid stored values", () => {
    expect(normalizeTimelineLayout({ height: Number.NaN, inspectorWidth: 300 })).toEqual({
      height: DEFAULT_TIMELINE_LAYOUT.height,
      inspectorWidth: 300,
    });
    expect(normalizeTimelineLayout(null)).toEqual(DEFAULT_TIMELINE_LAYOUT);
  });

  it("round trips layout values through storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };

    saveTimelineLayout({ height: 480, inspectorWidth: 340 }, storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      TIMELINE_LAYOUT_STORAGE_KEY,
      JSON.stringify({ height: 480, inspectorWidth: 340 }),
    );
    expect(loadTimelineLayout(storage)).toEqual({ height: 480, inspectorWidth: 340 });
  });
});
