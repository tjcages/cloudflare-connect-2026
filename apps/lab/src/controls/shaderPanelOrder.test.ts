import { describe, expect, it } from "vitest";
import { SHADER_PANEL_ORDER } from "./shaderPanelOrder";

describe("SHADER_PANEL_ORDER", () => {
  it("keeps stage Background outside Rain so Fill/Color/Gradient stay visible for Twizzler (CF-71)", () => {
    expect(SHADER_PANEL_ORDER).toEqual(["Size", "Style", "Appearance", "Hero", "Background", "Twizzler", "Rain"]);
  });
});
