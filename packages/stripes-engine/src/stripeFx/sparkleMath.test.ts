import { describe, it, expect } from "vitest";
import {
  sparkleHash,
  phaseHash,
  periodHash,
  cellSeed,
  altHash,
  cellPulse,
  isGapped,
  shuffledWidth,
  SPARKLE_BASE_PERIOD_MIN_SEC,
  SPARKLE_BASE_PERIOD_MAX_SEC,
} from "./sparkleMath";

function legacyHashFromCoords(px: number, py: number): number {
  function fract(x: number): number {
    return x - Math.floor(x);
  }
  let p3x = fract(px * 0.1031);
  let p3y = fract(py * 0.103);
  let p3z = fract(px * 0.0973);
  const dotVal = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x = fract(p3x + dotVal);
  p3y = fract(p3y + dotVal);
  p3z = fract(p3z + dotVal);
  return fract((p3x + p3y) * p3z);
}

describe("SPARKLE_BASE_PERIOD constants", () => {
  it("min is 0.21 and max is 0.55", () => {
    expect(SPARKLE_BASE_PERIOD_MIN_SEC).toBe(0.21);
    expect(SPARKLE_BASE_PERIOD_MAX_SEC).toBe(0.55);
  });
});

describe("sparkleHash", () => {
  it("matches legacy hashFromCoords exactly", () => {
    const samples = [
      [0, 0],
      [1, 0],
      [0, 1],
      [3, 5],
      [7, 12],
      [-1, 4],
    ] as const;
    for (const [px, py] of samples) {
      expect(sparkleHash(px, py)).toBe(legacyHashFromCoords(px, py));
    }
  });

  it("is deterministic for identical inputs", () => {
    expect(sparkleHash(3, 7)).toBe(sparkleHash(3, 7));
    expect(sparkleHash(0, 0)).toBe(sparkleHash(0, 0));
  });

  it("output is always in [0, 1]", () => {
    for (let col = 0; col < 10; col++) {
      for (let row = 0; row < 10; row++) {
        const v = sparkleHash(col, row);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("phaseHash vs periodHash", () => {
  it("phaseHash equals legacy hash(col+53, row+71)", () => {
    const samples = [
      [0, 0],
      [2, 3],
      [5, 8],
    ] as const;
    for (const [col, row] of samples) {
      expect(phaseHash(col, row)).toBe(legacyHashFromCoords(col + 53, row + 71));
    }
  });

  it("periodHash equals legacy hash(col+89, row+113)", () => {
    const samples = [
      [0, 0],
      [2, 3],
      [5, 8],
    ] as const;
    for (const [col, row] of samples) {
      expect(periodHash(col, row)).toBe(legacyHashFromCoords(col + 89, row + 113));
    }
  });

  it("phaseHash(0,0) !== periodHash(0,0)", () => {
    expect(phaseHash(0, 0)).not.toBe(periodHash(0, 0));
  });

  it("both return values in [0, 1]", () => {
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 8; row++) {
        expect(phaseHash(col, row)).toBeGreaterThanOrEqual(0);
        expect(phaseHash(col, row)).toBeLessThanOrEqual(1);
        expect(periodHash(col, row)).toBeGreaterThanOrEqual(0);
        expect(periodHash(col, row)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("cellSeed", () => {
  it("equals legacy hash(col+17, row+31)", () => {
    const samples = [
      [0, 0],
      [1, 2],
      [4, 7],
    ] as const;
    for (const [col, row] of samples) {
      expect(cellSeed(col, row)).toBe(legacyHashFromCoords(col + 17, row + 31));
    }
  });

  it("output is in [0, 1]", () => {
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 8; row++) {
        const v = cellSeed(col, row);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("altHash", () => {
  it("is deterministic", () => {
    expect(altHash(2, 3, 0)).toBe(altHash(2, 3, 0));
    expect(altHash(2, 3, 1)).toBe(altHash(2, 3, 1));
  });

  it("differs between pulse indices", () => {
    expect(altHash(2, 3, 0)).not.toBe(altHash(2, 3, 1));
  });

  it("matches legacy widthShuffleAltHash formula: hash(col+53+idx*61, row+71+idx*101)", () => {
    const samples = [
      [0, 0, 0],
      [1, 2, 0],
      [3, 4, 1],
      [5, 6, 2],
    ] as const;
    for (const [col, row, idx] of samples) {
      expect(altHash(col, row, idx)).toBe(legacyHashFromCoords(col + 53 + idx * 61, row + 71 + idx * 101));
    }
  });

  it("output is in [0, 1]", () => {
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 5; row++) {
        for (let idx = 0; idx < 3; idx++) {
          const v = altHash(col, row, idx);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("cellPulse", () => {
  it("is deterministic", () => {
    const a = cellPulse(2, 3, 1.0, 0.5, SPARKLE_BASE_PERIOD_MIN_SEC, SPARKLE_BASE_PERIOD_MAX_SEC);
    const b = cellPulse(2, 3, 1.0, 0.5, SPARKLE_BASE_PERIOD_MIN_SEC, SPARKLE_BASE_PERIOD_MAX_SEC);
    expect(a.localTime).toBe(b.localTime);
    expect(a.period).toBe(b.period);
    expect(a.cycleIndex).toBe(b.cycleIndex);
  });

  it("localTime is always in [0, cyclePeriod)", () => {
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 5; row++) {
        const pulse = cellPulse(col, row, 5.0, 0.3, SPARKLE_BASE_PERIOD_MIN_SEC, SPARKLE_BASE_PERIOD_MAX_SEC);
        const cyclePeriod = pulse.period / 0.3;
        expect(pulse.localTime).toBeGreaterThanOrEqual(0);
        expect(pulse.localTime).toBeLessThan(cyclePeriod);
      }
    }
  });

  it("period is in [periodMinSec, periodMaxSec]", () => {
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 5; row++) {
        const pulse = cellPulse(col, row, 0, 0.5, SPARKLE_BASE_PERIOD_MIN_SEC, SPARKLE_BASE_PERIOD_MAX_SEC);
        expect(pulse.period).toBeGreaterThanOrEqual(SPARKLE_BASE_PERIOD_MIN_SEC);
        expect(pulse.period).toBeLessThanOrEqual(SPARKLE_BASE_PERIOD_MAX_SEC);
      }
    }
  });

  it("cycleIndex advances as time increases", () => {
    const col = 1;
    const row = 1;
    const coverage = 0.5;
    const pulse0 = cellPulse(col, row, 0, coverage, SPARKLE_BASE_PERIOD_MIN_SEC, SPARKLE_BASE_PERIOD_MAX_SEC);
    const cyclePeriod = pulse0.period / coverage;
    const pulse1 = cellPulse(
      col,
      row,
      cyclePeriod * 2,
      coverage,
      SPARKLE_BASE_PERIOD_MIN_SEC,
      SPARKLE_BASE_PERIOD_MAX_SEC,
    );
    expect(pulse1.cycleIndex).toBeGreaterThan(pulse0.cycleIndex);
  });
});

describe("isGapped", () => {
  it("is a pure function of its inputs", () => {
    const a = isGapped(2, 3, 1.5, 0.5, SPARKLE_BASE_PERIOD_MIN_SEC, SPARKLE_BASE_PERIOD_MAX_SEC);
    const b = isGapped(2, 3, 1.5, 0.5, SPARKLE_BASE_PERIOD_MIN_SEC, SPARKLE_BASE_PERIOD_MAX_SEC);
    expect(a).toBe(b);
  });

  it("coverage=0 → never gapped (localTime never < period when coverage very small)", () => {
    let gappedCount = 0;
    for (let col = 0; col < 20; col++) {
      for (let row = 0; row < 20; row++) {
        for (let t = 0; t < 10; t += 0.1) {
          if (isGapped(col, row, t, 0, SPARKLE_BASE_PERIOD_MIN_SEC, SPARKLE_BASE_PERIOD_MAX_SEC)) {
            gappedCount++;
          }
        }
      }
    }
    expect(gappedCount).toBe(0);
  });

  it("some cells are gapped for nonzero coverage", () => {
    let gappedCount = 0;
    for (let col = 0; col < 10; col++) {
      for (let row = 0; row < 10; row++) {
        if (isGapped(col, row, 2.5, 0.5, SPARKLE_BASE_PERIOD_MIN_SEC, SPARKLE_BASE_PERIOD_MAX_SEC)) {
          gappedCount++;
        }
      }
    }
    expect(gappedCount).toBeGreaterThan(0);
  });

  it("isGapped is true iff localTime < period", () => {
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 5; row++) {
        const timeSec = 3.14;
        const coverage = 0.4;
        const pulse = cellPulse(col, row, timeSec, coverage, SPARKLE_BASE_PERIOD_MIN_SEC, SPARKLE_BASE_PERIOD_MAX_SEC);
        const expected = pulse.localTime < pulse.period;
        expect(isGapped(col, row, timeSec, coverage, SPARKLE_BASE_PERIOD_MIN_SEC, SPARKLE_BASE_PERIOD_MAX_SEC)).toBe(
          expected,
        );
      }
    }
  });
});

describe("shuffledWidth", () => {
  const periodMin = SPARKLE_BASE_PERIOD_MIN_SEC;
  const periodMax = SPARKLE_BASE_PERIOD_MAX_SEC;
  const defaultWidth = 6;
  const swingPx = 3;
  const maxWidth = 20;
  const coverage = 0.5;

  it("non-participant cell always returns defaultWidth", () => {
    for (let col = 0; col < 20; col++) {
      for (let row = 0; row < 20; row++) {
        if (cellSeed(col, row) >= coverage) {
          for (let t = 0; t < 5; t += 0.5) {
            expect(shuffledWidth(col, row, defaultWidth, t, coverage, periodMin, periodMax, swingPx, maxWidth)).toBe(
              defaultWidth,
            );
          }
        }
      }
    }
  });

  it("participant mid-pulse deviates from defaultWidth within ±swingPx", () => {
    let foundDeviation = false;
    for (let col = 0; col < 20 && !foundDeviation; col++) {
      for (let row = 0; row < 20 && !foundDeviation; row++) {
        if (cellSeed(col, row) < coverage) {
          const pulse = cellPulse(col, row, 0, coverage, periodMin, periodMax);
          const midT = pulse.period * 0.5;
          const cyclePeriod = pulse.period / coverage;
          const phase = phaseHash(col, row) * cyclePeriod;
          const timeSec = midT - phase;
          const w = shuffledWidth(col, row, defaultWidth, timeSec, coverage, periodMin, periodMax, swingPx, maxWidth);
          if (Math.abs(w - defaultWidth) > 0.01) {
            foundDeviation = true;
            expect(w).toBeGreaterThanOrEqual(defaultWidth - swingPx);
            expect(w).toBeLessThanOrEqual(defaultWidth + swingPx);
          }
        }
      }
    }
    expect(foundDeviation).toBe(true);
  });

  it("output is clamped to [1, maxWidth]", () => {
    for (let col = 0; col < 10; col++) {
      for (let row = 0; row < 10; row++) {
        for (let t = 0; t < 5; t += 0.25) {
          const w = shuffledWidth(col, row, defaultWidth, t, coverage, periodMin, periodMax, swingPx, maxWidth);
          expect(w).toBeGreaterThanOrEqual(1);
          expect(w).toBeLessThanOrEqual(maxWidth);
        }
      }
    }
  });

  it("returns defaultWidth when defaultWidth <= 0", () => {
    expect(shuffledWidth(0, 0, 0, 1.0, coverage, periodMin, periodMax, swingPx, maxWidth)).toBe(0);
  });
});

describe("widthShufflePulseEnvelope via shuffledWidth", () => {
  it("envelope is 0 at localT=0 and localT=1, peaks near localT=0.5", () => {
    function envelope(localT: number): number {
      if (localT < 0 || localT > 1) return 0;
      function smoothStep(t: number): number {
        const c = Math.min(1, Math.max(0, t));
        return c * c * (3 - 2 * c);
      }
      const cosine = 0.5 - 0.5 * Math.cos(2 * Math.PI * localT);
      return smoothStep(cosine);
    }

    expect(envelope(0)).toBeCloseTo(0, 10);
    expect(envelope(1)).toBeCloseTo(0, 10);
    expect(envelope(0.5)).toBeCloseTo(1, 5);
    expect(envelope(0.25)).toBeLessThan(envelope(0.5));
    expect(envelope(0.75)).toBeLessThan(envelope(0.5));
    expect(envelope(0.5)).toBeGreaterThan(0.9);
  });
});
