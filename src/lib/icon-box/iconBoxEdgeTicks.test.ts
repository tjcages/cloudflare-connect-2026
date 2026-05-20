import { describe, expect, it } from "vitest";
import {
  ICON_BOX_2X1_CENTER_STROKE_HEIGHT,
  ICON_BOX_2X1_CENTER_STROKE_WIDTH,
  ICON_BOX_2X1_INNER_WIDTH,
  ICON_BOX_CONTAINER_RETICLE_ART_TICK_FAR,
  ICON_BOX_CONTAINER_RETICLE_ART_TICK_NEAR,
  ICON_BOX_ICON_SLOT_SIZE,
  ICON_BOX_INNER_CENTER_Y,
  ICON_BOX_INNER_OFFSET,
  ICON_BOX_INNER_SIZE,
  ICON_BOX_INNER_TOP,
  ICON_HOLD_OFFSET_X,
  ICON_HOLD_OFFSET_X_SECOND,
  ICON_HOLD_OFFSET_Y,
  ICON_HOLD_OFFSET_Y_SECOND,
  ICON_BOX_1X2_CENTER_STROKE_HEIGHT,
  ICON_BOX_1X2_CENTER_STROKE_WIDTH,
  ICON_BOX_1X2_INNER_HEIGHT,
  ICON_BOX_INNER_CENTER_X,
  getIconBox1x2CenterStrokeAnchor,
  getIconBox1x2IconDecorationSlots,
  getIconBox2x1CenterStrokeAnchor,
  getIconBox2x1IconDecorationSlots,
  getIconBoxIconSlotOriginVertical,
  getIconBoxContainerReticlePosition,
  getIconBoxEdgeTickRects,
  getIconBoxIconSlotOrigin,
} from "./layout";

describe("getIconBoxEdgeTickRects", () => {
  const ox = ICON_BOX_INNER_OFFSET;
  const oy = ICON_BOX_INNER_TOP;

  it("places four ticks on the 1×1 inner slot (64×64) with 8px inset", () => {
    const w = ICON_BOX_INNER_SIZE;
    const h = ICON_BOX_INNER_SIZE;
    expect(getIconBoxEdgeTickRects(ox, oy, w, h)).toEqual([
      { x: ox + w / 2 - 0.5, y: oy + 8, width: 1, height: 2 },
      { x: ox + w / 2 - 0.5, y: oy + h - 8 - 2, width: 1, height: 2 },
      { x: ox + 8, y: oy + h / 2 - 0.5, width: 2, height: 1 },
      { x: ox + w - 8 - 2, y: oy + h / 2 - 0.5, width: 2, height: 1 },
    ]);
  });
});

describe("getIconBox2x1IconDecorationSlots", () => {
  const slotSize = ICON_BOX_ICON_SLOT_SIZE;

  it("uses a 48×48 slot centered on each icon, not half the merged inner width", () => {
    const slots = getIconBox2x1IconDecorationSlots();
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.w === slotSize && s.h === slotSize)).toBe(true);

    const left = getIconBoxIconSlotOrigin(ICON_HOLD_OFFSET_X);
    const right = getIconBoxIconSlotOrigin(ICON_HOLD_OFFSET_X_SECOND);
    expect(slots[0]).toEqual({ ox: left.ox, oy: left.oy, w: slotSize, h: slotSize });
    expect(slots[1]).toEqual({ ox: right.ox, oy: right.oy, w: slotSize, h: slotSize });

    expect(slots[0].ox).toBe(16);
    expect(slots[1].ox).toBe(96);
    expect(slots[0].oy).toBe(44);
    expect(slots[1].oy).toBe(44);
  });

  it("places ticks flush on each 48×48 slot edge (no inset)", () => {
    const [leftSlot, rightSlot] = getIconBox2x1IconDecorationSlots();
    expect(getIconBoxEdgeTickRects(leftSlot.ox, leftSlot.oy, leftSlot.w, leftSlot.h)).toEqual([
      { x: 39.5, y: leftSlot.oy, width: 1, height: 2 },
      { x: 39.5, y: leftSlot.oy + leftSlot.h - 2, width: 1, height: 2 },
      { x: leftSlot.ox, y: 67.5, width: 2, height: 1 },
      { x: leftSlot.ox + leftSlot.w - 2, y: 67.5, width: 2, height: 1 },
    ]);
    expect(getIconBoxEdgeTickRects(rightSlot.ox, rightSlot.oy, rightSlot.w, rightSlot.h)[0].x).toBe(119.5);
  });
});

