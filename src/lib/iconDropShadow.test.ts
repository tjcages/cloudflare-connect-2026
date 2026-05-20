import { describe, expect, it } from "vitest";
import { iconDropShadowFilterCss, iconDropShadowPixiLayers } from "./iconDropShadow";

describe("iconDropShadow", () => {
  it("matches the design spec CSS filter for a theme color", () => {
    expect(iconDropShadowFilterCss("#A045FF")).toBe(
      "drop-shadow(0 0.5px 0.5px rgba(160, 69, 255, 0.12)) drop-shadow(0 1px 1px rgba(160, 69, 255, 0.12))",
    );
  });

  it("exposes Pixi layers with 0.5px and 1px blur radii", () => {
    expect(iconDropShadowPixiLayers(0xa045ff)).toEqual([
      expect.objectContaining({ offsetY: 0.5, blur: 0.5, alpha: 0.12, color: 0xa045ff }),
      expect.objectContaining({ offsetY: 1, blur: 1, alpha: 0.12, color: 0xa045ff }),
    ]);
  });
});
