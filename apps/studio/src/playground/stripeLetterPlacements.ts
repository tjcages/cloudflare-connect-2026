import type { BlockGrid } from "./computeBlockGrid";
import { createPrng } from "../grid/prng";
import { STRIPE_LETTER_CHARSET } from "./stripeLetterFont";

export const STRIPE_LETTER_COVERAGE = 0.1;

export type StripeLetterPlacement = { col: number; row: number; char: string };

/** Highest stripe index present in the grid (the brightest stripe), or 0 if empty. */
function highestStripeIndex(grid: BlockGrid): number {
  let max = 0;
  for (let i = 0; i < grid.indices.length; i++) {
    const value = grid.indices[i] ?? 0;
    if (value > max) {
      max = value;
    }
  }
  return max;
}

export function computeStripeLetterPlacements(
  grid: BlockGrid,
  charset: readonly string[] = STRIPE_LETTER_CHARSET,
  ratio: number = STRIPE_LETTER_COVERAGE,
): StripeLetterPlacement[] {
  if (charset.length === 0 || ratio <= 0) {
    return [];
  }

  const letterIndex = highestStripeIndex(grid);
  if (letterIndex < 1) {
    return [];
  }

  const placements: StripeLetterPlacement[] = [];

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const index = row * grid.cols + col;
      const band = grid.indices[index] ?? 0;
      if (band !== letterIndex) {
        continue;
      }

      const prng = createPrng(`${col},${row}`);
      if (ratio < 1 && !prng.chance(ratio)) {
        continue;
      }

      const charIndex = prng.integer(0, charset.length - 1);
      placements.push({
        col,
        row,
        char: charset[charIndex] ?? charset[0] ?? "?",
      });
    }
  }

  return placements;
}
