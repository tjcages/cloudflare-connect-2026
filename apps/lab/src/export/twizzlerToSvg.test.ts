import { describe, expect, it } from "vitest";
import { TWIZZLER_DEFAULTS } from "../twizzler";
import { outlinePolylineFillPath, twizzlerToSvgLayer } from "./twizzlerToSvg";

describe("outlinePolylineFillPath", () => {
  it("builds a closed fill path from a centerline", () => {
    const d = outlinePolylineFillPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      2,
    );
    expect(d).toMatch(/^M/);
    expect(d).toMatch(/Z$/);
    expect(d).toContain("L");
  });
});

describe("twizzlerToSvgLayer", () => {
  it("exports gradient fibers as filled segment paths grouped per line", () => {
    const svg = twizzlerToSvgLayer(200, 100, 100, 50, 2, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 3,
      pointSpacing: 20,
      gradientsEnabled: true,
    });

    expect(svg).toContain('data-layer="twizzler"');
    expect(svg).toContain('data-fiber="');
    expect(svg).toContain('fill="rgb(');
    expect(svg).toContain('stroke="none"');
    expect(svg).toContain("fill-opacity=");
    expect(svg).toMatch(/d="M[\d.-]+,[\d.-]+L/);
    expect(svg).toContain("Z");
    // Filled outlines — not stroked centerlines / rasters.
    expect(svg).not.toContain("stroke-width=");
    expect(svg).not.toContain("data:image");
    expect(svg).not.toContain("transform=");
  });

  it("keeps per-segment color variation from gradients", () => {
    const svg = twizzlerToSvgLayer(400, 400, 400, 400, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 8,
      pointSpacing: 12,
      gradientsEnabled: true,
      gradientXEnabled: true,
      gradientYEnabled: true,
      gradientZEnabled: true,
      backgroundColor: "#ffffff",
      speed: 0,
    });
    const colors = new Set(
      [...svg.matchAll(/fill="rgb\((\d+),(\d+),(\d+)\)"/g)].map((m) => `${m[1]},${m[2]},${m[3]}`),
    );
    expect(colors.size).toBeGreaterThan(3);
  });

  it("combines solid fibers into one filled path each for Figma", () => {
    const lineCount = 6;
    const svg = twizzlerToSvgLayer(400, 200, 400, 200, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount,
      pointSpacing: 8,
      gradientsEnabled: false,
      speed: 0,
    });

    const paths = svg.match(/<path /g) ?? [];
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.length).toBeLessThanOrEqual(lineCount);
    expect(svg).toContain('data-fiber="');
    expect(svg).toContain('stroke="none"');
    expect(svg).toContain('fill="rgb(');
    // Solid mode should not nest segment groups.
    expect(svg).not.toContain("<g data-fiber=");
  });
});
