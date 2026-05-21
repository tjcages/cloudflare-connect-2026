import { describe, expect, it } from "vitest";
import { LARGE_CELL_SIZE } from "../../grid/types";
import {
  getIconBoxHighlightCornerInRootSpace,
  getIconBoxShadowCardBoundsInRootSpace,
  ICON_BOX_STROKE_ALIGN_NUDGE,
  resolveIconBoxLayout,
} from "./layout";
import {
  getIconBoxHighlightCornerInCanvasSpace,
  getIconBoxShadowCardCornerInRootSpace,
  oppositeIconBoxCorner,
  resolveIconBoxResizeFromPointer,
} from "./resize";

const TITLE = "Workers";

const minHighlightSpanForTest = (title: string, direction: "horizontal" | "vertical"): number => {
  const minSpec = resolveIconBoxLayout({ length: 1, direction });
  if (direction === "horizontal") {
    const tl = getIconBoxHighlightCornerInRootSpace(title, "tl", minSpec);
    const tr = getIconBoxHighlightCornerInRootSpace(title, "tr", minSpec);
    return tr.x - tl.x;
  }
  const tl = getIconBoxHighlightCornerInRootSpace(title, "tl", minSpec);
  const bl = getIconBoxHighlightCornerInRootSpace(title, "bl", minSpec);
  return bl.y - tl.y;
};

const strokeCorner = (point: { x: number; y: number }) => ({
  x: point.x + ICON_BOX_STROKE_ALIGN_NUDGE,
  y: point.y + ICON_BOX_STROKE_ALIGN_NUDGE,
});

const resolveHorizontal = (
  root: { x: number; y: number },
  fixedCorner: "tl" | "tr" | "bl" | "br",
  pointerCanvas: { x: number; y: number },
) => {
  const spec = resolveIconBoxLayout({ length: 1, direction: "horizontal" });
  return resolveIconBoxResizeFromPointer({
    title: TITLE,
    fixedCornerCanvas: strokeCorner(getIconBoxHighlightCornerInCanvasSpace(root, TITLE, fixedCorner, spec)),
    fixedCorner,
    pointerCanvas,
    lockedDirection: "horizontal",
    startRootX: root.x,
    startRootY: root.y,
  });
};

describe("oppositeIconBoxCorner", () => {
  it("maps each corner to its diagonal opposite", () => {
    expect(oppositeIconBoxCorner("tl")).toBe("br");
    expect(oppositeIconBoxCorner("tr")).toBe("bl");
    expect(oppositeIconBoxCorner("bl")).toBe("tr");
    expect(oppositeIconBoxCorner("br")).toBe("tl");
  });
});

