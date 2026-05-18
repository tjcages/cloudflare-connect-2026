import { describe, expect, it } from "vitest";
import {
  ICON_BOX_2X1_INNER_WIDTH,
  ICON_BOX_CONTAINER_RETICLE_ART_TICK_FAR,
  ICON_BOX_CONTAINER_RETICLE_ART_TICK_NEAR,
  ICON_BOX_INNER_OFFSET,
  ICON_BOX_INNER_SIZE,
  ICON_BOX_INNER_TOP,
  getIconBoxContainerReticlePosition,
  getIconBoxEdgeTickRects,
} from "./layout";

describe("getIconBoxEdgeTickRects", () => {
  const ox = ICON_BOX_INNER_OFFSET;
  const oy = ICON_BOX_INNER_TOP;

  it("places four ticks on a 1×1 inner slot with 8px inset and half-pixel centering", () => {
    const w = ICON_BOX_INNER_SIZE;
    const h = ICON_BOX_INNER_SIZE;
    expect(getIconBoxEdgeTickRects(ox, oy, w, h)).toEqual([
      { x: ox + w / 2 - 0.5, y: oy + 8, width: 1, height: 2 },
      { x: ox + w / 2 - 0.5, y: oy + h - 8 - 2, width: 1, height: 2 },
      { x: ox + 8, y: oy + h / 2 - 0.5, width: 2, height: 1 },
      { x: ox + w - 8 - 2, y: oy + h / 2 - 0.5, width: 2, height: 1 },
    ]);
  });

  it("places four ticks on each 2×1 half slot", () => {
    const halfW = ICON_BOX_2X1_INNER_WIDTH / 2;
    const h = ICON_BOX_INNER_SIZE;

    const left = getIconBoxEdgeTickRects(ox, oy, halfW, h);
    expect(left).toEqual([
      { x: ox + halfW / 2 - 0.5, y: oy + 8, width: 1, height: 2 },
      { x: ox + halfW / 2 - 0.5, y: oy + h - 8 - 2, width: 1, height: 2 },
      { x: ox + 8, y: oy + h / 2 - 0.5, width: 2, height: 1 },
      { x: ox + halfW - 8 - 2, y: oy + h / 2 - 0.5, width: 2, height: 1 },
    ]);

    const rightOx = ox + halfW;
    const right = getIconBoxEdgeTickRects(rightOx, oy, halfW, h);
    expect(right).toEqual([
      { x: rightOx + halfW / 2 - 0.5, y: oy + 8, width: 1, height: 2 },
      { x: rightOx + halfW / 2 - 0.5, y: oy + h - 8 - 2, width: 1, height: 2 },
      { x: rightOx + 8, y: oy + h / 2 - 0.5, width: 2, height: 1 },
      { x: rightOx + halfW - 8 - 2, y: oy + h / 2 - 0.5, width: 2, height: 1 },
    ]);
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
