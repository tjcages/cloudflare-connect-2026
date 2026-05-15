import { describe, expect, it } from "vitest";
import type { ComponentInstance } from "../grid/types";
import {
  COMPONENT_REGISTRY,
  RECT_MARKER_RENDER_OFFSET,
  createComponentInstance,
  getInstanceAnchorPoint,
  getInstanceCanvasBounds,
  getInstanceHighlightBounds,
  getInstanceLayerSubtitle,
  snapComponentPosition,
} from "./componentRegistry";
import {
  ICON_BOX_CARD_FRAME_ORIGIN_Y,
  ICON_BOX_CARD_FRAME_SIZE,
  ICON_BOX_HIGHLIGHT_HEIGHT,
  ICON_BOX_OUTER_HEIGHT,
  ICON_BOX_SNAP_ANCHOR_X,
  ICON_BOX_SNAP_ANCHOR_Y,
} from "./icon-box/layout";
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

  it("registers connector-line with static cell endpoints and horizontal preference by default", () => {
    expect(COMPONENT_REGISTRY["connector-line"].label).toBe("Connector Line");
    expect(COMPONENT_REGISTRY["connector-line"].defaultProps).toEqual({
      preferredConnection: "horizontal",
      source: { kind: "cell", x: 40, y: 40 },
      target: { kind: "cell", x: 200, y: 40 },
      overlayGrid: true,
      animated: true,
    });
  });

  it("registers plus-marker as 40×40 with orange theme by default", () => {
    expect(COMPONENT_REGISTRY["plus-marker"].label).toBe("Plus Marker");
    expect(COMPONENT_REGISTRY["plus-marker"]).toMatchObject({
      width: 40,
      height: 40,
      snapAnchorX: 0,
      snapAnchorY: 0,
      defaultProps: { theme: "orange" },
    });
  });

  it("creates plus-marker instances snapped to the 40px base grid", () => {
    expect(createComponentInstance("plus-marker", 43, 79, 2, 800, 560)).toMatchObject({
      id: "plus-marker-2",
      type: "plus-marker",
      name: "Plus Marker 2",
      x: 40,
      y: 80,
      props: { theme: "orange" },
    });
  });

  it("snaps plus-marker top-left to the 40px lattice", () => {
    expect(snapComponentPosition(55, 55, 800, 560, "plus-marker")).toEqual({ x: 40, y: 40 });
  });

  it("uses registry footprint for plus-marker canvas bounds", () => {
    const inst = createComponentInstance("plus-marker", 43, 79, 2, 800, 560);
    expect(getInstanceCanvasBounds(inst)).toEqual({ x: inst.x, y: inst.y, width: 40, height: 40 });
  });

  it("registers rect-marker as 4×4px with orange theme by default", () => {
    expect(COMPONENT_REGISTRY["rect-marker"].label).toBe("Rect Marker");
    expect(COMPONENT_REGISTRY["rect-marker"]).toMatchObject({
      width: 4,
      height: 4,
      snapAnchorX: 2,
      snapAnchorY: 2,
      defaultProps: { theme: "orange" },
    });
  });

  it("creates rect-marker instances snapped to the 40px base grid", () => {
    expect(createComponentInstance("rect-marker", 43, 79, 2, 800, 560)).toMatchObject({
      id: "rect-marker-2",
      type: "rect-marker",
      name: "Rect Marker 2",
      x: 38,
      y: 78,
      props: { theme: "orange" },
    });
  });

  it("snaps rect-marker center (via anchor) to the 40px lattice", () => {
    expect(snapComponentPosition(55, 55, 800, 560, "rect-marker")).toEqual({ x: 38, y: 38 });
  });

  it("uses footprint plus render offset for rect-marker canvas bounds", () => {
    const inst = createComponentInstance("rect-marker", 43, 79, 2, 800, 560);
    expect(getInstanceCanvasBounds(inst)).toEqual({
      x: inst.x + RECT_MARKER_RENDER_OFFSET,
      y: inst.y + RECT_MARKER_RENDER_OFFSET,
      width: 4,
      height: 4,
    });
  });

  it("creates named icon-box instances with snapped coordinates", () => {
    expect(createComponentInstance("icon-box", 43, 79, 2, 800, 560)).toMatchObject({
      id: "icon-box-2",
      type: "icon-box",
      name: "Icon Box 2",
      x: 80,
      y: 52,
      props: {
        matchCornersWithTheme: false,
        theme: "purple",
        iconId: DEFAULT_ICON_ID,
        title: "Workers",
        containerHighlighted: false,
      },
    });
  });

  it("creates connector-line instances with endpoints snapped to the 80px connector lattice", () => {
    expect(createComponentInstance("connector-line", 82, 119, 3, 800, 560)).toMatchObject({
      id: "connector-line-3",
      type: "connector-line",
      name: "Connector Line 3",
      x: 120,
      y: 120,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "cell", x: 120, y: 120 },
        target: { kind: "cell", x: 280, y: 120 },
        overlayGrid: true,
        animated: true,
      },
    });
  });

  it("creates connector-line targets to the left when placed near the right canvas edge", () => {
    expect(createComponentInstance("connector-line", 790, 119, 4, 800, 560)).toMatchObject({
      props: {
        source: { kind: "cell", x: 760, y: 120 },
        target: { kind: "cell", x: 600, y: 120 },
      },
    });
  });

  it("getInstanceLayerSubtitle formats connector-line with icon layer titles joined by arrow", () => {
    const ib1 = createComponentInstance("icon-box", 43, 79, 1, 800, 560);
    const ib2 = createComponentInstance("icon-box", 200, 200, 2, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    const durable: ComponentInstance = {
      ...ib2,
      props: { ...ib2.props, title: "Durable Objects" },
    };
    const connector: ComponentInstance = {
      id: "connector-line-1",
      type: "connector-line",
      name: "Connector Line 1",
      x: 40,
      y: 40,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "layer", instanceId: ib1.id },
        target: { kind: "layer", instanceId: durable.id },
        overlayGrid: true,
        animated: true,
      },
    };
    const instances = [ib1, durable, connector];
    expect(getInstanceLayerSubtitle(connector, instances)).toBe("Icon Box / Workers → Icon Box / Durable Objects");
  });

  it("getInstanceLayerSubtitle formats connector-line static cells with spaces", () => {
    const connector: ComponentInstance = {
      id: "connector-line-1",
      type: "connector-line",
      name: "Connector Line 1",
      x: 40,
      y: 40,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "cell", x: 200, y: 120 },
        target: { kind: "cell", x: 360, y: 240 },
        overlayGrid: true,
        animated: true,
      },
    };
    expect(getInstanceLayerSubtitle(connector, [])).toBe("x: 200 y: 120 → x: 360 y: 240");
  });

  it("getInstanceLayerSubtitle uses Icon Box label alone when layer title is blank", () => {
    const iconBlank = createComponentInstance("icon-box", 43, 79, 1, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    const titled = createComponentInstance("icon-box", 200, 200, 2, 800, 560);
    const iconNoTitle: ComponentInstance = {
      ...iconBlank,
      props: { ...iconBlank.props, title: "" },
    };
    const connector: ComponentInstance = {
      id: "connector-line-1",
      type: "connector-line",
      name: "Connector Line 1",
      x: 40,
      y: 40,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "layer", instanceId: iconNoTitle.id },
        target: { kind: "layer", instanceId: titled.id },
        overlayGrid: true,
        animated: true,
      },
    };
    expect(getInstanceLayerSubtitle(connector, [iconNoTitle, titled, connector])).toBe("Icon Box → Icon Box / Workers");
  });

  it("getInstanceLayerSubtitle combines cell and icon-box on connector-line", () => {
    const ib = createComponentInstance("icon-box", 43, 79, 1, 800, 560);
    const connector: ComponentInstance = {
      id: "connector-line-1",
      type: "connector-line",
      name: "Connector Line 1",
      x: 40,
      y: 40,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "cell", x: 40, y: 40 },
        target: { kind: "layer", instanceId: ib.id },
        overlayGrid: true,
        animated: true,
      },
    };
    expect(getInstanceLayerSubtitle(connector, [ib, connector])).toBe("x: 40 y: 40 → Icon Box / Workers");
  });

  it("getInstanceLayerSubtitle returns undefined for blank title", () => {
    const inst = createComponentInstance("icon-box", 0, 0, 1, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
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
    const inst = createComponentInstance("icon-box", 0, 0, 1, 800, 560) as Extract<
      ComponentInstance,
      { type: "icon-box" }
    >;
    expect(getInstanceLayerSubtitle({ ...inst, props: { ...inst.props, title: "KV" } })).toBe("KV");
    expect(getInstanceLayerSubtitle({ ...inst, props: { ...inst.props, title: "  hi  " } })).toBe("hi");
  });

  it("snaps icon-box by the shadow-card snap anchor to the 80px cell-center lattice", () => {
    const snapped = snapComponentPosition(50, 50, 800, 560, "icon-box");
    expect(snapped.x + ICON_BOX_SNAP_ANCHOR_X).toBe(120);
    expect(snapped.y + ICON_BOX_SNAP_ANCHOR_Y).toBe(120);
  });

  it("resolves icon-box anchors through the shared registry snap anchor", () => {
    const inst = createComponentInstance("icon-box", 43, 79, 2, 800, 560);
    expect(getInstanceAnchorPoint(inst)).toEqual({ x: 120, y: 120 });
  });

  it("when dragging past the top/left, snaps to the nearest valid grid anchor inside bounds", () => {
    const p = snapComponentPosition(-200, -200, 800, 560, "icon-box");
    expect(p.x).toBe(0);
    expect(p.y).toBe(-28);
    expect(p.x + ICON_BOX_SNAP_ANCHOR_X).toBe(40);
    expect(p.y + ICON_BOX_SNAP_ANCHOR_Y).toBe(40);
  });

  it("lets the icon-box card frame reach the bottom edge of the logical canvas", () => {
    const snapped = snapComponentPosition(799, 559, 800, 560, "icon-box");

    expect(snapped).toEqual({
      x: 720,
      y: 452,
    });
    expect(snapped.y + ICON_BOX_CARD_FRAME_ORIGIN_Y + ICON_BOX_CARD_FRAME_SIZE).toBe(560);
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