describe("resolveIconBoxResizeFromPointer", () => {
  const root = { x: 100, y: 200 };
  const spec1 = resolveIconBoxLayout({ length: 1, direction: "horizontal" });

  it("keeps the fixed corner anchored when growing horizontally", () => {
    const fixedTl = getIconBoxHighlightCornerInCanvasSpace(root, TITLE, "tl", spec1);
    const minSpan = minHighlightSpanForTest(TITLE, "horizontal");
    const pointer = { x: fixedTl.x + minSpan + LARGE_CELL_SIZE, y: fixedTl.y };
    const result = resolveHorizontal(root, "tl", pointer);

    expect(result.direction).toBe("horizontal");
    expect(result.length).toBe(2);
    expect(result.rootY).toBe(root.y);

    const nextSpec = resolveIconBoxLayout({ length: result.length, direction: result.direction });
    const anchored = getIconBoxHighlightCornerInCanvasSpace(
      { x: result.rootX, y: result.rootY },
      TITLE,
      "tl",
      nextSpec,
    );
    expect(anchored.x).toBeCloseTo(fixedTl.x, 0);
    expect(anchored.y).toBeCloseTo(fixedTl.y, 0);
  });

  it("does not shift rootY while resizing horizontally even with vertical pointer delta", () => {
    const fixedTl = getIconBoxHighlightCornerInCanvasSpace(root, TITLE, "tl", spec1);
    const minSpan = minHighlightSpanForTest(TITLE, "horizontal");
    const pointer = { x: fixedTl.x + minSpan + LARGE_CELL_SIZE, y: fixedTl.y + 40 };
    const result = resolveHorizontal(root, "tl", pointer);

    expect(result.direction).toBe("horizontal");
    expect(result.rootY).toBe(root.y);
  });

  it("does not flip to vertical when drag is mostly north/south while direction is locked horizontal", () => {
    const fixedTl = getIconBoxHighlightCornerInCanvasSpace(root, TITLE, "tl", spec1);
    const pointer = { x: fixedTl.x, y: fixedTl.y + LARGE_CELL_SIZE * 3 };
    const result = resolveHorizontal(root, "tl", pointer);

    expect(result.direction).toBe("horizontal");
    expect(result.rootY).toBe(root.y);
  });

  it("grows downward when resizing vertically with the top anchored", () => {
    const startBl = getIconBoxHighlightCornerInCanvasSpace(
      root,
      TITLE,
      "bl",
      resolveIconBoxLayout({ length: 1, direction: "vertical" }),
    );
    const fixedTl = getIconBoxHighlightCornerInCanvasSpace(
      root,
      TITLE,
      "tl",
      resolveIconBoxLayout({ length: 1, direction: "vertical" }),
    );
    const minSpan = minHighlightSpanForTest(TITLE, "vertical");
    const pointer = { x: startBl.x, y: fixedTl.y + minSpan + LARGE_CELL_SIZE };

    const result = resolveIconBoxResizeFromPointer({
      title: TITLE,
      fixedCornerCanvas: strokeCorner(fixedTl),
      fixedCorner: "tl",
      pointerCanvas: pointer,
      lockedDirection: "vertical",
      startRootX: root.x,
      startRootY: root.y,
    });

    expect(result.direction).toBe("vertical");
    expect(result.rootX).toBe(root.x);

    const nextSpec = resolveIconBoxLayout({ length: result.length, direction: result.direction });
    const nextBl = getIconBoxHighlightCornerInCanvasSpace({ x: result.rootX, y: result.rootY }, TITLE, "bl", nextSpec);
    expect(nextBl.y).toBeGreaterThan(startBl.y);
  });

  it("clamps length to 1 at minimum extent", () => {
    const fixedTl = getIconBoxHighlightCornerInCanvasSpace(root, TITLE, "tl", spec1);
    const pointer = { x: fixedTl.x + 10, y: fixedTl.y + 5 };
    const result = resolveHorizontal(root, "tl", pointer);

    expect(result.length).toBe(1);
  });

  it("clamps length to 10 at maximum extent", () => {
    const fixedTl = getIconBoxHighlightCornerInCanvasSpace(root, TITLE, "tl", spec1);
    const pointer = { x: fixedTl.x + LARGE_CELL_SIZE * 12, y: fixedTl.y };
    const result = resolveHorizontal(root, "tl", pointer);

    expect(result.length).toBe(10);
  });

  it("shrinks an extended horizontal box when dragging inward with tl fixed", () => {
    const spec2 = resolveIconBoxLayout({ length: 3, direction: "horizontal" });
    const fixedTl = getIconBoxHighlightCornerInCanvasSpace(root, TITLE, "tl", spec2);
    const pointer = { x: fixedTl.x + LARGE_CELL_SIZE, y: fixedTl.y };

    const result = resolveIconBoxResizeFromPointer({
      title: TITLE,
      fixedCornerCanvas: strokeCorner(fixedTl),
      fixedCorner: "tl",
      pointerCanvas: pointer,
      lockedDirection: "horizontal",
      startRootX: root.x,
      startRootY: root.y,
    });

    expect(result.length).toBe(1);
    expect(result.direction).toBe("horizontal");
    expect(result.rootY).toBe(root.y);
  });
});

describe("getIconBoxShadowCardCornerInRootSpace", () => {
  it("matches shadow card bounds corners", () => {
    const spec = resolveIconBoxLayout({ length: 2, direction: "horizontal" });
    const frame = getIconBoxShadowCardBoundsInRootSpace(spec);

    expect(getIconBoxShadowCardCornerInRootSpace("tl", spec)).toEqual({ x: frame.x, y: frame.y });
    expect(getIconBoxShadowCardCornerInRootSpace("tr", spec)).toEqual({ x: frame.x + frame.width, y: frame.y });
    expect(getIconBoxShadowCardCornerInRootSpace("bl", spec)).toEqual({
      x: frame.x,
      y: frame.y + frame.height,
    });
    expect(getIconBoxShadowCardCornerInRootSpace("br", spec)).toEqual({
      x: frame.x + frame.width,
      y: frame.y + frame.height,
    });
  });
});

describe("getIconBoxHighlightCornerInRootSpace", () => {
  it("matches full highlight bounds corners", () => {
    const spec = resolveIconBoxLayout({ length: 2, direction: "horizontal" });
    expect(getIconBoxHighlightCornerInRootSpace(TITLE, "tl", spec).y).toBe(0);
    const tl = getIconBoxHighlightCornerInRootSpace(TITLE, "tl", spec);
    const bl = getIconBoxHighlightCornerInRootSpace(TITLE, "bl", spec);
    expect(bl.y - tl.y).toBeGreaterThan(0);
  });
});
