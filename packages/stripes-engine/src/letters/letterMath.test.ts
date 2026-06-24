import { describe, it, expect } from "vitest";
import { LETTER_CHARSET, LETTER_CHARSET_LEN } from "./charset";
import { letterHash, letterCellPresent, letterBaseGlyph, letterGlyphAt } from "./letterMath";

describe("LETTER_CHARSET", () => {
  it("has positive length", () => {
    expect(LETTER_CHARSET_LEN).toBeGreaterThan(0);
    expect(LETTER_CHARSET.length).toBe(LETTER_CHARSET_LEN);
  });

  it("contains A-Z a-z 0-9", () => {
    expect(LETTER_CHARSET).toContain("A");
    expect(LETTER_CHARSET).toContain("Z");
    expect(LETTER_CHARSET).toContain("a");
    expect(LETTER_CHARSET).toContain("z");
    expect(LETTER_CHARSET).toContain("0");
    expect(LETTER_CHARSET).toContain("9");
  });

  it("each entry is a single character", () => {
    for (const c of LETTER_CHARSET) {
      expect(c).toHaveLength(1);
    }
  });
});

describe("letterHash", () => {
  it("is deterministic", () => {
    expect(letterHash(3, 7)).toBe(letterHash(3, 7));
    expect(letterHash(0, 0)).toBe(letterHash(0, 0));
  });

  it("output is in [0, 1]", () => {
    for (let col = 0; col < 10; col++) {
      for (let row = 0; row < 10; row++) {
        const v = letterHash(col, row);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("differs between cells", () => {
    expect(letterHash(0, 0)).not.toBe(letterHash(1, 0));
    expect(letterHash(0, 0)).not.toBe(letterHash(0, 1));
    expect(letterHash(1, 0)).not.toBe(letterHash(0, 1));
  });
});

describe("letterCellPresent", () => {
  it("returns false when coverage <= 0", () => {
    expect(letterCellPresent(5, 5, 1.0, 0.5, 0)).toBe(false);
    expect(letterCellPresent(5, 5, 1.0, 0.5, -0.1)).toBe(false);
  });

  it("returns false when cellLuma < topBandThreshold", () => {
    expect(letterCellPresent(0, 0, 0.3, 0.5, 0.2)).toBe(false);
    expect(letterCellPresent(3, 7, 0.0, 0.9, 0.8)).toBe(false);
  });

  it("is deterministic", () => {
    const a = letterCellPresent(2, 3, 0.9, 0.8, 0.5);
    const b = letterCellPresent(2, 3, 0.9, 0.8, 0.5);
    expect(a).toBe(b);
  });

  it("coverage ~= fraction of cells present over a 50x50 grid", () => {
    const coverage = 0.2;
    const threshold = 0.0;
    let presentCount = 0;
    const total = 50 * 50;
    for (let col = 0; col < 50; col++) {
      for (let row = 0; row < 50; row++) {
        if (letterCellPresent(col, row, 1.0, threshold, coverage)) {
          presentCount++;
        }
      }
    }
    const ratio = presentCount / total;
    expect(ratio).toBeGreaterThan(coverage - 0.05);
    expect(ratio).toBeLessThan(coverage + 0.05);
  });

  it("coverage=1.0 → all top-band cells present", () => {
    for (let col = 0; col < 10; col++) {
      for (let row = 0; row < 10; row++) {
        expect(letterCellPresent(col, row, 1.0, 0.0, 1.0)).toBe(true);
      }
    }
  });
});

describe("letterBaseGlyph", () => {
  it("is deterministic", () => {
    expect(letterBaseGlyph(3, 7, LETTER_CHARSET_LEN)).toBe(letterBaseGlyph(3, 7, LETTER_CHARSET_LEN));
  });

  it("returns index in [0, charsetLen - 1]", () => {
    for (let col = 0; col < 20; col++) {
      for (let row = 0; row < 20; row++) {
        const idx = letterBaseGlyph(col, row, LETTER_CHARSET_LEN);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(LETTER_CHARSET_LEN);
      }
    }
  });

  it("differs between cells", () => {
    const indices = new Set<number>();
    for (let col = 0; col < 10; col++) {
      for (let row = 0; row < 10; row++) {
        indices.add(letterBaseGlyph(col, row, LETTER_CHARSET_LEN));
      }
    }
    expect(indices.size).toBeGreaterThan(1);
  });

  it("covers the full range across many cells", () => {
    const seen = new Set<number>();
    for (let col = 0; col < 50; col++) {
      for (let row = 0; row < 50; row++) {
        seen.add(letterBaseGlyph(col, row, LETTER_CHARSET_LEN));
      }
    }
    expect(seen.size).toBeGreaterThan(LETTER_CHARSET_LEN * 0.8);
  });
});

describe("letterGlyphAt", () => {
  it("is deterministic — same inputs → same output", () => {
    const a = letterGlyphAt(3, 5, 2.5, LETTER_CHARSET_LEN, 1.0);
    const b = letterGlyphAt(3, 5, 2.5, LETTER_CHARSET_LEN, 1.0);
    expect(a).toBe(b);
  });

  it("differs between cells", () => {
    const results = new Set<number>();
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 5; row++) {
        results.add(letterGlyphAt(col, row, 1.0, LETTER_CHARSET_LEN, 1.0));
      }
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it("returns index in [0, charsetLen - 1] always", () => {
    for (let col = 0; col < 10; col++) {
      for (let row = 0; row < 10; row++) {
        for (let t = 0; t < 5; t += 0.3) {
          const idx = letterGlyphAt(col, row, t, LETTER_CHARSET_LEN, 1.0);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(LETTER_CHARSET_LEN);
        }
      }
    }
  });

  it("outside burst window returns base glyph", () => {
    let baseCount = 0;
    let total = 0;
    for (let col = 0; col < 20; col++) {
      for (let row = 0; row < 20; row++) {
        const base = letterBaseGlyph(col, row, LETTER_CHARSET_LEN);
        const t = letterGlyphAt(col, row, 1000.0, LETTER_CHARSET_LEN, 1.0);
        total++;
        if (t === base) baseCount++;
      }
    }
    expect(baseCount / total).toBeGreaterThan(0.5);
  });

  it("within burst window some cells return a non-base glyph", () => {
    let changedCount = 0;
    for (let col = 0; col < 30; col++) {
      for (let row = 0; row < 30; row++) {
        const base = letterBaseGlyph(col, row, LETTER_CHARSET_LEN);
        for (let t = 0; t < 10; t += 0.01) {
          const g = letterGlyphAt(col, row, t, LETTER_CHARSET_LEN, 1.0);
          if (g !== base) {
            changedCount++;
            break;
          }
        }
      }
    }
    expect(changedCount).toBeGreaterThan(0);
  });

  it("higher shuffleSpeed → more frequent glyph transitions per cell", () => {
    function countTransitions(speed: number, windowSec: number, steps: number): number {
      let transitions = 0;
      const dt = windowSec / steps;
      for (let col = 0; col < 20; col++) {
        for (let row = 0; row < 20; row++) {
          let prev = letterGlyphAt(col, row, 0, LETTER_CHARSET_LEN, speed);
          for (let i = 1; i < steps; i++) {
            const cur = letterGlyphAt(col, row, i * dt, LETTER_CHARSET_LEN, speed);
            if (cur !== prev) {
              transitions++;
              prev = cur;
            }
          }
        }
      }
      return transitions;
    }
    const slow = countTransitions(0.5, 2, 2000);
    const fast = countTransitions(4.0, 2, 2000);
    expect(fast).toBeGreaterThan(slow);
  });
});
