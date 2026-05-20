import { describe, expect, it } from "vitest";
import {
  ICON_BOX_CENTER_STROKE_LONG,
  ICON_BOX_CENTER_STROKE_SHORT,
  ICON_BOX_CONTAINER_RETICLE_ART_TICK_FAR,
  ICON_BOX_CONTAINER_RETICLE_ART_TICK_NEAR,
  ICON_BOX_ICON_SLOT_SIZE,
  ICON_BOX_INNER_OFFSET,
  ICON_BOX_INNER_SIZE,
  ICON_BOX_INNER_TOP,
  ICON_HOLD_OFFSET_X,
  getIconBoxCenterStrokeAnchors,
  getIconBoxHorizontalAccentCenterX,
  getIconBoxContainerReticlePosition,
  getIconBoxEdgeTickRects,
  getIconBoxIconDecorationSlots,
  getIconBoxIconHolds,
  resolveIconBoxLayout,
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

describe("getIconBoxIconDecorationSlots", () => {
  const slotSize = ICON_BOX_ICON_SLOT_SIZE;

  it("uses the full inner rect for length 1", () => {
    const spec = resolveIconBoxLayout({ length: 1, direction: "horizontal" });
    const slots = getIconBoxIconDecorationSlots(spec);
    expect(slots).toEqual([{ ox: ICON_BOX_INNER_OFFSET, oy: ICON_BOX_INNER_TOP, w: 64, h: 64 }]);
  });

  it("uses a 48×48 slot centered on each icon for length 2 horizontal", () => {
    const spec = resolveIconBoxLayout({ length: 2, direction: "horizontal" });
    const slots = getIconBoxIconDecorationSlots(spec);
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.w === slotSize && s.h === slotSize)).toBe(true);
    expect(slots[0]).toEqual({ ox: 16, oy: 44, w: slotSize, h: slotSize });
    expect(slots[1]).toEqual({ ox: 96, oy: 44, w: slotSize, h: slotSize });
  });

  it("uses a 48×48 slot centered on each stacked icon for length 2 vertical", () => {
    const spec = resolveIconBoxLayout({ length: 2, direction: "vertical" });
    const slots = getIconBoxIconDecorationSlots(spec);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toEqual({ ox: 16, oy: 44, w: slotSize, h: slotSize });
    expect(slots[1]).toEqual({ ox: 16, oy: 124, w: slotSize, h: slotSize });
  });

  it("places three horizontal slots for length 3", () => {
    const spec = resolveIconBoxLayout({ length: 3, direction: "horizontal" });
    const holds = getIconBoxIconHolds(spec);
    expect(holds).toHaveLength(3);
    expect(holds.map((h) => h.holdX)).toEqual([ICON_HOLD_OFFSET_X, ICON_HOLD_OFFSET_X + 80, ICON_HOLD_OFFSET_X + 160]);
    expect(getIconBoxIconDecorationSlots(spec)).toHaveLength(3);
  });

  it("places ticks flush on each 48×48 slot edge (no inset)", () => {
    const spec = resolveIconBoxLayout({ length: 2, direction: "horizontal" });
    const [leftSlot, rightSlot] = getIconBoxIconDecorationSlots(spec);
    expect(getIconBoxEdgeTickRects(leftSlot.ox, leftSlot.oy, leftSlot.w, leftSlot.h)).toEqual([
      { x: 39.5, y: leftSlot.oy, width: 1, height: 2 },
      { x: 39.5, y: leftSlot.oy + leftSlot.h - 2, width: 1, height: 2 },
      { x: leftSlot.ox, y: 67.5, width: 2, height: 1 },
      { x: leftSlot.ox + leftSlot.w - 2, y: 67.5, width: 2, height: 1 },
    ]);
    expect(getIconBoxEdgeTickRects(rightSlot.ox, rightSlot.oy, rightSlot.w, rightSlot.h)[0].x).toBe(119.5);
  });
});

describe("getIconBoxCenterStrokeAnchors", () => {
  it("places one dash between two horizontal icons", () => {
    const spec = resolveIconBoxLayout({ length: 2, direction: "horizontal" });
    expect(getIconBoxCenterStrokeAnchors(spec)).toEqual([{ x: 80, y: 68 }]);
  });

  it("places two dashes between three horizontal icons", () => {
    const spec = resolveIconBoxLayout({ length: 3, direction: "horizontal" });
    expect(getIconBoxCenterStrokeAnchors(spec)).toEqual([
      { x: 80, y: 68 },
      { x: 160, y: 68 },
    ]);
  });

  it("places one dash between two vertical icons", () => {
    const spec = resolveIconBoxLayout({ length: 2, direction: "vertical" });
    expect(getIconBoxCenterStrokeAnchors(spec)).toEqual([{ x: 40, y: 108 }]);
  });

  it("offsets horizontal center stroke rect by half width/height for half-pixel centering", () => {
    const halfW = ICON_BOX_CENTER_STROKE_LONG / 2;
    const halfH = ICON_BOX_CENTER_STROKE_SHORT / 2;
    expect({ x: -halfW, y: -halfH }).toEqual({ x: -6, y: -0.5 });
  });

  it("offsets vertical center stroke rect by half width/height for half-pixel centering", () => {
    const halfW = ICON_BOX_CENTER_STROKE_SHORT / 2;
    const halfH = ICON_BOX_CENTER_STROKE_LONG / 2;
    expect({ x: -halfW, y: -halfH }).toEqual({ x: -0.5, y: -6 });
  });
});

describe("sampleCenterStrokeLoopPhase", () => {
  it("starts mid-cycle like a negative animation delay", async () => {
    const { sampleCenterStrokeLoopPhase } = await import("../../canvas/components/icon-box/iconBoxCenterStroke");
    expect(sampleCenterStrokeLoopPhase(0, 12)).toEqual({ offset: -12, nextOffset: 12, duration: 0.2 });
    expect(sampleCenterStrokeLoopPhase(0.2, 12).offset).toBeCloseTo(12, 0);
    expect(sampleCenterStrokeLoopPhase(0.2, 12).nextOffset).toBe(-12);
    expect(sampleCenterStrokeLoopPhase(0.05, 12).offset).toBeGreaterThan(-12);
    expect(sampleCenterStrokeLoopPhase(0.05, 12).offset).toBeLessThan(12);
    expect(sampleCenterStrokeLoopPhase(0.1, 12).offset).not.toBe(sampleCenterStrokeLoopPhase(0.3, 12).offset);
  });
});

describe("getIconBoxHorizontalAccentCenterX", () => {
  it("centers accent bars under each icon column for multi-column layouts", () => {
    expect(getIconBoxHorizontalAccentCenterX(0)).toBe(40);
    expect(getIconBoxHorizontalAccentCenterX(1)).toBe(120);
    expect(getIconBoxHorizontalAccentCenterX(2)).toBe(200);
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
