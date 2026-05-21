import { describe, expect, it } from "vitest";
import { STRIPE_LETTER_BAND, STRIPE_LETTER_COVERAGE, computeStripeLetterPlacements } from "./stripeLetterPlacements";
import { STRIPE_LETTER_CHARSET } from "./stripeLetterFont";

describe("computeStripeLetterPlacements", () => {
  it("only places letters on band-5 cells", () => {
    const grid = {
      cols: 3,
      rows: 2,
      bands: new Uint8Array([5, 4, 3, 2, 1, 5]),
    };

    const placements = computeStripeLetterPlacements(grid);
    for (const placement of placements) {
      const index = placement.row * grid.cols + placement.col;
      expect(grid.bands[index]).toBe(STRIPE_LETTER_BAND);
    }
  });

  it("returns identical placements for the same grid", () => {
    const grid = {
      cols: 8,
      rows: 6,
      bands: new Uint8Array(8 * 6).fill(STRIPE_LETTER_BAND),
    };

    const first = computeStripeLetterPlacements(grid);
    const second = computeStripeLetterPlacements(grid);
    expect(second).toEqual(first);
  });

  it("uses only characters from the charset", () => {
    const grid = {
      cols: 12,
      rows: 10,
      bands: new Uint8Array(12 * 10).fill(STRIPE_LETTER_BAND),
    };

    const placements = computeStripeLetterPlacements(grid);
    for (const placement of placements) {
      expect(STRIPE_LETTER_CHARSET).toContain(placement.char);
    }
  });

  it("covers roughly 10% of band-5 cells on a large synthetic grid", () => {
    const cols = 40;
    const rows = 30;
    const grid = {
      cols,
      rows,
      bands: new Uint8Array(cols * rows).fill(STRIPE_LETTER_BAND),
    };

    const placements = computeStripeLetterPlacements(grid);
    const bandFiveCount = cols * rows;
    const ratio = placements.length / bandFiveCount;
    expect(ratio).toBeGreaterThan(STRIPE_LETTER_COVERAGE - 0.04);
    expect(ratio).toBeLessThan(STRIPE_LETTER_COVERAGE + 0.04);
  });
});
