import { describe, expect, it } from "vitest";
import { COMPONENT_REGISTRY, createComponentInstance, snapComponentPosition } from "./componentRegistry";
import { ICON_BOX_INNER_CENTER_X, ICON_BOX_INNER_CENTER_Y } from "./iconBoxLayout";
import { DEFAULT_ICON_ID } from "./iconRegistry";

describe("componentRegistry", () => {
  it("registers icon-box with default corner color", () => {
    expect(COMPONENT_REGISTRY["icon-box"].label).toBe("icon-box");
    expect(COMPONENT_REGISTRY["icon-box"].defaultProps).toEqual({
      cornerColor: "#F3F3F3",
      theme: "purple",
      iconId: DEFAULT_ICON_ID,
      titleText: "Workers",
    });
  });

  it("creates named icon-box instances with snapped coordinates", () => {
    expect(createComponentInstance("icon-box", 43, 79, 2, 800, 560)).toMatchObject({
      id: "icon-box-2",
      type: "icon-box",
      name: "icon-box 2",
      x: 40,
      y: 92,
      props: {
        cornerColor: "#F3F3F3",
        theme: "purple",
        iconId: DEFAULT_ICON_ID,
        titleText: "Workers",
      },
    });
  });

  it("snaps icon-box by the inner card center (includes side padding)", () => {
    const snapped = snapComponentPosition(50, 50, 800, 560, "icon-box");
    expect(snapped.x + ICON_BOX_INNER_CENTER_X).toBe(80);
    expect(snapped.y + ICON_BOX_INNER_CENTER_Y).toBe(120);
  });

  it("when dragging past the top/left, snaps to the nearest valid grid anchor inside bounds", () => {
    const p = snapComponentPosition(-200, -200, 800, 560, "icon-box");
    expect(p.x).toBe(0);
    expect(p.y).toBe(12);
    expect(p.x + ICON_BOX_INNER_CENTER_X).toBe(40);
    expect(p.y + ICON_BOX_INNER_CENTER_Y).toBe(80);
  });

  it("keeps snapped positions inside the logical canvas", () => {
    expect(snapComponentPosition(799, 559, 800, 560, "icon-box")).toEqual({
      x: 720,
      y: 412,
    });
  });
});
