import { describe, expect, it } from "vitest";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "@/components/_pages/connect/hero/twizzler-defaults";
import { applyThemeToTwizzler, findBadgeTheme } from "./badge-themes";
import { BADGE_TUNE_DEFAULTS } from "./badge-tune";
import {
  applyBadgeTwizzlerOverlay,
  BADGE_TWIZZLER_OVERLAY_DEFAULTS,
} from "./badge-twizzler-overlay";

describe("badge twizzler overlay", () => {
  it("starts from the hero ribbon and keeps theme ink", () => {
    const theme = findBadgeTheme("blue");
    const overlay = applyBadgeTwizzlerOverlay(
      applyThemeToTwizzler(theme),
      BADGE_TUNE_DEFAULTS
    );
    expect(overlay.color).toBe(theme.twizzler.color);
    expect(overlay.scale).toBe(BADGE_TUNE_DEFAULTS.twizzlerScale);
    expect(overlay.lineCount).toBe(BADGE_TUNE_DEFAULTS.twizzlerLineCount);
  });

  it("applies overlay sliders on top of the themed ribbon", () => {
    const overlay = applyBadgeTwizzlerOverlay(CONNECT_HERO_TWIZZLER_DEFAULTS, {
      ...BADGE_TWIZZLER_OVERLAY_DEFAULTS,
      twizzlerOpacity: 0.4,
      twizzlerScale: 8,
      twizzlerLineCount: 12.6,
      twizzlerSpeed: 2.5,
    });
    expect(overlay.opacity).toBe(0.4);
    expect(overlay.scale).toBe(8);
    expect(overlay.lineCount).toBe(13);
    expect(overlay.speed).toBe(2.5);
    expect(overlay.color).toBe(CONNECT_HERO_TWIZZLER_DEFAULTS.color);
  });
});
