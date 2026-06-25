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
    const svg = cellGridToSvg(readback, STRIPES, { cellWidthPx: 7, cellHeightPx: 7, useCellColors: false });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<path");
    expect(svg).toContain("#00cc88");
    expect(svg).toContain('width="7"');
    expect(svg).toContain('height="7"');
  });

  it("emits display-p3 band colors with an sRGB fallback (@supports)", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, STRIPES, { cellWidthPx: 7, cellHeightPx: 7, useCellColors: false });
    expect(svg).toContain("#00cc88"); // sRGB fallback
    expect(svg).toContain("@supports (fill: color(display-p3 1 1 1))");
    expect(svg).toContain("color(display-p3 0.0000 0.8000 0.5333)"); // 0x00cc88 as p3 coords
  });

  it("skips band-0 cells (no path)", () => {
    const readback = { cols: 1, rows: 1, values: v(0), colors: null };
    const stripes = [{ hex: "#ff0000", startFrom: 0.5, width: 4 }];
    const svg = cellGridToSvg(readback, stripes, { cellWidthPx: 7, cellHeightPx: 7, useCellColors: false });
    expect(svg).not.toContain("<path");
    expect(svg).not.toContain("#ff0000");
  });

  it("picks the right stripe by startFrom-sorted band index", () => {
    const readback = { cols: 1, rows: 1, values: v(128), colors: null };
    const svg = cellGridToSvg(readback, STRIPES, { cellWidthPx: 7, cellHeightPx: 7, useCellColors: false });
    expect(svg).toContain("#aa00aa");
    expect(svg).not.toContain("#00cc88");
  });

  it("flips vertically: a value in the readback bottom row appears in the svg bottom row (large y)", () => {
    const stripes = [{ hex: "#ff0000", startFrom: 0.5, width: 4 }];
    const readback = { cols: 1, rows: 2, values: v(255, 0), colors: null };
    const svg = cellGridToSvg(readback, stripes, { cellWidthPx: 10, cellHeightPx: 10, useCellColors: false });
    const match = svg.match(/M[\d.]+ ([\d.]+)h/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(10);
  });

  it("uses per-cell colors in colors mode with sRGB fallback + display-p3 style", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: v(0x33, 0x66, 0x99, 255) };
    const svg = cellGridToSvg(readback, STRIPES, { cellWidthPx: 7, cellHeightPx: 7, useCellColors: true });
    expect(svg).toContain('fill="#336699"'); // sRGB fallback attribute
    expect(svg).toContain('style="fill:color(display-p3 0.2000 0.4000 0.6000)"');
    expect(svg).not.toContain("<style>");
  });

  it("colors-mode width is the flat band width (NOT scaled by coverage alpha), matching the GPU", () => {
    // alpha 0x80 must NOT halve the bar — the GPU uses the discrete band width regardless of coverage.
    const readback = { cols: 1, rows: 1, values: v(255), colors: v(0x33, 0x66, 0x99, 0x80) };
    const svg = cellGridToSvg(readback, STRIPES, { cellWidthPx: 10, cellHeightPx: 10, useCellColors: true });
    expect(svg).toContain("h4"); // stripe.width = 4, not 2
  });

  it("uses cellHeight for the vertical axis (non-square cells)", () => {
    const readback = { cols: 1, rows: 2, values: v(255, 255), colors: null };
    const svg = cellGridToSvg(readback, STRIPES, { cellWidthPx: 7, cellHeightPx: 14, useCellColors: false });
    expect(svg).toContain('width="7"');
    expect(svg).toContain('height="28"'); // rows(2) * cellHeightPx(14)
  });

  it("clamps stripe width to the cell width (mirrors the shader's min(barWidthPx, cellPx))", () => {
    const stripes = [{ hex: "#ff0000", startFrom: 0.0, width: 20 }];
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, stripes, { cellWidthPx: 7, cellHeightPx: 7, useCellColors: false });
    expect(svg).toContain("h7"); // width 20 clamped to cellWidthPx 7
    expect(svg).not.toContain("h20");
  });
});
