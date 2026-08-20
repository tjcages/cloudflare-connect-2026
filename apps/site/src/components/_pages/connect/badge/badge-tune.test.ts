import { describe, expect, it } from "vitest";
import { BADGE_TUNE_DEFAULTS, BADGE_TUNE_FIELDS } from "./badge-tune";

const SKIP_FIELD_TYPES = new Set(["section", "presets", "action"]);

describe("badge tune defaults", () => {
  it("prints the case-study shader with a faint, lower shadow", () => {
    expect(BADGE_TUNE_DEFAULTS.printTwizzler).toBe(false);
    expect(BADGE_TUNE_DEFAULTS.printRain).toBe(false);
    expect(BADGE_TUNE_DEFAULTS.printZoom).toBe(1.17);
    expect(BADGE_TUNE_DEFAULTS.sourceLight).toBe(0.1);
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
      hangX: -0.12,
      cardOverlap: -0.025,
      cardEmissive: 0.17,
      cardClearcoat: 1,
      shadowOpacity: 0.01,
      shadowSoftOpacity: 0,
      wallZ: -0.03,
      dragLimitDown: 0.047,
      twistPos: 3.5,
      logoBand: 0.21,
      logoPadX: 0.04,
      logoPadY: -0.005,
      logoPrintZoom: 1.6,
      footerBand: 0.28,
      printPadX: 0,
      printPadTop: 0,
      printFeather: 0.065,
      printZoom: 1.17,
      printPanX: -0.44,
      printPanY: -0.065,
      sourceZoom: 1.18,
      sourcePanX: 0.001,
      sourcePanY: 0,
      sourceLight: 0.1,
      modelScale: 15.8,
      logoScale: 1.26,
    });
  });

  it("bakes the shared panel snapshot as defaults", () => {
    expect(BADGE_TUNE_DEFAULTS).toMatchObject({
      modelScale: 15.8,
      hangLift: 0.38,
      hangX: -0.12,
      hangZ: 0,
      cardWidth: 0.1,
      cardHeight: 0.158,
      cardDepth: 0.003,
      cardRadius: 0.013,
      cardOverlap: -0.025,
      shaderInset: 0.0035,
      cardEmissive: 0.17,
      cardRoughness: 0.18,
      cardClearcoat: 1,
      cameraFov: 30,
      cameraX: 0,
      cameraY: 0.15,
      cameraZ: 8,
      printZoom: 1.17,
      printPanX: -0.44,
      printPanY: -0.065,
      printTwizzler: false,
      printRain: false,
      printPadX: 0,
      printPadTop: 0,
      printFeather: 0.065,
      sourceZoom: 1.18,
      sourcePanX: 0.001,
      sourcePanY: 0,
      shadowOpacity: 0.01,
      shadowSoftOpacity: 0,
      wallZ: -0.03,
      lightX: -0.55,
      lightY: -0.55,
      lightZ: -1,
      nudgeX: -0.01,
      nudgeY: -0.024,
      inflate: 0.032,
      fadeStart: 2.2,
      fadeEnd: 4.8,
      gravity: -0.85,
      dampingTip: 0.95,
      dampingCord: 0.98,
      dampingY: 0.9,
      dragFollow: 0.12,
      restPull: 0.01,
      swayFollow: 0.16,
      dragLimitX: 0.28,
      dragLimitDown: 0.047,
      constraintStiffness: 0.32,
      twistPos: 3.5,
      twistVel: 10,
      twistMax: 0.72,
      twistSmooth: 0.055,
      rollPos: 0.42,
      rollMax: 0.2,
      inwardZ: 0.2,
      ambient: 0.58,
      hemi: 0.5,
      keyLight: 1.45,
      fillLight: 0.7,
      rimLight: 0.7,
      logoEnabled: true,
      logoBand: 0.21,
      logoPadX: 0.04,
      logoPadY: -0.005,
      logoScale: 1.26,
      logoPrintZoom: 1.6,
      logoMarkOpacity: 1,
      footerBand: 0.28,
      backdropZoom: 1,
      backdropMaskW: 62,
      backdropMaskH: 78,
      backdropMaskX: 62,
      backdropMaskY: 44,
      twizzlerScale: 3.65,
      twizzlerLineCount: 79,
      twizzlerSpeed: 0.95,
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

  it("exposes SVG brightness and Twizzler overlay sliders", () => {
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