describe("getIconBox1x2IconDecorationSlots", () => {
  const slotSize = ICON_BOX_ICON_SLOT_SIZE;

  it("uses a 48×48 slot centered on each stacked icon", () => {
    const slots = getIconBox1x2IconDecorationSlots();
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.w === slotSize && s.h === slotSize)).toBe(true);

    const top = getIconBoxIconSlotOriginVertical(ICON_HOLD_OFFSET_Y);
    const bottom = getIconBoxIconSlotOriginVertical(ICON_HOLD_OFFSET_Y_SECOND);
    expect(slots[0]).toEqual({ ox: top.ox, oy: top.oy, w: slotSize, h: slotSize });
    expect(slots[1]).toEqual({ ox: bottom.ox, oy: bottom.oy, w: slotSize, h: slotSize });

    expect(slots[0].ox).toBe(16);
    expect(slots[1].ox).toBe(16);
    expect(slots[0].oy).toBe(44);
    expect(slots[1].oy).toBe(124);
  });
});

describe("getIconBox1x2CenterStrokeAnchor", () => {
  it("places the pivot at the vertical center of the merged 1×2 inner card", () => {
    expect(getIconBox1x2CenterStrokeAnchor()).toEqual({
      x: ICON_BOX_INNER_CENTER_X,
      y: ICON_BOX_INNER_TOP + ICON_BOX_1X2_INNER_HEIGHT / 2,
    });
    expect(getIconBox1x2CenterStrokeAnchor()).toEqual({ x: 40, y: 108 });
  });

  it("offsets the 1×12 rect by half width/height for half-pixel centering", () => {
    const halfW = ICON_BOX_1X2_CENTER_STROKE_WIDTH / 2;
    const halfH = ICON_BOX_1X2_CENTER_STROKE_HEIGHT / 2;
    expect({ x: -halfW, y: -halfH }).toEqual({ x: -0.5, y: -6 });
  });
});

describe("getIconBox2x1CenterStrokeAnchor", () => {
  it("places the pivot at the horizontal center of the merged 2×1 inner card", () => {
    expect(getIconBox2x1CenterStrokeAnchor()).toEqual({
      x: ICON_BOX_INNER_OFFSET + ICON_BOX_2X1_INNER_WIDTH / 2,
      y: ICON_BOX_INNER_CENTER_Y,
    });
    expect(getIconBox2x1CenterStrokeAnchor()).toEqual({ x: 80, y: 68 });
  });

  it("offsets the 12×1 rect by half width/height for half-pixel centering", () => {
    const halfW = ICON_BOX_2X1_CENTER_STROKE_WIDTH / 2;
    const halfH = ICON_BOX_2X1_CENTER_STROKE_HEIGHT / 2;
    expect({ x: -halfW, y: -halfH }).toEqual({ x: -6, y: -0.5 });
  });
});

describe("getIconBoxContainerReticlePosition", () => {
  const ox = ICON_BOX_INNER_OFFSET;
  const oy = ICON_BOX_INNER_TOP;
  const w = ICON_BOX_INNER_SIZE;
  const h = ICON_BOX_INNER_SIZE;

  const edgeBySide = (edges: ReturnType<typeof getIconBoxEdgeTickRects>) => ({
    top: edges[0],
    bottom: edges[1],
    left: edges[2],
    right: edges[3],
  });

  it("aligns reticle edge ticks with card edge ticks at all four corners", () => {
    const edge = edgeBySide(getIconBoxEdgeTickRects(ox, oy, w, h));

    const tl = getIconBoxContainerReticlePosition("tl", ox, oy, w, h);
    expect(tl.x + ICON_BOX_CONTAINER_RETICLE_ART_TICK_NEAR).toBe(edge.left.x);
    expect(tl.y + ICON_BOX_CONTAINER_RETICLE_ART_TICK_NEAR).toBe(edge.top.y);

    const tr = getIconBoxContainerReticlePosition("tr", ox, oy, w, h);
    expect(tr.x + ICON_BOX_CONTAINER_RETICLE_ART_TICK_FAR).toBe(edge.right.x);
    expect(tr.y + ICON_BOX_CONTAINER_RETICLE_ART_TICK_NEAR).toBe(edge.top.y);

    const bl = getIconBoxContainerReticlePosition("bl", ox, oy, w, h);
    expect(bl.x + ICON_BOX_CONTAINER_RETICLE_ART_TICK_NEAR).toBe(edge.left.x);
    expect(bl.y + ICON_BOX_CONTAINER_RETICLE_ART_TICK_FAR).toBe(edge.bottom.y);

    const br = getIconBoxContainerReticlePosition("br", ox, oy, w, h);
    expect(br.x + ICON_BOX_CONTAINER_RETICLE_ART_TICK_FAR).toBe(edge.right.x);
    expect(br.y + ICON_BOX_CONTAINER_RETICLE_ART_TICK_FAR).toBe(edge.bottom.y);
  });
});
