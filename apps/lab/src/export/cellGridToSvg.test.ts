import { describe, expect, it } from "vitest";
import { cellGridToSvg } from "./cellGridToSvg";

const STRIPES = [
  { hex: "#111111", startFrom: 0.0, width: 4 },
  { hex: "#aa00aa", startFrom: 0.4, width: 4 },
  { hex: "#00cc88", startFrom: 0.8, width: 4 },
];

function v(...n: number[]): Uint8Array {
  return new Uint8Array(n);
}

describe("cellGridToSvg", () => {
  it("emits an svg with band paths and the matching stripe hex", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, STRIPES, { cellSizePx: 7, useCellColors: false });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<path");
    expect(svg).toContain("#00cc88");
    expect(svg).toContain('width="7"');
    expect(svg).toContain('height="7"');
  });

  it("skips band-0 cells (no path)", () => {
    const readback = { cols: 1, rows: 1, values: v(0), colors: null };
    const stripes = [{ hex: "#ff0000", startFrom: 0.5, width: 4 }];
    const svg = cellGridToSvg(readback, stripes, { cellSizePx: 7, useCellColors: false });
    expect(svg).not.toContain("<path");
    expect(svg).not.toContain("#ff0000");
  });

  it("picks the right stripe by startFrom-sorted band index", () => {
    const readback = { cols: 1, rows: 1, values: v(128), colors: null };
    const svg = cellGridToSvg(readback, STRIPES, { cellSizePx: 7, useCellColors: false });
    expect(svg).toContain("#aa00aa");
    expect(svg).not.toContain("#00cc88");
  });

  it("flips vertically: a value in the readback bottom row appears in the svg bottom row (large y)", () => {
    const stripes = [{ hex: "#ff0000", startFrom: 0.5, width: 4 }];
    const readback = {
      cols: 1,
      rows: 2,
      values: v(255, 0),
      colors: null,
    };
    const svg = cellGridToSvg(readback, stripes, { cellSizePx: 10, useCellColors: false });
    const match = svg.match(/M[\d.]+ ([\d.]+)h/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(10);
  });

  it("uses per-cell colors in colors mode", () => {
    const readback = {
      cols: 1,
      rows: 1,
      values: v(255),
      colors: v(0x33, 0x66, 0x99, 255),
    };
    const svg = cellGridToSvg(readback, STRIPES, { cellSizePx: 7, useCellColors: true });
    expect(svg).toContain('fill="#336699"');
    expect(svg).not.toContain("<style>");
  });
});
