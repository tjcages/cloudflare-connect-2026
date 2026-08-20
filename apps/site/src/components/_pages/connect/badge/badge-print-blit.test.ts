import { describe, expect, it } from "vitest";
import { blitPrintFrame } from "./badge-print-blit";

function mockContext() {
  const ops: string[] = [];
  const ctx = {
    canvas: { width: 8, height: 8 },
    fillStyle: "",
    set globalCompositeOperation(value: string) {
      ops.push(value);
    },
    drawImage() {
      ops.push("draw");
    },
    fillRect() {
      ops.push("fill");
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, ops };
}

describe("badge print blit", () => {
  it("replaces the previous plate instead of compositing over it", () => {
    const { ctx, ops } = mockContext();
    blitPrintFrame(ctx, null);
    blitPrintFrame(ctx, {} as HTMLCanvasElement);
    expect(ops).toEqual(["copy", "fill", "copy", "draw"]);
  });
});
