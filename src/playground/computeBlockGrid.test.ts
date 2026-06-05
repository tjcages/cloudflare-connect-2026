import { describe, expect, it } from "vitest";
import { computeBlockGrid } from "./computeBlockGrid";

/** Build an RGBA buffer where a left/right split is white/black. */
function splitImage(width: number, height: number, whiteCols: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const value = x < whiteCols ? 255 : 0;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return data;
}

describe("computeBlockGrid cell sizing", () => {
  it("defaults to 7px cells", () => {
    const data = splitImage(14, 7, 14);
    const grid = computeBlockGrid(data, 14, 7);
    expect(grid.cols).toBe(2);
    expect(grid.rows).toBe(1);
  });

  it("derives cols/rows from custom cell dimensions", () => {
    const data = splitImage(10, 8, 10);
    const grid = computeBlockGrid(data, 10, 8, 1, 5, 4);
    expect(grid.cols).toBe(2);
    expect(grid.rows).toBe(2);
  });

  it("averages luminance per cell at a custom cell size", () => {
    const data = splitImage(4, 2, 2);
    const grid = computeBlockGrid(data, 4, 2, 1, 2, 2);
    expect(grid.cols).toBe(2);
    expect(grid.rows).toBe(1);
    expect(grid.luma[0]).toBe(255);
    expect(grid.luma[1]).toBe(0);
  });

  it("produces a finer grid as the cell shrinks", () => {
    const data = splitImage(12, 12, 6);
    const coarse = computeBlockGrid(data, 12, 12, 1, 12, 12);
    const fine = computeBlockGrid(data, 12, 12, 1, 3, 3);
    expect(coarse.cols).toBe(1);
    expect(fine.cols).toBe(4);
    expect(fine.rows).toBe(4);
  });
});
