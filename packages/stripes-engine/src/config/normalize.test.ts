import { describe, it, expect } from "vitest";
import {
  normalizeTransform,
  normalizeField,
  normalizeBackground,
  normalizeGrid,
  DEFAULT_TRANSFORM,
  DEFAULT_GRID,
} from "./normalize";

describe("simple normalizers", () => {
  it("transform clamps zoom and defaults missing fields", () => {
    expect(normalizeTransform({})).toEqual(DEFAULT_TRANSFORM);
    expect(normalizeTransform({ zoom: 0 }).zoom).toBe(0.1); // min 0.1
    expect(normalizeTransform({ zoom: 99 }).zoom).toBe(8); // max 8
    expect(normalizeTransform({ panX: -5 }).panX).toBe(-1); // min -1
    expect(normalizeTransform({ fit: "cover" }).fit).toBe("cover");
    expect(normalizeTransform({ fit: "bogus" as any }).fit).toBe("stretch"); // invalid → default
  });
  it("field defaults to luminance and rejects invalid mode", () => {
    expect(normalizeField({}).mode).toBe("luminance");
    expect(normalizeField({ mode: "overlay" }).mode).toBe("overlay");
    expect(normalizeField({ mode: "colors" as any }).mode).toBe("luminance");
  });
  it("background coerces to a 24-bit int", () => {
    expect(normalizeBackground({ color: 0xff8833 }).color).toBe(0xff8833);
    expect(normalizeBackground({}).color).toBe(0x000000);
    expect(normalizeBackground({ color: -1 }).color).toBe(0x000000); // clamp ≥ 0
    expect(normalizeBackground({ color: 0x1ffffff }).color).toBe(0xffffff); // clamp ≤ 0xffffff
  });
  it("grid clamps sizes and gaps", () => {
    expect(normalizeGrid({})).toEqual(DEFAULT_GRID);
    expect(normalizeGrid({ cellWidth: 0 }).cellWidth).toBe(1); // min 1
    expect(normalizeGrid({ cellWidth: 999 }).cellWidth).toBe(64); // max 64
    expect(normalizeGrid({ cellWidth: 10, gapX: 20 }).gapX).toBe(10); // gap ≤ cellWidth
    expect(normalizeGrid({ orientation: "horizontal" }).orientation).toBe("horizontal");
  });
});
