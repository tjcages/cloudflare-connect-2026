import { describe, expect, it } from "vitest";
import { BADGE_TUNE_DEFAULTS, BADGE_TUNE_FIELDS } from "./badge-tune";

const SKIP_FIELD_TYPES = new Set(["section", "presets", "action"]);

describe("badge tune defaults", () => {
  it("starts zoomed out with a faint, lower shadow", () => {
    expect(BADGE_TUNE_DEFAULTS.printZoom).toBeLessThan(1);
    expect(BADGE_TUNE_DEFAULTS.shadowOpacity).toBeLessThan(0.2);
    expect(BADGE_TUNE_DEFAULTS.nudgeY).toBeLessThan(-0.01);
    expect(BADGE_TUNE_DEFAULTS.lightY).toBeLessThan(-0.3);
    expect(BADGE_TUNE_DEFAULTS.logoEnabled).toBe(true);
    expect(BADGE_TUNE_DEFAULTS.logoMarkOpacity).toBe(0);
    expect(BADGE_TUNE_DEFAULTS.cardOverlap).toBeLessThan(0.006);
  });

  it("lets hook overlap go negative", () => {
    const overlap = BADGE_TUNE_FIELDS.find(
      (field) => field.type === "slider" && field.key === "cardOverlap"
    );
    expect(overlap?.type).toBe("slider");
    if (overlap?.type !== "slider") return;
    expect(overlap.min).toBeLessThan(0);
  });

  it("exposes a field for every tune key", () => {
    const keys = BADGE_TUNE_FIELDS.flatMap((field) =>
      SKIP_FIELD_TYPES.has(field.type) || !("key" in field) ? [] : [field.key]
    );
    expect(new Set(keys)).toEqual(new Set(Object.keys(BADGE_TUNE_DEFAULTS)));
  });
});
