import { describe, expect, it } from "vitest";
import {
  COMPONENT_REGISTRY,
  createComponentInstance,
  getInstanceCanvasBounds,
  getInstanceHighlightBounds,
  getInstanceLayerSubtitle,
  snapComponentPosition,
} from "./componentRegistry";
import {
  ICON_BOX_CARD_FRAME_ORIGIN_Y,
  ICON_BOX_HIGHLIGHT_HEIGHT,
  ICON_BOX_OUTER_HEIGHT,
  ICON_BOX_SNAP_ANCHOR_X,
  ICON_BOX_SNAP_ANCHOR_Y,
} from "./iconBoxLayout";
import { DEFAULT_ICON_ID } from "./iconRegistry";

describe("componentRegistry", () => {
  it("registers icon-box with corners not matched to theme by default", () => {
    expect(COMPONENT_REGISTRY["icon-box"].label).toBe("Icon Box");
    expect(COMPONENT_REGISTRY["icon-box"].defaultProps).toEqual({
      matchCornersWithTheme: false,
      theme: "purple",
      iconId: DEFAULT_ICON_ID,
      title: "Workers",
      containerHighlighted: false,
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
        containerHighlighted: false,
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

  it("snaps icon-box by the shadow-card snap anchor (center of interaction rect)", () => {
    const snapped = snapComponentPosition(50, 50, 800, 560, "icon-box");
    expect(snapped.x + ICON_BOX_SNAP_ANCHOR_X).toBe(80);
    expect(snapped.y + ICON_BOX_SNAP_ANCHOR_Y).toBe(120);
  });

  it("when dragging past the top/left, snaps to the nearest valid grid anchor inside bounds", () => {
    const p = snapComponentPosition(-200, -200, 800, 560, "icon-box");
    expect(p.x).toBe(0);
    expect(p.y).toBe(-28);
    expect(p.x + ICON_BOX_SNAP_ANCHOR_X).toBe(40);
    expect(p.y + ICON_BOX_SNAP_ANCHOR_Y).toBe(40);
  });

  it("keeps snapped positions inside the logical canvas", () => {
    expect(snapComponentPosition(799, 559, 800, 560, "icon-box")).toEqual({
      x: 720,
      y: 412,
    });
  });

  it("getInstanceHighlightBounds covers title and footprint while hit bounds stay on shadow card only", () => {
    const inst = createComponentInstance("icon-box", 100, 200, 1, 800, 560);
    const hit = getInstanceCanvasBounds(inst);
    const hilite = getInstanceHighlightBounds(inst);

    expect(hilite.y).toBe(inst.y);
    expect(hilite.height).toBe(ICON_BOX_HIGHLIGHT_HEIGHT);
    expect(hilite.height).toBeLessThan(ICON_BOX_OUTER_HEIGHT);
    expect(hit.y).toBe(inst.y + ICON_BOX_CARD_FRAME_ORIGIN_Y);
    expect(hilite.height).toBeGreaterThan(hit.height);
  });
});
