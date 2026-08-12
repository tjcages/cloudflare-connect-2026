import { describe, expect, it } from "vitest";
import { TWIZZLER_DEFAULTS } from "../twizzler";
import {
  assertVectorOnlyTwizzlerDriftSvg,
  twizzlerDriftStudiesToSvg,
  type TwizzlerDriftSample,
} from "./twizzlerDriftToSvg";

const sample = (x: number, y: number): TwizzlerDriftSample => {
  const absolute = Math.min(1, (Math.abs(Math.sin(x * 0.04)) + Math.abs(Math.cos(y * 0.08))) * 0.42);
  return {
    absolute,
    targetDeficit: Math.max(0, 0.55 - absolute),
    candidateSurplus: Math.max(0, absolute - 0.25),
    targetDirectionY: Math.sin(x * 0.02),
  };
};

describe("twizzlerDriftStudiesToSvg", () => {
  it("exports three structurally different vector-only cubic studies", () => {
    const studies = twizzlerDriftStudiesToSvg({
      width: 240,
      height: 60,
      settings: {
        ...TWIZZLER_DEFAULTS,
        lineCount: 12,
        pointSpacing: 6,
        targetPolish: 4,
      },
      sample,
      pointStride: 2,
      segmentPointCount: 7,
    });

    expect(Object.keys(studies)).toEqual(["A", "B", "C"]);
    expect(studies.A).toContain('data-layer="absolute-drift"');
    expect(studies.B).toContain('data-sign="target-deficit"');
    expect(studies.B).toContain('data-sign="candidate-surplus"');
    expect(studies.C).toContain('data-threshold="hero-fan"');

    for (const [id, svg] of Object.entries(studies)) {
      expect(() => assertVectorOnlyTwizzlerDriftSvg(svg)).not.toThrow();
      expect(svg).toContain(`data-study="${id}"`);
      expect(svg).toContain("<path");
      expect(svg).toContain(" C");
      expect(svg).not.toMatch(/<(?:image|canvas)\b/i);
      expect(svg).not.toMatch(/data\s*:/i);
    }
  });

  it("rejects embedded raster and canvas content", () => {
    expect(() =>
      assertVectorOnlyTwizzlerDriftSvg(
        '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/><image href="data:image/png;base64,x"/></svg>',
      ),
    ).toThrow(/must not contain/i);
    expect(() =>
      assertVectorOnlyTwizzlerDriftSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/><canvas /></svg>'),
    ).toThrow(/must not contain/i);
  });
});
