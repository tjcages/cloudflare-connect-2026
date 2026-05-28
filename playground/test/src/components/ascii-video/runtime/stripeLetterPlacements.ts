import type { BlockGrid } from "./computeBlockGrid";
import { createPrng } from "./prng";
import { STRIPE_LETTER_CHARSET } from "./stripeLetterFont";

export const STRIPE_LETTER_COVERAGE = 0.1;
export const STRIPE_LETTER_BAND = 5;

export type StripeLetterPlacement = { col: number; row: number; char: string };

export function computeStripeLetterPlacements(
  grid: BlockGrid,
  charset: readonly string[] = STRIPE_LETTER_CHARSET,
): StripeLetterPlacement[] {
  if (charset.length === 0) {
    return [];
  }

  const placements: StripeLetterPlacement[] = [];

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const index = row * grid.cols + col;
      const band = grid.bands[index] ?? 0;
      if (band !== STRIPE_LETTER_BAND) {
        continue;
      }

      const prng = createPrng(`${col},${row}`);
      if (!prng.chance(STRIPE_LETTER_COVERAGE)) {
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
