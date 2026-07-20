import { describe, it, expect } from "vitest";
import {
  WAVE_POSITIONS,
  originForPosition,
  cellNoise,
  assemblyOrderNorm,
  resolveRevealDurationMs,
  resolveBandRamp,
  waveRevealAt,
  assemblyRevealAt,
  serpentinePoint,
} from "./revealMath";
import { DEFAULT_REVEAL, normalizeReveal } from "../config/normalize";

describe("WAVE_POSITIONS", () => {
  it("contains all 9 positions", () => {
    expect(WAVE_POSITIONS).toHaveLength(9);
    expect(WAVE_POSITIONS).toContain("center");
    expect(WAVE_POSITIONS).toContain("left top");
    expect(WAVE_POSITIONS).toContain("right bottom");
  });
});

describe("originForPosition", () => {
  it("maps center to [0.5, 0.5]", () => {
    expect(originForPosition("center")).toEqual([0.5, 0.5]);
  });
  it("maps corner positions to unit corners", () => {
    expect(originForPosition("left top")).toEqual([0, 0]);
    expect(originForPosition("right top")).toEqual([1, 0]);
    expect(originForPosition("left bottom")).toEqual([0, 1]);
    expect(originForPosition("right bottom")).toEqual([1, 1]);
  });
  it("maps edge midpoints correctly", () => {
    expect(originForPosition("center top")).toEqual([0.5, 0]);
    expect(originForPosition("center bottom")).toEqual([0.5, 1]);
    expect(originForPosition("left center")).toEqual([0, 0.5]);
    expect(originForPosition("right center")).toEqual([1, 0.5]);
  });
});

