import { describe, expect, it, vi } from "vitest";
import { collectTimelineProperties, type TimelineLevaStore } from "./TimelineEditor";

function storeWith(data: ReturnType<TimelineLevaStore["getData"]>): TimelineLevaStore {
  return {
    getData: () => data,
    getVisiblePaths: () => ["General.motion"],
    set: vi.fn(),
    subscribeToEditEnd: vi.fn(() => vi.fn()),
  };
}

describe("timeline property collection", () => {
  it("includes animation-safe controls even when their Leva paths are hidden", () => {
    const properties = collectTimelineProperties([
      storeWith({
        "General.motion": { type: "NUMBER", value: 0.5, label: "Motion" },
        "Transform.zoom": {
          type: "NUMBER",
          value: 1,
          label: "Zoom",
          settings: { min: 0.5, max: 4, step: 0.01 },
        },
        "General.mode": { type: "SELECT", value: "rain", label: "Mode" },
        "General.enabled": { type: "BOOLEAN", value: true, label: "Enabled" },
      }),
    ]);

    expect(properties.map((property) => property.path)).toEqual([
      "General.enabled",
      "General.mode",
      "General.motion",
      "Transform.zoom",
    ]);
    expect(properties.find((property) => property.path === "Transform.zoom")).toMatchObject({
      label: "Zoom",
      min: 0.5,
      max: 4,
      step: 0.01,
    });
  });

  it("excludes actions, monitors, text fields, disabled controls, and structured values", () => {
    const properties = collectTimelineProperties([
      storeWith({
        "Debug.fps": { type: "MONITOR", value: 60, label: "FPS" },
        "General.name": { type: "STRING", value: "Example", label: "Name" },
        "General.action": { type: "BUTTON", value: "run", label: "Run" },
        "General.disabled": { type: "NUMBER", value: 1, label: "Disabled", disabled: true },
        "General.vector": { type: "VECTOR2D", value: { x: 0, y: 0 }, label: "Vector" },
      }),
    ]);

    expect(properties).toEqual([]);
  });
});
