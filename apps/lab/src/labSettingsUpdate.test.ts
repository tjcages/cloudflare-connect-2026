import { describe, expect, it } from "vitest";
import { nextLabSettings } from "./labSettingsUpdate";
import { DEFAULT_LAB_SETTINGS, normalizeLabSettings } from "./persistence";
import { normalizeTwizzlerSettings } from "./twizzler";

describe("nextLabSettings", () => {
  it("returns null when the patch already matches live state", () => {
    const prev = normalizeLabSettings(DEFAULT_LAB_SETTINGS);
    expect(nextLabSettings(prev, { twizzler: prev.twizzler, twizzlerEnabled: prev.twizzlerEnabled })).toBeNull();
  });

  it("keeps the live Twizzler snapshot so persist can settle (CF-73)", () => {
    const prev = normalizeLabSettings(DEFAULT_LAB_SETTINGS);
    const levaWidth = 1.1500000000000001;
    const next = nextLabSettings(prev, {
      twizzler: { ...prev.twizzler, lineWidth: levaWidth },
    });
    expect(next).not.toBeNull();
    expect(next!.twizzler.lineWidth).toBe(levaWidth);
    expect(nextLabSettings(next!, { twizzler: next!.twizzler })).toBeNull();
  });

  it("normalizeTwizzlerSettings is idempotent so persist cannot ping-pong", () => {
    const once = normalizeTwizzlerSettings({
      lineWidth: 2.35,
      ribbonColorMode: "sharedGradient",
      gradientStops: [
        { id: "far", x: 0.12, y: 0.4, offset: 0.12, color: "#ffaa00" },
        { id: "peak", x: 0.5, y: 0.2, offset: 0.5, color: "#e92e28" },
        { id: "near", x: 0.88, y: 0.7, offset: 0.88, color: "#f46021" },
      ],
    });
    expect(normalizeTwizzlerSettings(once)).toEqual(once);
  });
});
