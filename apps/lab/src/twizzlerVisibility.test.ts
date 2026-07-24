import { describe, expect, it } from "vitest";
import { CONNECT_SHADER_PRESET_ID, TWIZZLER_MAP_SHADER_PRESET_ID } from "./shaderLibrary";
import { shouldShowTwizzlerOverlay } from "./twizzlerVisibility";

describe("shouldShowTwizzlerOverlay", () => {
  it("shows the overlay only when Twizzler Map is enabled and stripes are hidden", () => {
    expect(shouldShowTwizzlerOverlay("shader", TWIZZLER_MAP_SHADER_PRESET_ID, true, false)).toBe(true);
    expect(shouldShowTwizzlerOverlay("shader", TWIZZLER_MAP_SHADER_PRESET_ID, true, true)).toBe(false);
    expect(shouldShowTwizzlerOverlay("shader", TWIZZLER_MAP_SHADER_PRESET_ID, false, false)).toBe(false);
    expect(shouldShowTwizzlerOverlay("shader", CONNECT_SHADER_PRESET_ID, true, false)).toBe(false);
    expect(shouldShowTwizzlerOverlay("texture", TWIZZLER_MAP_SHADER_PRESET_ID, true, false)).toBe(false);
  });
});
