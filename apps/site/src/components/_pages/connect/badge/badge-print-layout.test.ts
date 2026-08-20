import { describe, expect, it } from "vitest";
import { badgePrintFieldRect, fadePrintField } from "./badge-print-layout";

describe("badge print field layout", () => {
  it("can run the shader to the sides and top, stopping at the footer", () => {
    expect(badgePrintFieldRect(1000, 1000, 0, 0, 0.2)).toEqual({
      x: 0,
      y: 0,
      w: 1000,
      h: 800,
    });
  });

  it("still supports optional side and top padding", () => {
    expect(badgePrintFieldRect(1000, 1000, 0.1, 0.08, 0.2)).toEqual({
      x: 100,
      y: 80,
      w: 800,
      h: 720,
    });
  });

  it("feathers only the bottom edge into white", () => {
    const fills: Array<{ x: number; y: number; w: number; h: number }> = [];
    const ctx = {
      fillStyle: "",
      createLinearGradient() {
        return { addColorStop() {} };
      },
      fillRect(x: number, y: number, w: number, h: number) {
        fills.push({ x, y, w, h });
      },
    } as unknown as CanvasRenderingContext2D;

    fadePrintField(ctx, { x: 0, y: 0, w: 1000, h: 800 }, 0.1);
    expect(fills).toEqual([{ x: 0, y: 720, w: 1000, h: 80 }]);
  });
});
