import { describe, expect, it } from "vitest";
import { AGENDA_RAIN_CONFIG } from "./agenda-rain-config";
import { AGENDA_RAIN_DEFAULTS } from "./agenda-rain-controls";
import {
  findRainShaderSource,
  RAIN_SHADER_LIBRARY,
} from "./rain-shader-library";
import {
  DEFAULT_RAIN_SHADER_ID,
  DEFAULT_RAIN_SHADER_SOURCE,
} from "./rain-texture-source";

describe("agenda rain controls", () => {
  it("arms the rain streams in the production config", () => {
    expect(AGENDA_RAIN_CONFIG.sparkle.gaps.enabled).toBe(true);
    expect(AGENDA_RAIN_DEFAULTS.rainEnabled).toBe(true);
  });

  it("keeps the authored section-grid rain grid", () => {
    expect(AGENDA_RAIN_CONFIG.grid.cellWidth).toBe(13);
    expect(AGENDA_RAIN_CONFIG.grid.cellHeight).toBe(15);
    expect(AGENDA_RAIN_CONFIG.grid.gapX).toBe(12);
    expect(AGENDA_RAIN_CONFIG.grid.angleDeg).toBe(45);
    expect(AGENDA_RAIN_CONFIG.grid.orientation).toBe("vertical");
  });

  it("mirrors the config into editable defaults with distinct stripe rows", () => {
    expect(AGENDA_RAIN_DEFAULTS.stripes).toHaveLength(
      AGENDA_RAIN_CONFIG.stripes.length
    );
    expect(new Set(AGENDA_RAIN_DEFAULTS.stripes.map(({ id }) => id)).size).toBe(
      AGENDA_RAIN_DEFAULTS.stripes.length
    );
    expect(AGENDA_RAIN_DEFAULTS.stripes[0].color).toBe("#fafafa");
    expect(AGENDA_RAIN_DEFAULTS.fieldScale).toBe(
      AGENDA_RAIN_CONFIG.fieldScale
    );
  });

  it("defaults the texture source to the authored library preset", () => {
    expect(AGENDA_RAIN_DEFAULTS.shaderPreset).toBe(DEFAULT_RAIN_SHADER_ID);
    const defaultEntry = RAIN_SHADER_LIBRARY.find(
      ({ id }) => id === DEFAULT_RAIN_SHADER_ID
    );
    expect(defaultEntry?.label).toBe("Page Grid");
    // The inlined copy must stay in step with the library entry it mirrors.
    expect(DEFAULT_RAIN_SHADER_SOURCE).toContain("sceneRadiantFurnace");
    expect(defaultEntry?.source).toContain("sceneRadiantFurnace");
  });

  it("ships a picker-ready shader library with unique ids and sources", () => {
    expect(RAIN_SHADER_LIBRARY.length).toBeGreaterThanOrEqual(30);
    expect(new Set(RAIN_SHADER_LIBRARY.map(({ id }) => id)).size).toBe(
      RAIN_SHADER_LIBRARY.length
    );
    for (const entry of RAIN_SHADER_LIBRARY) {
      expect(entry.source).toContain("mainImage");
    }
    expect(findRainShaderSource("not-a-shader")).toBeNull();
  });

  it("keeps interaction FX off — the overlay is pointer-inert", () => {
    expect(AGENDA_RAIN_CONFIG.cursorTrail.enabled).toBe(false);
    expect(AGENDA_RAIN_CONFIG.clickWave.enabled).toBe(false);
    expect(AGENDA_RAIN_CONFIG.reveal.enabled).toBe(false);
  });
});
