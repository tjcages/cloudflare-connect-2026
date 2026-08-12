import { describe, expect, it } from "vitest";
import { TWIZZLER_DEFAULTS } from "../twizzler";
import { twizzlerToSvgLayer } from "./twizzlerToSvg";

describe("twizzlerToSvgLayer", () => {
  it("exports every Twizzler line as vector path data", () => {
    const svg = twizzlerToSvgLayer(200, 100, 100, 50, 2, {
      ...TWIZZLER_DEFAULTS,
      lineCount: 3,
      pointSpacing: 20,
    });

    expect(svg).toContain('data-layer="twizzler"');
    expect(svg).toContain('transform="scale(0.5 0.5)"');
    expect(svg.match(/<path /g)?.length).toBeGreaterThanOrEqual(1);
    expect(svg).toContain('stroke="#');
    expect(svg).toContain("stroke-width=");
    expect(svg).toContain(" C");
    expect(svg).not.toContain("data:image");
  });
});
