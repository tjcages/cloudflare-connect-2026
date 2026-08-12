import { describe, expect, it } from "vitest";
import {
  assertRasterDriftTraceSvg,
  countRasterDriftSvgPaths,
  rasterDriftTracePass3StudiesToSvg,
  rasterDriftTraceStudiesToSvg,
  type RasterDriftField,
} from "./rasterDriftTraceToSvg";

function syntheticCrossingField(): RasterDriftField {
  const width = 144;
  const height = 56;
  const intensity = new Uint8Array(width * height);
  const paint = (x: number, y: number, value: number, radius = 1) => {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        const paintX = Math.round(x + offsetX);
        const paintY = Math.round(y + offsetY);
        if (paintX < 0 || paintX >= width || paintY < 0 || paintY >= height) continue;
        const index = paintY * width + paintX;
        intensity[index] = Math.max(intensity[index] ?? 0, value - (Math.abs(offsetX) + Math.abs(offsetY)) * 35);
      }
    }
  };

  for (let x = 0; x < width; x += 1) {
    const progress = x / (width - 1);
    paint(x, 12 + progress * 34 + Math.sin(progress * Math.PI * 5) * 2, 230);
    paint(x, 46 - progress * 31 + Math.sin(progress * Math.PI * 7 + 0.7) * 2, 210);
    paint(x, 30 + Math.sin(progress * Math.PI * 4) * 8, 135);
  }
  for (let y = 23; y <= 36; y += 1) {
    for (let x = 48; x <= 91; x += 1) paint(x, y, 65, 0);
  }
  return { width, height, intensity };
}

describe("rasterDriftTraceStudiesToSvg", () => {
  it("creates deterministic contour, cubic ridge, and hybrid path strategies", () => {
    const field = syntheticCrossingField();
    const studies = rasterDriftTraceStudiesToSvg(field);

    expect(studies.A2).toContain('data-layer="quantized-contours"');
    expect(studies.A2).toContain('fill-rule="evenodd"');
    expect(studies.B2).toContain('data-layer="editable-cubic-ridges"');
    expect(studies.B2).toMatch(/\bd="[^"]*\bC/);
    expect(studies.C2).toContain('data-layer="low-frequency-contours"');
    expect(studies.C2).toContain('data-layer="high-error-cubic-ridges"');
    expect(studies.C2).toMatch(/\bd="[^"]*\bC/);

    for (const [strategy, svg] of Object.entries(studies)) {
      expect(countRasterDriftSvgPaths(svg)).toBeGreaterThan(1);
      expect(svg).toContain(`data-strategy="${strategy}"`);
      expect(svg).not.toMatch(/<(?:image|canvas)\b/i);
      expect(svg).not.toMatch(/data\s*:/i);
      expect(() => assertRasterDriftTraceSvg(svg, { requireCubic: strategy !== "A2" })).not.toThrow();
    }
    expect(rasterDriftTraceStudiesToSvg(field)).toEqual(studies);
  });

  it("rejects embedded raster content and non-cubic strand output", () => {
    expect(() =>
      assertRasterDriftTraceSvg(
        '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/><image href="data:image/png;base64,x"/></svg>',
      ),
    ).toThrow(/must not contain/i);
    expect(() =>
      assertRasterDriftTraceSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L5 5"/></svg>', {
        requireCubic: true,
      }),
    ).toThrow(/cubic/i);
  });

  it("creates vector-only adaptive contours and cubic pass-three reconstructions", () => {
    const studies = rasterDriftTracePass3StudiesToSvg(syntheticCrossingField());

    expect(studies.A3).toContain('data-layer="adaptive-disjoint-contours"');
    expect(studies.A3).toContain("data-maximum-threshold=");
    expect(studies.B3).toContain('data-layer="dense-direction-continuous-cubic-ridges"');
    expect(studies.B3).toContain('data-crossing-order="independent"');
    expect(studies.C3).toContain('data-layer="restrained-contour-underlay"');
    expect(studies.C3).toContain('data-layer="dense-high-error-cubic-ridges"');

    for (const [strategy, svg] of Object.entries(studies)) {
      const requireCubic = strategy === "B3" || strategy === "C3";
      expect(countRasterDriftSvgPaths(svg)).toBeGreaterThan(1);
      expect(svg).not.toMatch(/<(?:image|canvas)\b/i);
      expect(svg).not.toMatch(/data\s*:/i);
      expect(() => assertRasterDriftTraceSvg(svg, { requireCubic })).not.toThrow();
      if (requireCubic) expect(svg).toMatch(/\bd="[^"]*\bC/);
    }
  });
});
