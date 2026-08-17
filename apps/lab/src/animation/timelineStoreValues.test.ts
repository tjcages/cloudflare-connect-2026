import { describe, expect, it } from "vitest";
import { parseTwizzlerGradientStops, serializeTwizzlerGradientStops } from "../twizzlerGradient";
import { buildTimelineStoreUpdates } from "./timelineStoreValues";

describe("timeline store value routing", () => {
  it("only updates the exact paths owned by a store", () => {
    const data = {
      "Twizzler.Shape.amplitude": { value: 0.25 },
      "Rain.Shape.amplitude": { value: 0.5 },
    };

    expect(
      buildTimelineStoreUpdates(
        {
          "Twizzler.Shape.amplitude": 0.8,
          "Other.Shape.amplitude": 0.1,
        },
        data,
      ),
    ).toEqual({ "Twizzler.Shape.amplitude": 0.8 });
  });

  it("animates the three shared-field color aliases through canonical gradient stops", () => {
    const gradientPath = "Twizzler.General.twizzlerGradientStops";
    const initial = serializeTwizzlerGradientStops([
      { id: "far", x: 0.08, y: 0.78, offset: 0.08, color: "#111111" },
      { id: "peak", x: 0.5, y: 0.16, offset: 0.5, color: "#222222" },
      { id: "near", x: 0.92, y: 0.72, offset: 0.92, color: "#333333" },
    ]);
    const data = {
      "Twizzler.General.twizzlerRibbonColorMode": { value: "sharedGradient" },
      "Twizzler.General.twizzlerColorFar": { value: "#111111" },
      "Twizzler.General.twizzlerColorEdge": { value: "#222222" },
      "Twizzler.General.twizzlerColor": { value: "#333333" },
      [gradientPath]: { value: initial },
    };

    const updates = buildTimelineStoreUpdates(
      {
        "Twizzler.General.twizzlerColorFar": "#ff0000",
        "Twizzler.General.twizzlerColorEdge": "#00ff00",
        "Twizzler.General.twizzlerColor": "#0000ff",
      },
      data,
    );
    const stops = parseTwizzlerGradientStops(updates[gradientPath], "#ff0000", "#0000ff");

    expect(stops.map((stop) => stop.color)).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
    expect(updates).toMatchObject({
      "Twizzler.General.twizzlerColorFar": "#ff0000",
      "Twizzler.General.twizzlerColorEdge": "#00ff00",
      "Twizzler.General.twizzlerColor": "#0000ff",
    });
  });

  it("does not rewrite gradient stops when baked colors are authoritative", () => {
    const data = {
      "Twizzler.General.twizzlerRibbonColorMode": { value: "baked" },
      "Twizzler.General.twizzlerColor": { value: "#333333" },
      "Twizzler.General.twizzlerGradientStops": { value: "[]" },
    };

    expect(buildTimelineStoreUpdates({ "Twizzler.General.twizzlerColor": "#ffffff" }, data)).toEqual({
      "Twizzler.General.twizzlerColor": "#ffffff",
    });
  });
});
