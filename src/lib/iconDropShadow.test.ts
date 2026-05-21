import { describe, expect, it } from "vitest";
import { accentBarDropShadowPixiLayers, iconDropShadowFilterCss, iconDropShadowPixiLayers } from "./iconDropShadow";

describe("iconDropShadow", () => {
  it("matches the design spec CSS filter for a theme color", () => {
    expect(iconDropShadowFilterCss("#A045FF")).toBe(
      "drop-shadow(0 0.5px 0.5px rgba(160, 69, 255, 0.12)) drop-shadow(0 1px 1.5px rgba(160, 69, 255, 0.16)) drop-shadow(0 2px 2.5px rgba(160, 69, 255, 0.12))",
    );
  });

  it("exposes Pixi icon layers with 0.5px, 1.5px, and 2.5px blur radii", () => {
    expect(iconDropShadowPixiLayers(0xa045ff)).toEqual([
      expect.objectContaining({ offsetY: 0.5, blur: 0.5, alpha: 0.12, color: 0xa045ff }),
      expect.objectContaining({ offsetY: 1, blur: 1.5, alpha: 0.16, color: 0xa045ff }),
      expect.objectContaining({ offsetY: 2, blur: 2.5, alpha: 0.12, color: 0xa045ff }),
    ]);
  });

  it("exposes Pixi accent bar layers matching the design spec", () => {
    expect(accentBarDropShadowPixiLayers(0xa045ff)).toEqual([
      expect.objectContaining({ offsetY: 0.5, blur: 0.5, alpha: 0.12, color: 0xa045ff }),
      expect.objectContaining({ offsetY: 1, blur: 1, alpha: 0.16, color: 0xa045ff }),
      expect.objectContaining({ offsetY: 2, blur: 4, alpha: 0.12, color: 0xa045ff }),
      expect.objectContaining({ offsetY: 4, blur: 12, alpha: 0.48, color: 0xa045ff }),
    ]);
  });
});
