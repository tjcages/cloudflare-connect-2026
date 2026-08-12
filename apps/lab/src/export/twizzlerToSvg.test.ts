import { describe, expect, it } from "vitest";
import { TWIZZLER_DEFAULTS } from "../twizzler";
import { twizzlerToSvgLayer } from "./twizzlerToSvg";

describe("twizzlerToSvgLayer", () => {
  it("exports every Twizzler segment as a true vector line path", () => {
    const svg = twizzlerToSvgLayer(200, 100, 100, 50, 2, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 3,
      pointSpacing: 20,
    });

    expect(svg).toContain('data-layer="twizzler"');
    expect(svg).toContain('stroke-linecap="butt"');
    expect(svg.match(/<path /g)?.length).toBeGreaterThan(10);
    expect(svg).toMatch(/d="M[\d.-]+,[\d.-]+L[\d.-]+,[\d.-]+"/);
    expect(svg).toContain('stroke="rgb(');
    expect(svg).toContain("stroke-width=");
    expect(svg).toContain("opacity=");
    // Per-segment lines — not averaged cubic ribbons / rasters.
    expect(svg).not.toContain(" C");
    expect(svg).not.toContain("data:image");
    expect(svg).not.toContain("transform=");
  });

  it("keeps per-segment color variation from gradients", () => {
    const svg = twizzlerToSvgLayer(400, 400, 400, 400, 0, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 8,
      pointSpacing: 12,
      gradientXEnabled: true,
      gradientYEnabled: true,
      gradientZEnabled: true,
      backgroundColor: "#ffffff",
      speed: 0,
    });
    const colors = new Set(
      [...svg.matchAll(/stroke="rgb\((\d+),(\d+),(\d+)\)"/g)].map((m) => `${m[1]},${m[2]},${m[3]}`),
    );
    expect(colors.size).toBeGreaterThan(3);
  });
});
