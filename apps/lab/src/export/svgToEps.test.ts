import { describe, expect, it } from "vitest";
import { cellGridToSvg } from "./cellGridToSvg";
import { svgToEps } from "./svgToEps";
import { TWIZZLER_DEFAULTS } from "../twizzler";
import { twizzlerToSvgLayer } from "./twizzlerToSvg";

function wrapLayer(layer: string, width = 400, height = 200): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${layer}\n</svg>`;
}

describe("svgToEps", () => {
  it("emits EPSF-3.0 with the SVG artboard bounding box", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="#fff0d1"/><path d="M10 10L40 10L40 40L10 40Z" fill="#f46021"/></svg>`;
    const eps = svgToEps(svg);
    expect(eps.startsWith("%!PS-Adobe-3.0 EPSF-3.0")).toBe(true);
    expect(eps).toContain("%%BoundingBox: 0 0 120 80");
    expect(eps).toContain("10 10 moveto");
    expect(eps).toContain("40 10 lineto");
    expect(eps).toContain("closepath");
    expect(eps).toContain("setrgbcolor");
    expect(eps).toContain("fill");
    expect(eps).toContain("showpage");
    expect(eps.trim().endsWith("%%EOF")).toBe(true);
  });

  it("flips SVG Y-down into PostScript Y-up", () => {
    const eps = svgToEps(
      `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"><rect width="10" height="20" fill="#ffffff"/></svg>`,
    );
    expect(eps).toContain("0 20 translate");
    expect(eps).toContain("1 -1 scale");
  });

  it("converts rain stripe paths from cellGridToSvg", () => {
    const svg = cellGridToSvg(
      { cols: 1, rows: 1, values: new Uint8Array([255]), colors: null },
      [{ hex: "#00cc88", startFrom: 0, width: 4 }],
      { cellWidthPx: 7, cellHeightPx: 7, useCellColors: false },
    );
    const eps = svgToEps(svg);
    expect(eps).toContain("%%BoundingBox: 0 0 7 7");
    expect(eps).toContain("moveto");
    expect(eps).toContain("fill");
    expect(eps).toMatch(/0\s+0\.8\s+0\.5333\s+setrgbcolor/);
  });

  it("keeps a solid background rect behind rain", () => {
    const svg = cellGridToSvg(
      { cols: 1, rows: 1, values: new Uint8Array([255]), colors: null },
      [{ hex: "#111111", startFrom: 0, width: 4 }],
      { cellWidthPx: 7, cellHeightPx: 7, useCellColors: false, backgroundHex: "#fff0d1" },
    );
    const eps = svgToEps(svg);
    expect(eps.indexOf("setrgbcolor")).toBeGreaterThan(-1);
    expect(eps).toContain("fill");
  });

  it("converts sharedLinear Twizzler into a clipped axial shading", () => {
    const layer = twizzlerToSvgLayer(400, 200, 400, 200, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 4,
      pointSpacing: 12,
      ribbonColorMode: "sharedLinear",
      gradientStops: [
        { id: "a", x: 0, y: 0.5, offset: 0, color: "#ff0000" },
        { id: "b", x: 1, y: 0.5, offset: 1, color: "#0000ff" },
      ],
      speed: 0,
    });
    const eps = svgToEps(wrapLayer(layer));
    expect(eps).toContain("/ShadingType 2");
    expect(eps).toContain("shfill");
    expect(eps).toContain("clip");
    expect(eps).toContain("1 0 0");
    expect(eps).toContain("0 0 1");
  });

  it("converts solid Twizzler fibers to filled paths", () => {
    const layer = twizzlerToSvgLayer(200, 100, 200, 100, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 3,
      pointSpacing: 16,
      ribbonColorMode: "solid",
      speed: 0,
    });
    const eps = svgToEps(wrapLayer(layer, 200, 100));
    expect(eps).toContain("moveto");
    expect(eps).toContain("lineto");
    expect(eps).toContain("fill");
    expect(eps).not.toContain("shfill");
  });

  it("embeds Shared field PNG patterns as colorimage", () => {
    const layer = twizzlerToSvgLayer(200, 100, 200, 100, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 3,
      pointSpacing: 16,
      ribbonColorMode: "sharedGradient",
      speed: 0,
    });
    const eps = svgToEps(wrapLayer(layer, 200, 100));
    expect(eps).toContain("colorimage");
    expect(eps).toContain("ASCIIHexDecode");
    expect(eps).toContain("clip");
  });

  it("strokes frame outlines with fill none", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="4" y="6" width="20" height="10" fill="none" stroke="#ff0000" stroke-width="2"/></svg>`;
    const eps = svgToEps(svg);
    expect(eps).toContain("1 0 0 setrgbcolor");
    expect(eps).toContain("2 setlinewidth");
    expect(eps).toContain("stroke");
    expect(eps).not.toContain("eofill");
  });
});
