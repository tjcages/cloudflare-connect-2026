import { describe, expect, it } from "vitest";
import { resampleBlockGrid } from "./resampleBlockGrid";

describe("resampleBlockGrid", () => {
  it("returns empty indices when source grid is empty", () => {
    const result = resampleBlockGrid(new Uint8Array(0), 0, 0, 4, 4);
    expect(result.cols).toBe(4);
    expect(result.rows).toBe(4);
    expect(result.indices).toHaveLength(16);
  });

  it("preserves uniform indices when downsampling evenly", () => {
    const indices = new Uint8Array([2, 2, 2, 2]);
    const result = resampleBlockGrid(indices, 2, 2, 1, 1);
    expect(result.cols).toBe(1);
    expect(result.rows).toBe(1);
    expect(result.indices[0]).toBe(2);
  });

  it("maps finer cells from coarser source coverage", () => {
    const indices = new Uint8Array([1, 1, 3, 3]);
    const result = resampleBlockGrid(indices, 2, 2, 4, 4);
    expect(result.cols).toBe(4);
    expect(result.rows).toBe(4);
    expect(result.indices[0]).toBe(1);
    expect(result.indices[15]).toBe(3);
  });
});
