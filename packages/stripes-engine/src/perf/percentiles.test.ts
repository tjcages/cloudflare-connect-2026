import { describe, it, expect } from "vitest";
import { percentile } from "./percentiles";
describe("percentile", () => {
  it("nearest-rank percentiles", () => {
    const v = [10, 20, 30, 40, 50];
    expect(percentile(v, 0.5)).toBe(30);
    expect(percentile(v, 0.0)).toBe(10);
    expect(percentile(v, 1.0)).toBe(50);
  });
  it("empty → 0 and does not mutate input order", () => {
    expect(percentile([], 0.5)).toBe(0);
    const v = [3, 1, 2];
    percentile(v, 0.5);
    expect(v).toEqual([3, 1, 2]);
  });
});
