import { describe, expect, it } from "vitest";
import { resolveCodeSnippetResizeFromPointer } from "./resize";

describe("resolveCodeSnippetResizeFromPointer", () => {
  it("snaps size to 40px grid cells from pointer span", () => {
    const resolved = resolveCodeSnippetResizeFromPointer({
      fixedCornerCanvas: { x: 0, y: 0 },
      fixedCorner: "tl",
      pointerCanvas: { x: 160, y: 120 },
    });
    expect(resolved.widthCells).toBe(4);
    expect(resolved.heightCells).toBe(3);
    expect(resolved.rootX).toBe(0);
    expect(resolved.rootY).toBe(0);
  });

  it("anchors from br when resizing tl handle", () => {
    const resolved = resolveCodeSnippetResizeFromPointer({
      fixedCornerCanvas: { x: 320, y: 160 },
      fixedCorner: "br",
      pointerCanvas: { x: 80, y: 40 },
    });
    // pointer is top-left of new box; fixed corner stays at br
    expect(resolved.rootX).toBe(80);
    expect(resolved.rootY).toBe(40);
    expect(resolved.widthCells).toBe(6);
    expect(resolved.heightCells).toBe(3);
  });
});
