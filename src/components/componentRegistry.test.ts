import { describe, expect, it } from "vitest";
import {
  COMPONENT_REGISTRY,
  createComponentInstance,
  getInstanceLayerSubtitle,
  snapComponentPosition,
} from "./componentRegistry";
import { ICON_BOX_INNER_CENTER_X, ICON_BOX_INNER_CENTER_Y } from "./iconBoxLayout";
import { DEFAULT_ICON_ID } from "./iconRegistry";

describe("componentRegistry", () => {
  it("registers icon-box with corners not matched to theme by default", () => {
    expect(COMPONENT_REGISTRY["icon-box"].label).toBe("Icon Box");
    expect(COMPONENT_REGISTRY["icon-box"].defaultProps).toEqual({
      matchCornersWithTheme: false,
      theme: "purple",
      iconId: DEFAULT_ICON_ID,
      title: "Workers",
    });
  });

  it("creates named icon-box instances with snapped coordinates", () => {
    expect(createComponentInstance("icon-box", 43, 79, 2, 800, 560)).toMatchObject({
      id: "icon-box-2",
      type: "icon-box",
      name: "Icon Box 2",
      x: 40,
      y: 92,
      props: {
        matchCornersWithTheme: false,
        theme: "purple",
        iconId: DEFAULT_ICON_ID,
        title: "Workers",
      },
    });
  });

  it("getInstanceLayerSubtitle returns undefined for blank title", () => {
    const inst = createComponentInstance("icon-box", 0, 0, 1, 800, 560);
    expect(
      getInstanceLayerSubtitle({
        ...inst,
        props: { ...inst.props, title: "" },
      }),
    ).toBeUndefined();
    expect(
      getInstanceLayerSubtitle({
        ...inst,
        props: { ...inst.props, title: "   " },
      }),
    ).toBeUndefined();
  });

  it("getInstanceLayerSubtitle returns trimmed title when non-empty", () => {
    const inst = createComponentInstance("icon-box", 0, 0, 1, 800, 560);
    expect(getInstanceLayerSubtitle({ ...inst, props: { ...inst.props, title: "KV" } })).toBe("KV");
    expect(getInstanceLayerSubtitle({ ...inst, props: { ...inst.props, title: "  hi  " } })).toBe("hi");
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
