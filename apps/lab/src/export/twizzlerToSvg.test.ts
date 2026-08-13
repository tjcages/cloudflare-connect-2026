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
  it("exports baked fibers as filled segment paths grouped per line", () => {
    const svg = twizzlerToSvgLayer(200, 100, 100, 50, 2, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 3,
      pointSpacing: 20,
      ribbonColorMode: "baked",
    });

    expect(svg).toContain('data-layer="twizzler"');
    expect(svg).toContain('data-color-mode="baked"');
    expect(svg).toContain('data-fiber="');
    expect(svg).toContain('fill="rgb(');
    expect(svg).toContain('stroke="none"');
    expect(svg).not.toContain("stroke-width=");
    expect(svg).not.toContain("linearGradient");
  });

  it("keeps per-segment color variation in baked mode", () => {
    const svg = twizzlerToSvgLayer(400, 400, 400, 400, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 8,
      pointSpacing: 12,
      ribbonColorMode: "baked",
      gradientXEnabled: true,
      gradientYEnabled: true,
      gradientZEnabled: true,
      backgroundColor: "#ffffff",
      speed: 0,
    });
    const colors = new Set([...svg.matchAll(/fill="rgb\((\d+),(\d+),(\d+)\)"/g)].map((m) => `${m[1]},${m[2]},${m[3]}`));
    expect(colors.size).toBeGreaterThan(3);
  });

  it("combines solid fibers into one filled path each", () => {
    const lineCount = 6;
    const svg = twizzlerToSvgLayer(400, 200, 400, 200, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount,
      pointSpacing: 8,
      ribbonColorMode: "solid",
      speed: 0,
    });

    const paths = svg.match(/<path /g) ?? [];
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.length).toBeLessThanOrEqual(lineCount);
    expect(svg).toContain('data-color-mode="solid"');
    expect(svg).not.toContain("<g data-fiber=");
    expect(svg).not.toContain("linearGradient");
  });

  it("exports shared gradient as one masked gradient plane", () => {
    const svg = twizzlerToSvgLayer(400, 200, 400, 200, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 5,
      pointSpacing: 10,
      ribbonColorMode: "sharedGradient",
      colorFar: "#fea700",
      colorNear: "#f46021",
      speed: 0,
    });
    expect(svg).toContain('data-color-mode="sharedGradient"');
    expect(svg).toContain('id="twizzler-pack-grad"');
    expect(svg).toContain('id="twizzler-pack-mask"');
    expect(svg).toContain('data-pack-gradient="true"');
    expect(svg).toMatch(/<image [^>]*id="twizzler-pack-grad"[^>]*width="400"[^>]*height="200"/);
    expect(svg).toContain('mask="url(#twizzler-pack-mask)"');
    expect(svg).not.toContain("<pattern");
    expect(svg).not.toContain("patternUnits");
    expect(svg.match(/<pattern /g)?.length ?? 0).toBe(0);
    expect((svg.match(/<image /g) ?? []).length).toBe(1);
    expect(svg).toContain("data:image/png;base64,");
    expect(svg).not.toContain("linearGradient");
    expect(svg).not.toContain("<stop ");
    expect(svg).not.toMatch(/<rect [^>]*data-pack-gradient/);
    expect(svg).not.toMatch(/<path [^>]*fill="url\(#twizzler-pack-grad\)"/);
    expect(svg).toContain('fill="white"');
  });

  it("exports sharedLinear as a Figma-editable 1D linearGradient (CF-74)", () => {
    const svg = twizzlerToSvgLayer(400, 200, 400, 200, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 5,
      pointSpacing: 10,
      ribbonColorMode: "sharedLinear",
      gradientStops: [
        { id: "a", x: 0, y: 0.5, offset: 0, color: "#ff0000" },
        { id: "b", x: 0.4, y: 0.5, offset: 0.4, color: "#00ff00" },
        { id: "c", x: 1, y: 0.5, offset: 1, color: "#0000ff" },
      ],
      speed: 0,
    });
    expect(svg).toContain('data-color-mode="sharedLinear"');
    expect(svg).toContain("<linearGradient ");
    expect(svg).toContain('gradientUnits="userSpaceOnUse"');
    expect(svg).toContain("<stop ");
    expect(svg).toContain('offset="0.4"');
    expect(svg).toContain('stop-color="rgb(0,255,0)"');
    expect(svg).not.toContain("<pattern ");
    expect(svg).not.toContain("data:image/png;base64,");
    expect(svg).toContain('data-pack-gradient="true"');
    expect(svg).toContain('fill="url(#twizzler-pack-grad)"');
  });

  it("exports fiber fields as one masked image per ribbon (CF-79)", () => {
    const svg = twizzlerToSvgLayer(400, 200, 400, 200, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 4,
      pointSpacing: 10,
      ribbonColorMode: "fiberGradient",
      speed: 0,
    });
    expect(svg).toContain('data-color-mode="fiberGradient"');
    expect(svg).toContain("twizzler-fiber-0-grad");
    expect(svg).toContain("twizzler-fiber-0-mask");
    expect(svg).toContain('mask="url(#twizzler-fiber-');
    expect(svg).not.toContain("twizzler-pack-grad");
    expect(svg).not.toContain("linearGradient");
    expect(svg).not.toContain("<pattern");
    const images = svg.match(/<image /g) ?? [];
    const paths = svg.match(/<path /g) ?? [];
    expect(images.length).toBe(paths.length);
    expect(images.length).toBeGreaterThan(0);
    expect((svg.match(/<rect /g) ?? []).length).toBe(0);
  });

  it("culls baked segments that miss the artboard (CF-26)", () => {
    const base = {
      ...TWIZZLER_DEFAULTS,
      lineCount: 24,
      pointSpacing: 10,
      ribbonColorMode: "baked" as const,
      speed: 0,
    };
    const onCanvas = twizzlerToSvgLayer(400, 400, 400, 400, 0, base);
    // Huge pan pushes fibers off the artboard; cull should drop those segments.
    const pannedOff = twizzlerToSvgLayer(400, 400, 400, 400, 0, {
      ...base,
      panX: 800,
      panY: 800,
    });
    const onPaths = (onCanvas.match(/<path /g) ?? []).length;
    const offPaths = (pannedOff.match(/<path /g) ?? []).length;
    expect(onPaths).toBeGreaterThan(50);
    expect(offPaths).toBeLessThan(onPaths * 0.25);
  });

  it("fits fiber fields to each ribbon AABB (not full artboard) (CF-28)", () => {
    const shared = twizzlerToSvgLayer(400, 200, 400, 200, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 8,
      pointSpacing: 10,
      ribbonColorMode: "sharedGradient",
      colorFar: "#fea700",
      colorNear: "#f46021",
      speed: 0,
    });
    const fiber = twizzlerToSvgLayer(400, 200, 400, 200, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 8,
      pointSpacing: 10,
      ribbonColorMode: "fiberGradient",
      colorFar: "#fea700",
      colorNear: "#f46021",
      speed: 0,
    });

    expect(shared).toMatch(/id="twizzler-pack-grad"[^>]*x="0"[^>]*y="0"[^>]*width="400"[^>]*height="200"/);
    const fiberBoxes = [
      ...fiber.matchAll(
        /id="twizzler-fiber-\d+-grad"[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"/g,
      ),
    ].map((m) => ({ x: Number(m[1]), y: Number(m[2]), width: Number(m[3]), height: Number(m[4]) }));
    expect(fiberBoxes.length).toBeGreaterThan(2);
    // At least one ribbon must be narrower than the full artboard field.
    expect(fiberBoxes.some((s) => s.width < 400 * 0.95)).toBe(true);
    // Fiber boxes should not all be identical (local per-ribbon extents).
    const keys = new Set(fiberBoxes.map((s) => `${s.x}:${s.y}:${s.width}:${s.height}`));
    expect(keys.size).toBeGreaterThan(1);
    // Shared stays a single pack-wide field; fiber uses many local ones. Neither tiles.
    expect(shared.match(/<image /g)?.length).toBe(1);
    expect(fiber.match(/<image /g)?.length).toBe(fiberBoxes.length);
    expect(shared).not.toContain("<pattern");
    expect(fiber).not.toContain("<pattern");
    expect(shared).not.toContain("linearGradient");
    expect(fiber).not.toContain("linearGradient");
  });

  it("exports 2D hotspot colors in the shared field (CF-58)", () => {
    const svg = twizzlerToSvgLayer(400, 200, 400, 200, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 4,
      pointSpacing: 10,
      ribbonColorMode: "sharedGradient",
      gradientStops: [
        { id: "a", x: 0.15, y: 0.1, offset: 0.15, color: "#ff0000" },
        { id: "b", x: 0.6, y: 0.8, offset: 0.6, color: "#00ff00" },
        { id: "c", x: 0.9, y: 0.4, offset: 0.9, color: "#0000ff" },
      ],
      speed: 0,
    });
    expect(svg).toContain('data-pack-gradient="true"');
    expect(svg).toContain('id="twizzler-pack-grad"');
    expect(svg).not.toContain("<stop ");
    expect(svg).not.toContain('offset="0.15"');
    expect(svg).toContain("data:image/png;base64,");
    expect((svg.match(/<image /g) ?? []).length).toBe(1);
    expect(svg).not.toContain("<pattern");
    // Mask backdrop rect only — field is one frame-sized image, not a lattice or tiled pattern.
    expect((svg.match(/<rect /g) ?? []).length).toBe(1);
  });

  it("sizes the shared field image to the export SVG frame (CF-79)", () => {
    const svg = twizzlerToSvgLayer(320, 80, 800, 200, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 3,
      pointSpacing: 12,
      ribbonColorMode: "sharedGradient",
      speed: 0,
    });
    expect(svg).toMatch(/<image [^>]*id="twizzler-pack-grad"[^>]*x="0"[^>]*y="0"[^>]*width="800"[^>]*height="200"/);
    expect(svg).not.toContain("<pattern");
    expect((svg.match(/<image /g) ?? []).length).toBe(1);
  });
});
