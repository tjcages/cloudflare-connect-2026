import { describe, expect, it } from "vitest";
import { COMET_LOGO_CONFIG_VERSION, COMET_LOGO_DEFAULTS, normalizeCometLogoSettings } from "./config";

describe("normalizeCometLogoSettings", () => {
  it("uses the current shader look as its defaults", () => {
    expect(normalizeCometLogoSettings(undefined)).toEqual(COMET_LOGO_DEFAULTS);
  });

  it("preserves valid settings and clamps unsafe values", () => {
    expect(
      normalizeCometLogoSettings({
        fieldSpeed: 2.4,
        formationDuration: 0,
        centerPreference: 2,
        eruptionFrequency: -1,
        fireIntensity: Number.NaN,
      }),
    ).toMatchObject({
      fieldSpeed: 2.4,
      formationDuration: 0.2,
      centerPreference: 1,
      eruptionFrequency: 0,
      fireIntensity: COMET_LOGO_DEFAULTS.fireIntensity,
    });
  });

  it("upgrades the original formation duration once", () => {
    expect(normalizeCometLogoSettings({ formationDuration: 1.8 }).formationDuration).toBe(2.1);
    expect(
      normalizeCometLogoSettings({
        version: COMET_LOGO_CONFIG_VERSION,
        formationDuration: 1.8,
      }).formationDuration,
    ).toBe(1.8);
  });
});
