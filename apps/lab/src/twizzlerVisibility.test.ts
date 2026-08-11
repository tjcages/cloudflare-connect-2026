import { describe, expect, it } from "vitest";
import { shouldShowTwizzlerOverlay } from "./twizzlerVisibility";

describe("shouldShowTwizzlerOverlay", () => {
  it("shows the ribbon underlay for any shader source when enabled", () => {
    expect(shouldShowTwizzlerOverlay("shader", true)).toBe(true);
    expect(shouldShowTwizzlerOverlay("shader", false)).toBe(false);
    expect(shouldShowTwizzlerOverlay("texture", true)).toBe(false);
  });
});
