import { describe, expect, it } from "vitest";
import { COMPONENT_REGISTRY, createComponentInstance, snapComponentPosition } from "./componentRegistry";
import { DEFAULT_ICON_ID } from "./iconRegistry";

describe("componentRegistry", () => {
  it("registers icon-box with default corner color", () => {
    expect(COMPONENT_REGISTRY["icon-box"].label).toBe("icon-box");
    expect(COMPONENT_REGISTRY["icon-box"].defaultProps).toEqual({
      cornerColor: "#F3F3F3",
      iconColor: "#903EFC",
      iconId: DEFAULT_ICON_ID,
    });
  });

  it("creates named icon-box instances with snapped coordinates", () => {
    expect(createComponentInstance("icon-box", 43, 79, 2, 800, 560)).toMatchObject({
      id: "icon-box-2",
      type: "icon-box",
      name: "icon-box 2",
      x: 40,
      y: 80,
      props: {
        cornerColor: "#F3F3F3",
        iconColor: "#903EFC",
        iconId: DEFAULT_ICON_ID,
      },
    });
  });

  it("keeps snapped positions inside the logical canvas", () => {
    expect(snapComponentPosition(799, 559, 800, 560, "icon-box")).toEqual({
      x: 720,
      y: 480,
    });
  });
});
