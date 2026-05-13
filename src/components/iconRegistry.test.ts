import { describe, expect, it } from "vitest";
import { DEFAULT_ICON_ID, ICON_REGISTRY, getIconDefinition } from "./iconRegistry";

describe("iconRegistry", () => {
  it("registers the default icon-box icon from path data", () => {
    const icon = getIconDefinition(DEFAULT_ICON_ID);

    expect(icon.label).toBe("Section mark");
    expect(icon.viewBox).toBe("0 0 24 24");
    expect(icon.paths).toHaveLength(3);
    expect(ICON_REGISTRY[0]).toBe(icon);
  });

  it("includes stroke-based icons for the icon picker", () => {
    const hex = getIconDefinition("isometric-hex");
    const user = getIconDefinition("user-outline");

    expect(hex.renderMode).toBe("stroke");
    expect(user.renderMode).toBe("stroke");
    expect(ICON_REGISTRY).toHaveLength(3);
  });
});
