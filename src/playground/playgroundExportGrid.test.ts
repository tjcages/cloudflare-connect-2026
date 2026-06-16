import { describe, expect, it } from "vitest";
import { buildStripeColors } from "./stripeColors";
import { isCompletePlaygroundExportGrid } from "./setupTextureShaderScene";

describe("isCompletePlaygroundExportGrid", () => {
  const colors = buildStripeColors();
  const display = { width: 700, height: 394 };

  it("accepts a full grid rebuild with luma", () => {
    const cells = 100 * 56;
    expect(
      isCompletePlaygroundExportGrid(
        {
          grid: {
            cols: 100,
            rows: 56,
            indices: new Uint8Array(cells),
            luma: new Uint8Array(cells),
          },
          colors,
          displayWidth: 700,
          displayHeight: 394,
        },
        display,
      ),
    ).toBe(true);
  });

  it("rejects partial index-only updates", () => {
    expect(
      isCompletePlaygroundExportGrid(
        {
          grid: {
            cols: 100,
            rows: 56,
            indices: new Uint8Array(100 * 56),
          },
          colors,
          displayWidth: 700,
          displayHeight: 394,
        },
        display,
      ),
    ).toBe(false);
  });

  it("requires per-cell colors when colors mode is active", () => {
    const cells = 4;
    expect(
      isCompletePlaygroundExportGrid(
        {
          grid: {
            cols: 2,
            rows: 2,
            indices: new Uint8Array(cells),
            luma: new Uint8Array(cells),
          },
          colors,
          displayWidth: 700,
          displayHeight: 394,
        },
        display,
        { requireCellColors: true },
      ),
    ).toBe(false);
  });
});
