import { describe, expect, it } from "vitest";
import { cellGridToSvg, rotatedQuadIntersectsArtboard, rotatedStripePath } from "./cellGridToSvg";

const STRIPES = [
  { hex: "#111111", startFrom: 0.0, width: 4 },
  { hex: "#aa00aa", startFrom: 0.4, width: 4 },
  { hex: "#00cc88", startFrom: 0.8, width: 4 },
];

function v(...n: number[]): Uint8Array {
  return new Uint8Array(n);
}

describe("cellGridToSvg", () => {
  it("converts positive rotated grid angles from WebGL Y-up to SVG Y-down", () => {
    expect(rotatedStripePath(5, 5, 1, 5, 45)).toBe("M0.7574 7.8284L2.1716 9.2426L9.2426 2.1716L7.8284 0.7574Z");
  });

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
    expect(svg).toContain("#00cc88");
    expect(svg).toContain("@supports");
    expect(svg).toContain("color(display-p3 0.0000 0.8000 0.5333)");
  });

  it("uses exact library display-p3 tokens when a stripe color comes from the color library", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, [{ hex: "#f46021", startFrom: 0, width: 4 }], {
      cellWidthPx: 7,
      cellHeightPx: 7,
      useCellColors: false,
    });

    expect(svg).toContain("#f46021");
    expect(svg).toContain("color(display-p3 0.956863 0.376471 0.129412)");
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

  it("embeds ordered underlay layers behind stripe paths", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const connectHref = "data:image/png;base64,connect";
    const twizzlerHref = "data:image/png;base64,twizzler";
    const svg = cellGridToSvg(readback, STRIPES, {
      cellWidthPx: 7,
      cellHeightPx: 7,
      useCellColors: false,
      backgroundImageHrefs: [connectHref, twizzlerHref],
      canvasWidthPx: 70,
      canvasHeightPx: 40,
    });

    expect(svg).toContain(`<image href="${connectHref}" width="70" height="40" preserveAspectRatio="none" />`);
    expect(svg).toContain(`<image href="${twizzlerHref}" width="70" height="40" preserveAspectRatio="none" />`);
    expect(svg.indexOf(connectHref)).toBeLessThan(svg.indexOf(twizzlerHref));
    expect(svg.indexOf(twizzlerHref)).toBeLessThan(svg.indexOf("<path"));
  });

  it("places a vector underlay above raster backgrounds and behind stripe paths", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const raster = "data:image/png;base64,background";
    const vector = '<g data-layer="twizzler"><path d="M0 0 7 7" /></g>';
    const svg = cellGridToSvg(readback, STRIPES, {
      cellWidthPx: 7,
      cellHeightPx: 7,
      useCellColors: false,
      backgroundImageHref: raster,
      backgroundSvgLayer: vector,
    });

    expect(svg.indexOf(raster)).toBeLessThan(svg.indexOf('data-layer="twizzler"'));
    expect(svg.indexOf('data-layer="twizzler"')).toBeLessThan(svg.indexOf("<style>"));
  });

  it("omits stripe paths when rain stripes are empty (Twizzler-only export)", () => {
    const readback = { cols: 4, rows: 4, values: v(...new Array(16).fill(255)), colors: null };
    const vector = '<g data-layer="twizzler"><path d="M0 0L40 20Z" fill="#f46021" /></g>';
    const svg = cellGridToSvg(readback, [], {
      cellWidthPx: 10,
      cellHeightPx: 10,
      useCellColors: false,
      backgroundHex: "#ffffff",
      backgroundSvgLayer: vector,
      canvasWidthPx: 40,
      canvasHeightPx: 40,
    });
    expect(svg).toContain('data-layer="twizzler"');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toMatch(/class="stripe-/);
    expect((svg.match(/<path /g) ?? []).length).toBe(1);
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

  it("combines repeated image-color cells into one compact path", () => {
    const readback = {
      cols: 2,
      rows: 1,
      values: v(255, 255),
      colors: v(0x33, 0x66, 0x99, 255, 0x33, 0x66, 0x99, 255),
    };
    const svg = cellGridToSvg(readback, STRIPES, {
      cellWidthPx: 7,
      cellHeightPx: 7,
      useCellColors: true,
    });

    expect(svg.match(/<path /g)).toHaveLength(1);
    expect(svg.match(/M/g)).toHaveLength(2);
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
    expect(svg).toContain('fill="#336699"');
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

  it("exports centered Stripe Dots with dynamic brightness", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const svg = cellGridToSvg(readback, [{ hex: "#ff0000", startFrom: 0, width: 4 }], {
      cellWidthPx: 10,
      cellHeightPx: 8,
      useCellColors: false,
      stripeDots: {
        enabled: true,
        density: 1,
        sizePx: 2,
        brightness: 0.25,
      },
    });

    expect(svg).toContain('<circle class="stripe-dot" cx="5" cy="4" r="1" fill="#ff8080" fill-opacity="1"');
    expect(svg.indexOf('class="fill-stripe-1"')).toBeLessThan(svg.indexOf('class="stripe-dot"'));
  });

  it("applies Stripe Dots hue drift and saturation boost with the ramp position", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const stripe = [{ hex: "#804040", startFrom: 0, width: 4 }];
    const exportWithTone = (hueDriftDeg: number, saturationBoost: number) =>
      cellGridToSvg(readback, stripe, {
        cellWidthPx: 10,
        cellHeightPx: 10,
        useCellColors: false,
        stripeDots: {
          enabled: true,
          density: 1,
          sizePx: 1,
          brightness: 0,
          hueDriftDeg,
          saturationBoost,
        },
      });
    const dotFill = (svg: string) => svg.match(/<circle class="stripe-dot"[^>]* fill="(#[0-9a-f]{6})"/)?.[1];

    const baseFill = dotFill(exportWithTone(0, 0));
    const hueShiftedFill = dotFill(exportWithTone(120, 0));
    const boostedFill = dotFill(exportWithTone(120, 1));

    expect(baseFill).toBe("#804040");
    expect(hueShiftedFill).not.toBe(baseFill);
    expect(boostedFill).not.toBe(hueShiftedFill);
  });

  it("omits Stripe Dots below 2px stripe width or at zero density", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const stripeDots = {
      enabled: true,
      density: 1,
      sizePx: 1.5,
      brightness: 0.35,
    };
    const thin = cellGridToSvg(readback, [{ hex: "#ff0000", startFrom: 0, width: 1.5 }], {
      cellWidthPx: 10,
      cellHeightPx: 10,
      useCellColors: false,
      stripeDots,
    });
    const empty = cellGridToSvg(readback, [{ hex: "#ff0000", startFrom: 0, width: 4 }], {
      cellWidthPx: 10,
      cellHeightPx: 10,
      useCellColors: false,
      stripeDots: { ...stripeDots, density: 0 },
    });

    expect(thin).not.toContain('class="stripe-dot"');
    expect(empty).not.toContain('class="stripe-dot"');
  });

  it("exports Stripe Border as a four-sided inner outline with density support", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const border = { enabled: true, minWidthPx: 2, density: 1 };
    const outlined = cellGridToSvg(readback, [{ hex: "#ff0000", startFrom: 0, width: 4 }], {
      cellWidthPx: 10,
      cellHeightPx: 8,
      useCellColors: false,
      stripeBorder: border,
    });
    const filled = cellGridToSvg(readback, [{ hex: "#ff0000", startFrom: 0, width: 4 }], {
      cellWidthPx: 10,
      cellHeightPx: 8,
      useCellColors: false,
      stripeBorder: { ...border, density: 0 },
    });

    expect(outlined).toContain('class="fill-stripe-1 stripe-border" fill-rule="evenodd"');
    expect(outlined).toContain('d="M3 0h4v8h-4ZM4 1h2v6h-2Z"');
    expect(filled).not.toContain("stripe-border");
    expect(filled).toContain('d="M3 0h4v8h-4Z"');
  });

  it("exports deterministic random-density Grid Lines as complete centered cell outlines", () => {
    const readback = { cols: 4, rows: 4, values: v(...Array(16).fill(255)), colors: null };
    const options = {
      cellWidthPx: 10,
      cellHeightPx: 10,
      useCellColors: false,
      gridLines: { enabled: true, brightness: 0, density: 0.25 },
    };
    const sparse = cellGridToSvg(readback, [{ hex: "#ff0000", startFrom: 0, width: 4 }], options);
    const repeated = cellGridToSvg(readback, [{ hex: "#ff0000", startFrom: 0, width: 4 }], options);
    const full = cellGridToSvg(readback, [{ hex: "#ff0000", startFrom: 0, width: 4 }], {
      ...options,
      gridLines: { ...options.gridLines, density: 1 },
    });
    const hidden = cellGridToSvg(readback, [{ hex: "#ff0000", startFrom: 0, width: 4 }], {
      ...options,
      gridLines: { ...options.gridLines, density: 0 },
    });
    const segmentCount = (svg: string) =>
      (svg.match(/<path class="grid-line"[^>]+>/g) ?? []).reduce(
        (count, path) => count + (path.match(/M/g) ?? []).length,
        0,
      );

    expect(sparse).toBe(repeated);
    expect(sparse).toContain('class="grid-line"');
    expect(sparse).toContain('stroke="#ff0000" stroke-width="1"');
    expect(sparse).toContain('stroke-linecap="square" stroke-linejoin="miter"');
    expect(segmentCount(sparse)).toBeGreaterThan(0);
    expect(sparse).toContain("h10v10h-10Z");
    expect(segmentCount(sparse)).toBeLessThan(16);
    expect(segmentCount(full)).toBe(16);
    expect(hidden).not.toContain('class="grid-line"');
  });

  it("rotates exported Grid Lines with the grid orientation angle", () => {
    const readback = { cols: 2, rows: 2, values: v(...Array(4).fill(255)), colors: null };
    const svg = cellGridToSvg(readback, [{ hex: "#ff0000", startFrom: 0, width: 4 }], {
      cellWidthPx: 10,
      cellHeightPx: 8,
      useCellColors: false,
      angleDeg: 45,
      gridLines: { enabled: true, brightness: 0, density: 1 },
    });
    const gridLine = svg.match(/<path class="grid-line"[^>]+>/)?.[0] ?? "";

    expect(gridLine).toContain("L");
    expect(gridLine).not.toContain("h10v8h-10Z");
    expect((gridLine.match(/M/g) ?? []).length).toBeGreaterThan(4);
  });

  it("places the exported Frames layer above stripes", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: null };
    const frames = '<g data-layer="frames"><rect class="frame-outline" /></g>';
    const svg = cellGridToSvg(readback, STRIPES, {
      cellWidthPx: 7,
      cellHeightPx: 7,
      useCellColors: false,
      framesSvgLayer: frames,
    });

    expect(svg).toContain(frames);
    expect(svg.indexOf('class="fill-stripe-3"')).toBeLessThan(svg.indexOf('data-layer="frames"'));
  });

  it("uses density to reveal source-brightness bands from highest to lowest", () => {
    const rankedStripes = Array.from({ length: 10 }, (_, index) => ({
      hex: index === 9 ? "#602000" : "#ffffff",
      startFrom: index / 10,
      width: 4,
    }));
    const readback = {
      cols: 10,
      rows: 1,
      values: v(13, 38, 64, 89, 115, 140, 166, 191, 217, 242),
      colors: null,
    };
    const svg = cellGridToSvg(readback, rankedStripes, {
      cellWidthPx: 10,
      cellHeightPx: 10,
      useCellColors: false,
      stripeDots: {
        enabled: true,
        density: 0.1,
        sizePx: 1,
        brightness: 0,
      },
    });

    expect(svg.match(/class="stripe-dot"/g)).toHaveLength(1);
    expect(svg).toContain('class="stripe-dot" cx="95" cy="5"');
  });

  it("uses random visibility to hide individual dots without changing eligible bands", () => {
    const readback = {
      cols: 10,
      rows: 1,
      values: v(255, 255, 255, 255, 255, 255, 255, 255, 255, 255),
      colors: null,
    };
    const svg = cellGridToSvg(readback, [{ hex: "#602000", startFrom: 0, width: 4 }], {
      cellWidthPx: 10,
      cellHeightPx: 10,
      useCellColors: false,
      stripeDots: {
        enabled: true,
        density: 1,
        randomVisibility: 0.5,
        sizePx: 1,
        brightness: 0,
      },
    });

    expect(svg.match(/class="stripe-dot"/g)).toHaveLength(5);
    expect(svg).toContain('class="stripe-dot" cx="15" cy="5"');
    expect(svg).not.toContain('class="stripe-dot" cx="5" cy="5"');
  });

  it("uses the resolved image color for exported Stripe Dots", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: v(0x20, 0x40, 0x60, 255) };
    const svg = cellGridToSvg(readback, STRIPES, {
      cellWidthPx: 10,
      cellHeightPx: 10,
      useCellColors: true,
      stripeDots: {
        enabled: true,
        density: 1,
        sizePx: 1,
        brightness: 0,
      },
    });

    expect(svg).toContain('class="stripe-dot"');
    expect(svg).toContain('class="stripe-dot" cx="5" cy="5" r="0.5" fill="#204060"');
  });

  it("raises dot lightness while preserving the resolved stripe hue and saturation", () => {
    const readback = { cols: 1, rows: 1, values: v(255), colors: v(0x20, 0x40, 0x60, 255) };
    const svg = cellGridToSvg(readback, STRIPES, {
      cellWidthPx: 10,
      cellHeightPx: 10,
      useCellColors: true,
      stripeDots: {
        enabled: true,
        density: 1,
        sizePx: 1,
        brightness: 0.1,
      },
    });

    expect(svg).toContain('class="stripe-dot" cx="5" cy="5" r="0.5" fill="#2d5986"');
  });

  it("adds the same lightness amount to dots on stripes with different lightness", () => {
    const readback = {
      cols: 2,
      rows: 1,
      values: v(255, 255),
      colors: v(0x80, 0x80, 0x80, 255, 0x4d, 0x4d, 0x4d, 255),
    };
    const svg = cellGridToSvg(readback, STRIPES, {
      cellWidthPx: 10,
      cellHeightPx: 10,
      useCellColors: true,
      stripeDots: {
        enabled: true,
        density: 1,
        sizePx: 1,
        brightness: 0.14,
      },
    });

    expect(svg).toContain('class="stripe-dot" cx="5" cy="5" r="0.5" fill="#a4a4a4"');
    expect(svg).toContain('class="stripe-dot" cx="15" cy="5" r="0.5" fill="#717171"');
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

  it("bakes the diagonal stream gap wave into SVG positions", () => {
    const stripes = [{ hex: "#ff0000", startFrom: 0, width: 4 }];
    const readback = { cols: 8, rows: 8, values: v(...new Array(64).fill(255)), colors: null };
    const base = { cellWidthPx: 10, cellHeightPx: 10, useCellColors: false, angleDeg: 28 } as const;
    const disabled = { enabled: false, squeeze: 1, wavelengthCells: 8, phaseDeg: 0 };
    const enabled = { ...disabled, enabled: true };

    const plain = cellGridToSvg(readback, stripes, base);
    expect(cellGridToSvg(readback, stripes, { ...base, streamGapWave: disabled })).toEqual(plain);
    expect(cellGridToSvg(readback, stripes, { ...base, streamGapWave: enabled })).not.toEqual(plain);
  });

  it("rotatedQuadIntersectsArtboard rejects quads fully outside the page", () => {
    expect(rotatedQuadIntersectsArtboard(-80, -80, 4, 8, 35, 100, 80)).toBe(false);
    expect(rotatedQuadIntersectsArtboard(50, 40, 4, 8, 35, 100, 80)).toBe(true);
    // Corner clip still counts as intersecting
    expect(rotatedQuadIntersectsArtboard(-2, -2, 4, 4, 0, 100, 80)).toBe(true);
  });

  it("culls off-artboard rotated stripe cells from SVG markup (CF-26)", () => {
    const stripes = [{ hex: "#ff0000", startFrom: 0, width: 4 }];
    const cols = 32;
    const rows = 32;
    const cell = 10;
    const canvas = cols * cell;
    const readback = { cols, rows, values: v(...new Array(cols * rows).fill(255)), colors: null };
    const angleDeg = 35;
    const rad = (angleDeg * Math.PI) / 180;
    const axis = { x: Math.sin(rad), y: -Math.cos(rad) };
    const normal = { x: Math.cos(rad), y: Math.sin(rad) };
    const center = { x: canvas * 0.5, y: canvas * 0.5 };
    const corners = [
      { x: 0, y: 0 },
      { x: canvas, y: 0 },
      { x: canvas, y: canvas },
      { x: 0, y: canvas },
    ];
    const stackCoords = corners.map((c) => (c.x - center.x) * normal.x + (c.y - center.y) * normal.y + canvas * 0.5);
    const axisCoords = corners.map((c) => (c.x - center.x) * axis.x + (c.y - center.y) * axis.y + canvas * 0.5);
    const minStack = Math.floor(Math.min(...stackCoords) / cell) - 1;
    const maxStack = Math.ceil(Math.max(...stackCoords) / cell) + 1;
    const minAxis = Math.floor(Math.min(...axisCoords) / cell) - 2;
    const maxAxis = Math.ceil(Math.max(...axisCoords) / cell) + 2;
    const latticeCells = (maxStack - minStack + 1) * (maxAxis - minAxis + 1);

    const rotated = cellGridToSvg(readback, stripes, {
      cellWidthPx: cell,
      cellHeightPx: cell,
      useCellColors: false,
      angleDeg,
      canvasWidthPx: canvas,
      canvasHeightPx: canvas,
    });
    // Rotated rain emits one <path> per occupied lattice cell (not band-merged).
    const rotatedPaths = (rotated.match(/<path /g) ?? []).length;

    expect(latticeCells).toBeGreaterThan(cols * rows);
    expect(rotatedPaths).toBeGreaterThan(cols * rows * 0.5);
    // Without AABB cull, every lattice sample becomes a path (value is clamped on-grid).
    expect(rotatedPaths).toBeLessThan(latticeCells * 0.85);
    expect(rotatedPaths).toBeLessThan(latticeCells);
  });
});
