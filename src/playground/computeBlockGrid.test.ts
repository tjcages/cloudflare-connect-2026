import { describe, expect, it } from "vitest";
import { computeBlockGrid, stripeWidthFromBgDistance } from "./computeBlockGrid";
import { DEFAULT_STRIPE_DUOTONE_OPTIONS } from "./stripeFilterOptions";
import {
  STRIPE_CELL_SIZE,
  STRIPE_WIDTH_MID,
  STRIPE_WIDTH_NARROW,
  STRIPE_WIDTH_NONE,
  STRIPE_WIDTH_WIDE,
} from "./stripeGridConstants";

function fillWhiteWithBlueRect(
  width: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number },
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inRect = x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      if (inRect) {
        data[i] = 40;
        data[i + 1] = 90;
        data[i + 2] = 220;
      } else {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
      data[i + 3] = 255;
    }
  }
  return data;
}

function cellWidth(grid: ReturnType<typeof computeBlockGrid>, col: number, row: number): number {
  return grid.widths[row * grid.cols + col] ?? 0;
}

describe("stripeWidthFromBgDistance", () => {
  it("maps distance bands to stripe widths", () => {
    expect(stripeWidthFromBgDistance(0, true)).toBe(STRIPE_WIDTH_NONE);
    expect(stripeWidthFromBgDistance(1, false)).toBe(STRIPE_WIDTH_NARROW);
    expect(stripeWidthFromBgDistance(2, false)).toBe(STRIPE_WIDTH_MID);
    expect(stripeWidthFromBgDistance(3, false)).toBe(STRIPE_WIDTH_MID);
    expect(stripeWidthFromBgDistance(4, false)).toBe(STRIPE_WIDTH_WIDE);
    expect(stripeWidthFromBgDistance(10, false)).toBe(STRIPE_WIDTH_WIDE);
  });
});

describe("computeBlockGrid", () => {
  it("assigns no stripes on white field and wide stripes on blue interior", () => {
    const width = 210;
    const height = 140;
    const pixels = fillWhiteWithBlueRect(width, height, { x: 70, y: 40, w: 70, h: 60 });
    const grid = computeBlockGrid(pixels, width, height, DEFAULT_STRIPE_DUOTONE_OPTIONS);

    expect(cellWidth(grid, 2, 2)).toBe(STRIPE_WIDTH_NONE);
    expect(cellWidth(grid, grid.cols - 3, 2)).toBe(STRIPE_WIDTH_NONE);

    const centerCol = Math.floor(width / 2 / STRIPE_CELL_SIZE);
    const centerRow = Math.floor(height / 2 / STRIPE_CELL_SIZE);
    expect(cellWidth(grid, centerCol, centerRow)).toBe(STRIPE_WIDTH_WIDE);
  });

  it("uses narrow stripes on foreground cells one step from background", () => {
    const width = 210;
    const height = 140;
    const pixels = fillWhiteWithBlueRect(width, height, { x: 70, y: 40, w: 70, h: 60 });
    const grid = computeBlockGrid(pixels, width, height, DEFAULT_STRIPE_DUOTONE_OPTIONS);

    const blueLeftCol = Math.floor(70 / STRIPE_CELL_SIZE);
    const blueTopRow = Math.floor(40 / STRIPE_CELL_SIZE);
    expect(cellWidth(grid, blueLeftCol, blueTopRow)).toBe(STRIPE_WIDTH_NARROW);
  });
});
