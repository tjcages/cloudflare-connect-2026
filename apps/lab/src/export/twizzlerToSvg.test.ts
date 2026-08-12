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
    expect(svg).toContain('gradientUnits="userSpaceOnUse"');
    expect(svg).toContain('data-pack-gradient="true"');
    expect(svg).toContain('fill="url(#twizzler-pack-grad)"');
    expect(svg).toContain('mask="url(#twizzler-pack-mask)"');
    expect(svg.match(/<linearGradient /g)?.length).toBe(1);
    // Visible paint is a single rect — ribbon silhouettes live only inside the mask.
    expect(svg.match(/<rect [^>]*data-pack-gradient/g)?.length).toBe(1);
    expect(svg).not.toMatch(/<path [^>]*fill="url\(#twizzler-pack-grad\)"/);
    expect(svg).toContain('fill="white"');
  });

  it("exports fiber gradients with one linearGradient per ribbon", () => {
    const svg = twizzlerToSvgLayer(400, 200, 400, 200, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 4,
      pointSpacing: 10,
      ribbonColorMode: "fiberGradient",
      speed: 0,
    });
    expect(svg).toContain('data-color-mode="fiberGradient"');
    expect(svg).toContain("twizzler-fiber-0-grad");
    expect(svg).toContain('fill="url(#twizzler-fiber-');
    expect(svg).not.toContain("twizzler-pack-grad");
    const grads = svg.match(/<linearGradient /g) ?? [];
    const paths = svg.match(/<path /g) ?? [];
    expect(grads.length).toBe(paths.length);
    expect(grads.length).toBeGreaterThan(0);
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

  it("fits fiber gradients to each ribbon X span (not full artboard) (CF-28)", () => {
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

    expect(shared).toMatch(/id="twizzler-pack-grad"[^>]*x1="0"[^>]*x2="400"/);
    const fiberSpans = [...fiber.matchAll(/id="twizzler-fiber-\d+-grad"[^>]*x1="([^"]+)"[^>]*x2="([^"]+)"/g)].map(
      (m) => ({ x1: Number(m[1]), x2: Number(m[2]) }),
    );
    expect(fiberSpans.length).toBeGreaterThan(2);
    // At least one ribbon must be narrower than the full artboard ramp.
    expect(fiberSpans.some((s) => s.x2 - s.x1 < 400 * 0.95)).toBe(true);
    // Fiber spans should not all be identical (local per-ribbon extents).
    const keys = new Set(fiberSpans.map((s) => `${s.x1}:${s.x2}`));
    expect(keys.size).toBeGreaterThan(1);
    // Shared stays a single pack-wide ramp; fiber uses many local ones.
    expect(shared.match(/<linearGradient /g)?.length).toBe(1);
    expect(fiber.match(/<linearGradient /g)?.length).toBe(fiberSpans.length);
  });

  it("exports custom shared-ramp stop offsets (CF-55)", () => {
    const svg = twizzlerToSvgLayer(400, 200, 400, 200, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 4,
      pointSpacing: 10,
      ribbonColorMode: "sharedGradient",
      gradientStops: [
        { id: "a", offset: 0.15, color: "#ff0000" },
        { id: "b", offset: 0.6, color: "#00ff00" },
        { id: "c", offset: 0.9, color: "#0000ff" },
      ],
      speed: 0,
    });
    expect(svg).toContain('offset="0.15"');
    expect(svg).toContain('offset="0.6"');
    expect(svg).toContain('offset="0.9"');
    expect(svg).toContain("rgb(255,0,0)");
    expect(svg).toContain("rgb(0,255,0)");
    expect(svg).toContain("rgb(0,0,255)");
    expect(svg.match(/<stop /g)?.length).toBe(3);
  });
});
