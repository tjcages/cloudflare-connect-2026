import { describe, expect, it } from "vitest";
import {
  A3_FIDELITY_PARAMETERS,
  assertRasterDriftTraceSvg,
  countRasterDriftSvgPaths,
  rasterDriftFidelityToSvg,
  rasterDriftTracePass3StudiesToSvg,
  rasterDriftTracePass4StudiesToSvg,
  rasterDriftTraceStudiesToSvg,
  selectRasterDriftFidelityCandidates,
  type RasterDriftCandidateScore,
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

    expect(studies.A3).toContain('data-layer="optimized-a3-fidelity-bands"');
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

  it("creates smoothed vector-only pass-four fidelity studies", () => {
    const studies = rasterDriftTracePass4StudiesToSvg(syntheticCrossingField());

    expect(studies.A4).toContain('data-layer="anti-aliased-fidelity-bands"');
    expect(studies.A4).toContain('data-boundary="smoothed"');
    expect(studies.A4).toMatch(/\bd="[^"]*Q/);
    expect(studies.B4).toContain('data-channel-protection="high-band-erosion"');
    expect(studies.C4).toContain('data-layer="color-calibrated-fidelity-bands"');

    for (const [strategy, svg] of Object.entries(studies)) {
      expect(countRasterDriftSvgPaths(svg)).toBeGreaterThan(1);
      expect(svg).toContain(`data-strategy="${strategy}"`);
      expect(svg).not.toMatch(/<(?:image|canvas)\b/i);
      expect(svg).not.toMatch(/data\s*:/i);
      expect(() => assertRasterDriftTraceSvg(svg)).not.toThrow();
    }
  });

  it("selects deterministic joint improvements before labeled diagnostics", () => {
    const parameters = (opacityScale: number) => ({
      ...A3_FIDELITY_PARAMETERS,
      quantiles: [...A3_FIDELITY_PARAMETERS.quantiles],
      opacityScale,
    });
    const candidates: RasterDriftCandidateScore[] = [
      { id: "balanced", parameters: parameters(1.02), rgbMae: 10.7, inkIou: 0.77, vectorCoverage: 0.56 },
      { id: "rgb", parameters: parameters(1.04), rgbMae: 10.2, inkIou: 0.758, vectorCoverage: 0.57 },
      { id: "diagnostic", parameters: parameters(0.98), rgbMae: 11.2, inkIou: 0.755, vectorCoverage: 0.54 },
    ];
    const baseline = { rgbMae: 11.133, inkIou: 0.756 };

    const first = selectRasterDriftFidelityCandidates(candidates, baseline);
    const second = selectRasterDriftFidelityCandidates(candidates, baseline);

    expect(second).toEqual(first);
    expect(first).toHaveLength(3);
    expect(first.filter(({ classification }) => classification === "improvement")).toHaveLength(2);
    expect(first.at(-1)?.classification).toBe("diagnostic");
    for (const candidate of first.filter(({ classification }) => classification === "improvement")) {
      expect(candidate.rgbMae).toBeLessThan(baseline.rgbMae);
      expect(candidate.inkIou).toBeGreaterThan(baseline.inkIou);
    }
  });

  it("exports deterministic vector-only parameterized A3 topology", () => {
    const field = syntheticCrossingField();
    const svg = rasterDriftFidelityToSvg(field, "search-001", {
      ...A3_FIDELITY_PARAMETERS,
      quantiles: [...A3_FIDELITY_PARAMETERS.quantiles],
    });

    expect(rasterDriftFidelityToSvg(field, "search-001", A3_FIDELITY_PARAMETERS)).toBe(svg);
    expect(svg).toContain('data-layer="optimized-a3-fidelity-bands"');
    expect(svg).not.toMatch(/<(?:image|canvas)\b|data\s*:/i);
    expect(() => assertRasterDriftTraceSvg(svg)).not.toThrow();
  });
});
