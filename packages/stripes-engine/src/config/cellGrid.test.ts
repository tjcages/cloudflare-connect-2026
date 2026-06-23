import { describe, it, expect } from "vitest";
import { resolveCellGrid } from "./cellGrid";

describe("resolveCellGrid", () => {
  it("counts logical cells, rounding up", () => {
    expect(resolveCellGrid(700, 300, 7, 7)).toEqual({ cols: 100, rows: 43 }); // 300/7 = 42.86 → 43
    expect(resolveCellGrid(100, 100, 10, 10)).toEqual({ cols: 10, rows: 10 });
  });
  it("never returns 0 (min 1 cell)", () => {
    expect(resolveCellGrid(5, 5, 64, 64)).toEqual({ cols: 1, rows: 1 });
    expect(resolveCellGrid(0, 0, 7, 7)).toEqual({ cols: 1, rows: 1 });
  });
});
