import { describe, expect, it } from "vitest";
import { flagsFromGraphicMode, graphicModeFromFlags, isClientGraphicMode } from "./clientGraphicMode";

describe("clientGraphicMode", () => {
  it("maps each Graphic mode to Show/Rain flags", () => {
    expect(flagsFromGraphicMode("twizzler")).toEqual({ twizzlerEnabled: true, rainEnabled: false });
    expect(flagsFromGraphicMode("rain")).toEqual({ twizzlerEnabled: false, rainEnabled: true });
    expect(flagsFromGraphicMode("both")).toEqual({ twizzlerEnabled: true, rainEnabled: true });
  });

  it("derives Graphic mode from flags and normalizes both-off to Twizzler", () => {
    expect(graphicModeFromFlags(true, false)).toBe("twizzler");
    expect(graphicModeFromFlags(false, true)).toBe("rain");
    expect(graphicModeFromFlags(true, true)).toBe("both");
    expect(graphicModeFromFlags(false, false)).toBe("twizzler");
  });

  it("round-trips every Graphic mode", () => {
    for (const mode of ["twizzler", "rain", "both"] as const) {
      const flags = flagsFromGraphicMode(mode);
      expect(graphicModeFromFlags(flags.twizzlerEnabled, flags.rainEnabled)).toBe(mode);
    }
  });

  it("narrows Graphic mode strings", () => {
    expect(isClientGraphicMode("twizzler")).toBe(true);
    expect(isClientGraphicMode("rain")).toBe(true);
    expect(isClientGraphicMode("both")).toBe(true);
    expect(isClientGraphicMode("show")).toBe(false);
    expect(isClientGraphicMode(null)).toBe(false);
  });
});
