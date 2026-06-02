/** Letter cycle timing for the playground (not grid PRNG). */

/** Rest delay between spin cycles. */
export const LETTER_CYCLE_DELAY_MIN_MS = 100;
export const LETTER_CYCLE_DELAY_MAX_MS = 400;

/** Delay between rapid letter steps within one cycle. */
export const LETTER_CYCLE_STEP_MIN_MS = 35;
export const LETTER_CYCLE_STEP_MAX_MS = 55;

export const LETTER_CYCLE_ITERATIONS_MIN = 2;
export const LETTER_CYCLE_ITERATIONS_MAX = 5;

export function randomLetterCycleDelayMs(): number {
  return LETTER_CYCLE_DELAY_MIN_MS + Math.random() * (LETTER_CYCLE_DELAY_MAX_MS - LETTER_CYCLE_DELAY_MIN_MS);
}

export function randomLetterCycleStepDelayMs(): number {
  return LETTER_CYCLE_STEP_MIN_MS + Math.random() * (LETTER_CYCLE_STEP_MAX_MS - LETTER_CYCLE_STEP_MIN_MS);
}

export function randomLetterCycleIterationCount(): number {
  return (
    LETTER_CYCLE_ITERATIONS_MIN +
    Math.floor(Math.random() * (LETTER_CYCLE_ITERATIONS_MAX - LETTER_CYCLE_ITERATIONS_MIN + 1))
  );
}

/** Stagger first cycle per cell so letters do not animate in sync. */
export function scheduleInitialLetterCycleAt(fromMs: number = performance.now()): number {
  return fromMs + randomLetterCycleDelayMs();
}
