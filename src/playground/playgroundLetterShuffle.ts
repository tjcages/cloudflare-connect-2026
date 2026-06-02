/** Letter reshuffle timing for the playground (not grid PRNG). */

export const LETTER_SHUFFLE_MIN_MS = 500;
export const LETTER_SHUFFLE_MAX_MS = 1000;

export function scheduleNextLetterShuffleAt(fromMs: number = performance.now()): number {
  return fromMs + LETTER_SHUFFLE_MIN_MS + Math.random() * (LETTER_SHUFFLE_MAX_MS - LETTER_SHUFFLE_MIN_MS);
}

/** Stagger first shuffle per cell so letters do not flip in sync. */
export function scheduleInitialLetterShuffleAt(fromMs: number = performance.now()): number {
  return fromMs + Math.random() * LETTER_SHUFFLE_MAX_MS;
}
