import { describe, expect, it } from "vitest";
import { BADGE_TUNE_DEFAULTS, BADGE_TUNE_FIELDS } from "./badge-tune";

const SKIP_FIELD_TYPES = new Set(["section", "presets", "action"]);

describe("badge tune defaults", () => {
  it("prints the case-study shader with a faint, lower shadow", () => {
    expect(BADGE_TUNE_DEFAULTS.printTwizzler).toBe(false);
    expect(BADGE_TUNE_DEFAULTS.printRain).toBe(false);
    expect(BADGE_TUNE_DEFAULTS.printZoom).toBe(1.17);
    expect(BADGE_TUNE_DEFAULTS.sourceLight).toBeGreaterThan(0.5);
    expect(BADGE_TUNE_DEFAULTS.shadowOpacity).toBeLessThan(0.2);
    expect(BADGE_TUNE_DEFAULTS.nudgeY).toBeLessThan(-0.01);
    expect(BADGE_TUNE_DEFAULTS.lightY).toBeLessThan(-0.3);
    expect(BADGE_TUNE_DEFAULTS.logoEnabled).toBe(true);
    expect(BADGE_TUNE_DEFAULTS.logoMarkOpacity).toBe(1);
    expect(BADGE_TUNE_DEFAULTS.printPadX).toBe(0);
    expect(BADGE_TUNE_DEFAULTS.printPadTop).toBe(0);
  });

  it("uses the tuned badge and lanyard setup as the built-in default", () => {
    expect(BADGE_TUNE_DEFAULTS).toMatchObject({
      hangX: -0.61,
      cardOverlap: -0.025,
      cardEmissive: 0.17,
      cardClearcoat: 1,
      shadowOpacity: 0.01,
      shadowSoftOpacity: 0,
      wallZ: -0.015,
      dragLimitDown: 0.047,
      twistPos: 3.5,
      logoBand: 0.21,
      logoPadX: 0.04,
      logoPadY: -0.005,
      logoPrintZoom: 2.2,
      footerBand: 0.205,
      printPadX: 0,
      printPadTop: 0,
      printFeather: 0.065,
      printZoom: 1.17,
      printPanX: -0.4,
      printPanY: -0.065,
      sourceZoom: 1.25,
      sourcePanX: 0,
      sourcePanY: 0,
      sourceLight: 0.78,
      modelScale: 15.8,
    });
  });

  it("lets hook overlap go negative", () => {
    const overlap = BADGE_TUNE_FIELDS.find(
      (field) => field.type === "slider" && field.key === "cardOverlap"
    );
    expect(overlap?.type).toBe("slider");
    if (overlap?.type !== "slider") return;
    expect(overlap.min).toBeLessThan(0);
  });

  it("exposes SVG pan and scale for the shader source", () => {
    const scale = BADGE_TUNE_FIELDS.find(
      (field) => field.type === "slider" && field.key === "sourceZoom"
    );
    const panX = BADGE_TUNE_FIELDS.find(
      (field) => field.type === "slider" && field.key === "sourcePanX"
    );
    expect(scale?.type).toBe("slider");
    expect(panX?.type).toBe("slider");
    if (scale?.type !== "slider" || panX?.type !== "slider") return;
    expect(scale.min).toBeLessThan(1);
    expect(panX.min).toBeLessThan(0);
    expect(panX.max).toBeGreaterThan(0);
  });

  it("exposes SVG lightness and Twizzler overlay sliders", () => {
    const light = BADGE_TUNE_FIELDS.find(
      (field) => field.type === "slider" && field.key === "sourceLight"
    );
    const scale = BADGE_TUNE_FIELDS.find(
      (field) => field.type === "slider" && field.key === "twizzlerScale"
    );
    expect(light?.type).toBe("slider");
    expect(scale?.type).toBe("slider");
    if (light?.type !== "slider" || scale?.type !== "slider") return;
    expect(light.max).toBe(1);
    expect(scale.max).toBeGreaterThan(3);
    expect(BADGE_TUNE_DEFAULTS.twizzlerScale).toBeGreaterThan(1);
  });

  it("exposes a field for every tune key", () => {
    const keys = BADGE_TUNE_FIELDS.flatMap((field) =>
      SKIP_FIELD_TYPES.has(field.type) || !("key" in field) ? [] : [field.key]
    );
    expect(new Set(keys)).toEqual(new Set(Object.keys(BADGE_TUNE_DEFAULTS)));
  });
});
