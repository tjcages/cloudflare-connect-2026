import { describe, expect, it } from "vitest";
import {
  ICON_BOX_CENTER_STROKE_LONG,
  ICON_BOX_CENTER_STROKE_SHORT,
  ICON_BOX_CONTAINER_RETICLE_PX,
  ICON_BOX_ICON_SLOT_SIZE,
  ICON_BOX_STROKE_ALIGN_NUDGE,
  getIconBoxShadowCardBoundsInRootSpace,
  ICON_BOX_INNER_OFFSET,
  ICON_BOX_INNER_SIZE,
  ICON_BOX_INNER_TOP,
  ICON_HOLD_OFFSET_X,
  getIconBoxCenterDividerTickRects,
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

describe("getIconBoxCenterDividerTickRects", () => {
  it("returns no ticks for single-slot layouts", () => {
    expect(getIconBoxCenterDividerTickRects(resolveIconBoxLayout({ length: 1, direction: "horizontal" }))).toEqual([]);
  });

  it("places vertical ticks on horizontal divider columns aligned to slot top/bottom", () => {
    const spec = resolveIconBoxLayout({ length: 2, direction: "horizontal" });
    const [slot] = getIconBoxIconDecorationSlots(spec);
    const [anchor] = getIconBoxCenterStrokeAnchors(spec);
    expect(getIconBoxCenterDividerTickRects(spec)).toEqual([
      { x: anchor.x - ICON_BOX_STROKE_ALIGN_NUDGE, y: slot.oy, width: 1, height: 2 },
      { x: anchor.x - ICON_BOX_STROKE_ALIGN_NUDGE, y: slot.oy + slot.h - 2, width: 1, height: 2 },
    ]);
  });

  it("places a tick pair at each horizontal divider between three icons", () => {
    const spec = resolveIconBoxLayout({ length: 3, direction: "horizontal" });
    const [slot] = getIconBoxIconDecorationSlots(spec);
    const anchors = getIconBoxCenterStrokeAnchors(spec);
    const bottomY = slot.oy + slot.h - 2;
    expect(getIconBoxCenterDividerTickRects(spec)).toEqual([
      { x: 79.5, y: slot.oy, width: 1, height: 2 },
      { x: 79.5, y: bottomY, width: 1, height: 2 },
      { x: 159.5, y: slot.oy, width: 1, height: 2 },
      { x: 159.5, y: bottomY, width: 1, height: 2 },
    ]);
    expect(anchors).toHaveLength(2);
  });

  it("places vertical ticks on vertical divider rows aligned to slot left/right", () => {
    const spec = resolveIconBoxLayout({ length: 2, direction: "vertical" });
    const [slot] = getIconBoxIconDecorationSlots(spec);
    const [anchor] = getIconBoxCenterStrokeAnchors(spec);
    expect(getIconBoxCenterDividerTickRects(spec)).toEqual([
      { x: slot.ox, y: anchor.y - ICON_BOX_STROKE_ALIGN_NUDGE, width: 1, height: 2 },
      { x: slot.ox + slot.w - 1, y: anchor.y - ICON_BOX_STROKE_ALIGN_NUDGE, width: 1, height: 2 },
    ]);
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
  const half = ICON_BOX_CONTAINER_RETICLE_PX / 2;
  const nudge = ICON_BOX_STROKE_ALIGN_NUDGE;

  it("anchors reticle centers on the selection-frame corners for 1×1", () => {
    const spec = resolveIconBoxLayout({ length: 1, direction: "horizontal" });
    const frame = getIconBoxShadowCardBoundsInRootSpace(spec);

    expect(getIconBoxContainerReticlePosition("tl", spec)).toEqual({
      x: frame.x - half + nudge,
      y: frame.y - half + nudge,
    });
    expect(getIconBoxContainerReticlePosition("tr", spec)).toEqual({
      x: frame.x + frame.width - half + nudge,
      y: frame.y - half + nudge,
    });
    expect(getIconBoxContainerReticlePosition("bl", spec)).toEqual({
      x: frame.x - half + nudge,
      y: frame.y + frame.height - half + nudge,
    });
    expect(getIconBoxContainerReticlePosition("br", spec)).toEqual({
      x: frame.x + frame.width - half + nudge,
      y: frame.y + frame.height - half + nudge,
    });
  });

  it("follows extended selection-frame size for 2×1 horizontal", () => {
    const spec = resolveIconBoxLayout({ length: 2, direction: "horizontal" });
    const frame = getIconBoxShadowCardBoundsInRootSpace(spec);
    const tr = getIconBoxContainerReticlePosition("tr", spec);

    expect(tr.x + half - nudge).toBe(frame.x + frame.width);
    expect(tr.y + half - nudge).toBe(frame.y);
    expect(frame.width).toBeGreaterThan(
      getIconBoxShadowCardBoundsInRootSpace({ length: 1, direction: "horizontal" }).width,
    );
  });
});
