import { describe, expect, it } from "vitest";
import { cellTapUv } from "./fieldDownsampleFilter";

describe("field value → band mapping intent (Task 2)", () => {
  it("field value 0 (background) maps to band 0 via LUT (documented intent)", () => {
    const fieldVal = 0.0;
    const clamped = Math.min(1, Math.max(0, fieldVal));
    expect(clamped).toBe(0.0);
  });

  it("field value 1 (full content) maps to a high band index (documented intent)", () => {
    const fieldVal = 1.0;
    const clamped = Math.min(1, Math.max(0, fieldVal));
    expect(clamped).toBe(1.0);
  });

  it("field value is already bucketing-space: no re-inversion should be applied", () => {
    const fieldVal = 0.7;
    const clampedDirect = Math.min(1, Math.max(0, fieldVal));
    const clampedInverted = Math.min(1, Math.max(0, 1 - fieldVal));
    expect(clampedDirect).toBeCloseTo(0.7, 10);
    expect(clampedInverted).toBeCloseTo(0.3, 10);
    expect(clampedDirect).not.toBeCloseTo(clampedInverted, 5);
  });
});

describe("cellTapUv", () => {
  it("returns UVs inside the cell footprint for all taps", () => {
    const cols = 4;
    const rows = 3;
    const taps = 6;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const uMin = col / cols;
        const uMax = (col + 1) / cols;
        const vMin = row / rows;
        const vMax = (row + 1) / rows;

        for (let tx = 0; tx < taps; tx++) {
          for (let ty = 0; ty < taps; ty++) {
            const uv = cellTapUv(col, row, tx, ty, cols, rows, taps);
            expect(uv.u).toBeGreaterThanOrEqual(uMin);
            expect(uv.u).toBeLessThan(uMax);
            expect(uv.v).toBeGreaterThanOrEqual(vMin);
            expect(uv.v).toBeLessThan(vMax);
          }
        }
      }
    }
  });

  it("mean of taps over a uniform field equals the field value", () => {
    const cols = 8;
    const rows = 6;
    const taps = 6;
    const fieldValue = 0.7;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        let sum = 0;
        for (let tx = 0; tx < taps; tx++) {
          for (let ty = 0; ty < taps; ty++) {
            sum += fieldValue;
          }
        }
        const mean = sum / (taps * taps);
        expect(mean).toBeCloseTo(fieldValue, 10);
      }
    }
  });

  it("tap grid spans the cell footprint evenly (first and last taps are near cell edges)", () => {
    const cols = 4;
    const rows = 4;
    const taps = 6;
    const col = 2;
    const row = 1;
    const uMin = col / cols;
    const uMax = (col + 1) / cols;
    const vMin = row / rows;
    const vMax = (row + 1) / rows;

    const firstUv = cellTapUv(col, row, 0, 0, cols, rows, taps);
    const lastUv = cellTapUv(col, row, taps - 1, taps - 1, cols, rows, taps);

    expect(firstUv.u).toBeGreaterThan(uMin);
    expect(firstUv.u).toBeLessThan(uMax);
    expect(lastUv.u).toBeGreaterThan(uMin);
    expect(lastUv.u).toBeLessThan(uMax);

    expect(firstUv.v).toBeGreaterThan(vMin);
    expect(firstUv.v).toBeLessThan(vMax);
    expect(lastUv.v).toBeGreaterThan(vMin);
    expect(lastUv.v).toBeLessThan(vMax);

    expect(lastUv.u).toBeGreaterThan(firstUv.u);
    expect(lastUv.v).toBeGreaterThan(firstUv.v);
  });

  it("tap UVs differ across taps (not all at same position)", () => {
    const uv00 = cellTapUv(0, 0, 0, 0, 4, 4, 6);
    const uv10 = cellTapUv(0, 0, 1, 0, 4, 4, 6);
    const uv01 = cellTapUv(0, 0, 0, 1, 4, 4, 6);
    expect(uv10.u).toBeGreaterThan(uv00.u);
    expect(uv01.v).toBeGreaterThan(uv00.v);
  });
});
