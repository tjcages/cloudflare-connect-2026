import { describe, expect, it, vi } from "vitest";
import {
  collectTimelineProperties,
  displayTimelineColorValue,
  timelineRectsIntersect,
  timelineScrollContentHeight,
  type TimelineLevaStore,
} from "./TimelineEditor";

function storeWith(data: ReturnType<TimelineLevaStore["getData"]>): TimelineLevaStore {
  return {
    getData: () => data,
    getVisiblePaths: () => ["General.motion"],
    set: vi.fn(),
    subscribeToEditEnd: vi.fn(() => vi.fn()),
  };
}

describe("timeline property collection", () => {
  it("reserves one property row of scroll space after the final track", () => {
    expect(timelineScrollContentHeight(0)).toBe(34);
    expect(timelineScrollContentHeight(8)).toBe(306);
  });

  it("selects keyframes that touch the marquee boundary", () => {
    expect(
      timelineRectsIntersect(
        { left: 20, top: 20, right: 30, bottom: 30 },
        { left: 30, top: 10, right: 40, bottom: 20 },
      ),
    ).toBe(true);
    expect(
      timelineRectsIntersect(
        { left: 20, top: 20, right: 29.9, bottom: 30 },
        { left: 30, top: 10, right: 40, bottom: 19.9 },
      ),
    ).toBe(false);
  });

  it("shows library variable names for color keyframes", () => {
    expect(displayTimelineColorValue("#ffffff")).toBe("Neutral / White");
    expect(displayTimelineColorValue("#123456")).toBe("#123456");
  });

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
        "General.serialized": { type: "CUSTOM", value: '[{"id":"one"}]', label: "Structured editor" },
      }),
    ]);

    expect(properties).toEqual([]);
  });

  it("only includes properties for the active graphic layers", () => {
    const store = storeWith({
      "Rain.Grid.gap": { type: "NUMBER", value: 12, label: "Gap" },
      "Twizzler.Motion.speed": { type: "NUMBER", value: 1, label: "Speed" },
      "Background.color": { type: "COLOR", value: "#ffffff", label: "Color" },
    });

    expect(collectTimelineProperties([store], "twizzler").map((property) => property.path)).toEqual([
      "Background.color",
      "Twizzler.Motion.speed",
    ]);
    expect(collectTimelineProperties([store], "rain").map((property) => property.path)).toEqual([
      "Background.color",
      "Rain.Grid.gap",
    ]);
    expect(collectTimelineProperties([store], "both").map((property) => property.path)).toEqual([
      "Background.color",
      "Rain.Grid.gap",
      "Twizzler.Motion.speed",
    ]);
  });

  it("keeps controls with duplicate final keys when their full paths differ", () => {
    const properties = collectTimelineProperties([
      storeWith({
        "Background.color": { type: "COLOR", value: "#ffffff", label: "Color" },
        "Twizzler.General.color": { type: "COLOR", value: "#ff0000", label: "Color" },
      }),
    ]);

    expect(properties.map((property) => property.path)).toEqual(["Background.color", "Twizzler.General.color"]);
  });
});
