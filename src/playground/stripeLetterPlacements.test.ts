import { describe, expect, it } from "vitest";
import { STRIPE_LETTER_COVERAGE, computeStripeLetterPlacements } from "./stripeLetterPlacements";
import { STRIPE_LETTER_CHARSET } from "./stripeLetterFont";

describe("computeStripeLetterPlacements", () => {
  it("only places letters on the highest stripe-index cells", () => {
    const grid = {
      cols: 3,
      rows: 2,
      indices: new Uint8Array([5, 4, 3, 2, 1, 5]),
    };

    const placements = computeStripeLetterPlacements(grid);
    for (const placement of placements) {
      const index = placement.row * grid.cols + placement.col;
      expect(grid.indices[index]).toBe(5);
    }
  });

  it("returns no placements for a background-only grid", () => {
    const grid = { cols: 4, rows: 4, indices: new Uint8Array(16) };
    expect(computeStripeLetterPlacements(grid)).toEqual([]);
  });

  it("returns identical placements for the same grid", () => {
    const grid = {
      cols: 8,
      rows: 6,
      indices: new Uint8Array(8 * 6).fill(6),
    };

    const first = computeStripeLetterPlacements(grid);
    const second = computeStripeLetterPlacements(grid);
    expect(second).toEqual(first);
  });

  it("uses only characters from the charset", () => {
    const grid = {
      cols: 12,
      rows: 10,
      indices: new Uint8Array(12 * 10).fill(6),
    };

    const placements = computeStripeLetterPlacements(grid);
    for (const placement of placements) {
      expect(STRIPE_LETTER_CHARSET).toContain(placement.char);
    }
  });

  it("covers roughly 10% of top-stripe cells on a large synthetic grid", () => {
    const cols = 40;
    const rows = 30;
    const grid = {
      cols,
      rows,
      indices: new Uint8Array(cols * rows).fill(6),
    };

    const placements = computeStripeLetterPlacements(grid);
    const ratio = placements.length / (cols * rows);
    expect(ratio).toBeGreaterThan(STRIPE_LETTER_COVERAGE - 0.04);
    expect(ratio).toBeLessThan(STRIPE_LETTER_COVERAGE + 0.04);
  });
});