describe("cellNoise", () => {
  it("is deterministic for identical inputs", () => {
    expect(cellNoise(3, 5, 1)).toBe(cellNoise(3, 5, 1));
    expect(cellNoise(7, 2, 14.5)).toBe(cellNoise(7, 2, 14.5));
  });
  it("golden values guard the hash recipe", () => {
    expect(cellNoise(0, 0, 1)).toBe(0);
    expect(cellNoise(1, 0, 1)).toBeCloseTo(0.49662673138453783, 10);
    expect(cellNoise(0, 1, 1)).toBeCloseTo(0.924438650199999, 10);
    expect(cellNoise(3, 5, 1)).toBeCloseTo(0.13764058006836422, 10);
  });
  it("output is always in [0, 1]", () => {
    for (let col = 0; col < 10; col++) {
      for (let row = 0; row < 10; row++) {
        const v = cellNoise(col, row, 1);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("assemblyOrderNorm", () => {
  it("is 0 at the center cell and ~0.8 at (0,0) in a 5x5 grid", () => {
    expect(assemblyOrderNorm(2, 2, 5, 5)).toBeCloseTo(0, 5);
    expect(assemblyOrderNorm(0, 0, 5, 5)).toBeCloseTo(0.8, 5);
  });
});

describe("resolveRevealDurationMs", () => {
  it("returns wave.durationMs for wave type", () => {
    const r = { ...DEFAULT_REVEAL, type: "wave" as const };
    expect(resolveRevealDurationMs(r)).toBe(r.wave.durationMs);
  });
  it("returns staggerMs + speedMaxMs of the assembly block for assembly type", () => {
    const r = { ...DEFAULT_REVEAL, type: "assembly" as const };
    expect(resolveRevealDurationMs(r)).toBe(r.assembly.staggerMs + r.assembly.speedMaxMs);
  });
  it("custom assembly durations", () => {
    const r = {
      ...DEFAULT_REVEAL,
      type: "assembly" as const,
      assembly: { ...DEFAULT_REVEAL.assembly, staggerMs: 500, speedMaxMs: 1000 },
    };
    expect(resolveRevealDurationMs(r)).toBe(1500);
  });
  it("duration follows the active type's own block for each energy type", () => {
    const glitch = normalizeReveal({ enabled: true, type: "glitch" });
    expect(resolveRevealDurationMs(glitch)).toBe(1200 + 1400);
    const turb = normalizeReveal({ enabled: true, type: "turbulence" });
    expect(resolveRevealDurationMs(turb)).toBe(1400 + 2600);
    const vortex = normalizeReveal({ enabled: true, type: "vortex" });
    expect(resolveRevealDurationMs(vortex)).toBe(2600 + 1400);
  });

  it("resolves water duration as durationMs + settleMs", () => {
    const water = normalizeReveal({ enabled: true, type: "water" });
    expect(resolveRevealDurationMs(water)).toBe(2600 + 900);
  });
});

describe("resolveBandRamp", () => {
  it("clamp(330/durationMs, 0.04, 0.4)", () => {
    expect(resolveBandRamp(1300)).toBeCloseTo(0.25384615384615383, 10);
  });
  it("clamps to minimum 0.04", () => {
    expect(resolveBandRamp(10000)).toBeCloseTo(0.04, 10);
    expect(resolveBandRamp(100000)).toBeCloseTo(0.04, 10);
  });
  it("clamps to maximum 0.4", () => {
    expect(resolveBandRamp(100)).toBeCloseTo(0.4, 10);
    expect(resolveBandRamp(1)).toBeCloseTo(0.4, 10);
  });
});

describe("waveRevealAt", () => {
  const wave = DEFAULT_REVEAL.wave;
  const bandRamp = resolveBandRamp(wave.durationMs);
  const waveNoWaviness = { ...wave, waviness: 0 };

  it("cell near origin (center) is fully revealed at progress=0.5 (no waviness)", () => {
    const result = waveRevealAt(4, 4, 10, 10, 0.5, waveNoWaviness, bandRamp);
    expect(result).toBeGreaterThan(0.95);
  });

  it("far corner (0,0) stays 0 at progress=0 from center position", () => {
    const result = waveRevealAt(0, 0, 10, 10, 0, wave, bandRamp);
    expect(result).toBeCloseTo(0, 5);
  });

  it("far corner (0,0) is partially revealed at progress=1 from center", () => {
    const result = waveRevealAt(0, 0, 10, 10, 1, wave, bandRamp);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeCloseTo(0.3102745462274044, 5);
  });

  it("wave from left top: cell (0,0) is near-origin and reveals by progress=0.3", () => {
    const waveFromCorner = { ...wave, position: "left top" as const, waviness: 0 };
    const br = resolveBandRamp(waveFromCorner.durationMs);
    const result = waveRevealAt(0, 0, 10, 10, 0.3, waveFromCorner, br);
    expect(result).toBeGreaterThan(0.5);
  });
});

describe("assemblyRevealAt", () => {
  const assembly = {
    sliceSizePx: 40,
    speedMinMs: 300,
    speedMaxMs: 1600,
    staggerMs: 900,
    scatterPx: 50,
    angleJitterDeg: 22,
    blurPx: 8,
    blurStart: 0,
  };
  const assemblyDurationMs = assembly.staggerMs + assembly.speedMaxMs;
  const bandRamp = resolveBandRamp(assemblyDurationMs);

  it("all cells are unrevealed at progress=0", () => {
    expect(assemblyRevealAt(0, 0, 10, 10, 0, assembly, bandRamp)).toBeCloseTo(0, 5);
    expect(assemblyRevealAt(5, 5, 10, 10, 0, assembly, bandRamp)).toBeCloseTo(0, 5);
  });

  it("cell (5,5) is mid-ramp at progress=0.48 (o=0.1, arrival=0.416, bandRamp=0.132)", () => {
    const result = assemblyRevealAt(5, 5, 10, 10, 0.48, assembly, bandRamp);
    expect(result).toBeCloseTo(0.47727968389125347, 5);
  });

  it("all cells fully revealed at progress=1", () => {
    expect(assemblyRevealAt(0, 0, 10, 10, 1, assembly, bandRamp)).toBeCloseTo(1, 5);
    expect(assemblyRevealAt(9, 9, 10, 10, 1, assembly, bandRamp)).toBeCloseTo(1, 5);
  });

  it("center-out: corner cell lags the center cell at the same progress", () => {
    const center = assemblyRevealAt(5, 5, 10, 10, 0.48, assembly, bandRamp);
    const corner = assemblyRevealAt(0, 0, 10, 10, 0.48, assembly, bandRamp);
    expect(center).toBeGreaterThan(corner);
  });
});

describe("serpentinePoint", () => {
  it("starts at the left of the top row and ends at the right or left of the bottom row", () => {
    const start = serpentinePoint(0, 5, 0);
    expect(start.x).toBeCloseTo(0, 5);
    expect(start.y).toBeLessThan(0.2);
    const end = serpentinePoint(1, 5, 0);
    expect(end.y).toBeGreaterThan(0.8);
  });
  it("alternates sweep direction per row", () => {
    const rows = 4;
    const early = serpentinePoint(0.1 / rows, rows, 0);
    const later = serpentinePoint(0.9 / rows, rows, 0);
    expect(later.x).toBeGreaterThan(early.x);
    const row2early = serpentinePoint(1.1 / rows, rows, 0);
    const row2later = serpentinePoint(1.9 / rows, rows, 0);
    expect(row2later.x).toBeLessThan(row2early.x);
  });
  it("descends monotonically without wobble", () => {
    let prevY = -1;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const { y } = serpentinePoint(Math.min(1, t), 6, 0);
      expect(y).toBeGreaterThanOrEqual(prevY);
      prevY = y;
    }
  });
  it("clamps progress and keeps wobble inside the canvas", () => {
    expect(serpentinePoint(-1, 5, 1).y).toBeCloseTo(serpentinePoint(0, 5, 1).y, 5);
    expect(serpentinePoint(2, 5, 1).y).toBeCloseTo(serpentinePoint(1, 5, 1).y, 5);
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const p = serpentinePoint(Math.min(1, t), 3, 1);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });
});
