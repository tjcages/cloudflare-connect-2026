import { describe, expect, it } from "vitest";
import { AGENDA_RAIN_CONFIG } from "./agenda-rain-config";
import { AGENDA_RAIN_DEFAULTS } from "./agenda-rain-controls";

describe("agenda rain controls", () => {
  it("arms the rain streams in the production config", () => {
    expect(AGENDA_RAIN_CONFIG.sparkle.gaps.enabled).toBe(true);
    expect(AGENDA_RAIN_DEFAULTS.rainEnabled).toBe(true);
  });

  it("keeps the factory section-grid rain grid", () => {
    expect(AGENDA_RAIN_CONFIG.grid.cellWidth).toBe(17);
    expect(AGENDA_RAIN_CONFIG.grid.cellHeight).toBe(1);
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

  it("keeps interaction FX off — the overlay is pointer-inert", () => {
    expect(AGENDA_RAIN_CONFIG.cursorTrail.enabled).toBe(false);
    expect(AGENDA_RAIN_CONFIG.clickWave.enabled).toBe(false);
    expect(AGENDA_RAIN_CONFIG.reveal.enabled).toBe(false);
  });
});
