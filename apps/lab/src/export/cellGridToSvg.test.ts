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

  it("keeps the exported svg size pinned to the canvas size", () => {
    const readback = { cols: 46, rows: 46, values: v(...new Array(46 * 46).fill(255)), colors: null };
    const svg = cellGridToSvg(readback, STRIPES, {
      cellWidthPx: 7,
      cellHeightPx: 7,
      useCellColors: false,
      canvasWidthPx: 320,
      canvasHeightPx: 320,
    });
    expect(svg).toContain('width="320"');
    expect(svg).toContain('height="320"');
    expect(svg).toContain('viewBox="0 0 320 320"');
    expect(svg).not.toContain('width="322"');
    expect(svg).not.toContain('height="322"');
  });

  it("emits display-p3 band colors with an sRGB fallback (@supports)", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, STRIPES, { cellWidthPx: 7, cellHeightPx: 7, useCellColors: false });
    expect(svg).toContain("#00cc88"); // sRGB fallback
    expect(svg).toContain("@supports (fill: color(display-p3 1 1 1))");
    expect(svg).toContain("color(display-p3 0.0000 0.8000 0.5333)"); // 0x00cc88 as p3 coords
  });

  it("uses exact library display-p3 tokens when a stripe color comes from the color library", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, [{ hex: "#ff6721", startFrom: 0, width: 4 }], {
      cellWidthPx: 7,
      cellHeightPx: 7,
      useCellColors: false,
    });

    expect(svg).toContain("#ff6721"); // fallback / packed P3 canvas color
    expect(svg).toContain("color(display-p3 1.0000 0.4039 0.1294)"); // Orange 700 [Main] token
  });

  it("includes an optional background color rect behind paths", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, STRIPES, {
      cellWidthPx: 7,
      cellHeightPx: 7,
      useCellColors: false,
      backgroundHex: "#fff0d1",
    });

    expect(svg).toContain('<rect width="7" height="7" fill="#fff0d1" style="fill:color(display-p3');
    expect(svg.indexOf("<rect")).toBeLessThan(svg.indexOf("<path"));
  });

  it("embeds a Connect underlay image behind stripe paths", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const href = "data:image/png;base64,abc123";
    const svg = cellGridToSvg(readback, STRIPES, {
      cellWidthPx: 7,
      cellHeightPx: 7,
      useCellColors: false,
      backgroundImageHref: href,
      canvasWidthPx: 70,
      canvasHeightPx: 40,
    });

    expect(svg).toContain(`<image href="${href}" width="70" height="40" preserveAspectRatio="none" />`);
    expect(svg.indexOf("<image")).toBeLessThan(svg.indexOf("<path"));
  });

  it("includes the background color rect in image-colors SVG export too", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: v(0x33, 0x66, 0x99, 255) };
    const svg = cellGridToSvg(readback, STRIPES, {
      cellWidthPx: 7,
      cellHeightPx: 7,
      useCellColors: true,
      backgroundHex: "#111111",
    });

    expect(svg).toContain('<rect width="7" height="7" fill="#111111" style="fill:color(display-p3');
    expect(svg.indexOf("<rect")).toBeLessThan(svg.indexOf("<path"));
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

  it("preserves sub-pixel stripe widths in svg export", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, [{ hex: "#111111", startFrom: 0, width: 0.5 }], {
      cellWidthPx: 10,
      cellHeightPx: 10,
      useCellColors: false,
    });
    expect(svg).toContain("h0.5");
    expect(svg).not.toContain("h1v");
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

  it("exports horizontal orientation as horizontal stripe bars", () => {
    const stripes = [{ hex: "#ff0000", startFrom: 0.0, width: 4 }];
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, stripes, {
      cellWidthPx: 10,
      cellHeightPx: 8,
      useCellColors: false,
      orientation: "horizontal",
    });

    expect(svg).toContain("M0 2h10v4h-10Z");
  });

  it("exports vertical bars at 0deg even when orientation is horizontal (angle wins, like the shader)", () => {
    const stripes = [{ hex: "#ff0000", startFrom: 0.0, width: 4 }];
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, stripes, {
      cellWidthPx: 10,
      cellHeightPx: 8,
      useCellColors: false,
      orientation: "horizontal",
      angleDeg: 0,
    });

    expect(svg).toContain("M3 0h4v8h-4Z");
    expect(svg).not.toContain("M0 2h10v4h-10Z");
  });

  it("exports horizontal bars at 90deg even when orientation is vertical (angle wins, like the shader)", () => {
    const stripes = [{ hex: "#ff0000", startFrom: 0.0, width: 4 }];
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, stripes, {
      cellWidthPx: 10,
      cellHeightPx: 8,
      useCellColors: false,
      orientation: "vertical",
      angleDeg: 90,
    });

    expect(svg).toContain("M0 2h10v4h-10Z");
  });

  it("clamps horizontal stripe thickness to the cell height", () => {
    const stripes = [{ hex: "#ff0000", startFrom: 0.0, width: 20 }];
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, stripes, {
      cellWidthPx: 10,
      cellHeightPx: 8,
      useCellColors: false,
      orientation: "horizontal",
    });

    expect(svg).toContain("h10v8h-10");
    expect(svg).not.toContain("v20");
  });

  it("bakes frame-0 width sparkle into vertical stripes when enabled", () => {
    const stripes = [{ hex: "#ff0000", startFrom: 0.0, width: 4 }];
    const readback = { cols: 6, rows: 6, values: v(...new Array(36).fill(255)), colors: null };
    const base = { cellWidthPx: 10, cellHeightPx: 10, useCellColors: false } as const;
    const sparkle = { enabled: true, coverage: 1, swingPx: 4, swingPeriodMin: 0.4, swingPeriodMax: 1.2 };

    const plain = cellGridToSvg(readback, stripes, base);
    const sparkled = cellGridToSvg(readback, stripes, { ...base, widthSparkle: sparkle });

    expect(sparkled).not.toEqual(plain);
    const widths = new Set([...sparkled.matchAll(/h(\d+(?:\.\d+)?)v/g)].map((m) => m[1]));
    expect(widths.size).toBeGreaterThan(1);
    expect(cellGridToSvg(readback, stripes, { ...base, widthSparkle: sparkle })).toEqual(sparkled);
  });

  it("leaves the export untouched when width sparkle is disabled", () => {
    const stripes = [{ hex: "#ff0000", startFrom: 0.0, width: 4 }];
    const readback = { cols: 6, rows: 6, values: v(...new Array(36).fill(255)), colors: null };
    const base = { cellWidthPx: 10, cellHeightPx: 10, useCellColors: false } as const;
    const disabled = { enabled: false, coverage: 1, swingPx: 4, swingPeriodMin: 0.4, swingPeriodMax: 1.2 };

    expect(cellGridToSvg(readback, stripes, { ...base, widthSparkle: disabled })).toEqual(
      cellGridToSvg(readback, stripes, base),
    );
  });

  it("applies frame-0 width sparkle to rotated stripes", () => {
    const stripes = [{ hex: "#ff0000", startFrom: 0.0, width: 4 }];
    const readback = { cols: 6, rows: 6, values: v(...new Array(36).fill(255)), colors: null };
    const base = { cellWidthPx: 10, cellHeightPx: 10, useCellColors: false, angleDeg: 30 } as const;
    const sparkle = { enabled: true, coverage: 1, swingPx: 4, swingPeriodMin: 0.4, swingPeriodMax: 1.2 };

    const plain = cellGridToSvg(readback, stripes, base);
    const sparkled = cellGridToSvg(readback, stripes, { ...base, widthSparkle: sparkle });

    expect(sparkled).not.toEqual(plain);
  });
});
