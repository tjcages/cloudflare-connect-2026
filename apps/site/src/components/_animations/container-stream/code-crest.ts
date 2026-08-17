import { clamp } from "@/components/_animations/shared/snake-pulse/math";
import { CREST_TONES, type SyntaxTone } from "./tones";

// Seconds each element waits behind the one before it.
const STEP = 0.035;
// How many elements the crest spans. Its envelope is a sine rather than a
// bezier: the wave rises and falls symmetrically, and a bezier cannot mirror.
const WAVE = 6;
// The token commits well before the crest reaches it — otherwise the crest
// paints its hottest colour at ~0.6 opacity and washes out.
const LIT = 2;
const WAVE_AMP = 0.6;

/**
 * The elements the crest travels through, in reading order: each row's leading
 * dot followed by that row's visible segments. Hidden segments are skipped, so
 * this has to be re-collected after every `shuffleCode`.
 */
export function collectCrestSteps(browser: HTMLElement) {
  const steps: HTMLElement[] = [];
  for (const row of browser.querySelectorAll<HTMLElement>(
    "[data-syntax-row]"
  )) {
    const index = row.getAttribute("data-syntax-row");
    const dot = browser.querySelector<HTMLElement>(
      `[data-syntax-dot="${index}"]`
    );
    if (dot) steps.push(dot);
    steps.push(
      ...row.querySelectorAll<HTMLElement>(
        "[data-syntax-segment]:not([hidden])"
      )
    );
  }
  return steps;
}

function settle(el: HTMLElement) {
  el.style.opacity = "1";
  el.style.scale = "";
  el.style.backgroundColor = "";
}

export function clearCrest(browser: HTMLElement) {
  for (const el of browser.querySelectorAll<HTMLElement>(
    "[data-syntax-dot], [data-syntax-segment]"
  )) {
    el.style.opacity = "";
    el.style.scale = "";
    el.style.backgroundColor = "";
  }
}

/**
 * Advance the crest to `elapsed` seconds into the run. `written` is the count of
 * elements already settled — pass back what this returns, so a settled element is
 * never repainted. `progress` runs 0 to 1 across the whole crest, for anything
 * that has to fill alongside it.
 */
export function paintCrest(
  steps: HTMLElement[],
  elapsed: number,
  written: number
) {
  const head = elapsed / STEP;
  const span = steps.length + WAVE;
  const progress = span > 0 ? clamp(head / span, 0, 1) : 1;

  const settled = clamp(Math.floor(head - WAVE), 0, steps.length);
  for (; written < settled; written++) settle(steps[written]);

  const live = clamp(Math.ceil(head), 0, steps.length);
  for (let i = written; i < live; i++) {
    const el = steps[i];
    const crest = clamp((head - i) / WAVE, 0, 1);
    const env = Math.sin(Math.PI * crest);
    el.style.opacity = `${0.2 + 0.8 * clamp((head - i) / LIT, 0, 1)}`;
    if (!el.hasAttribute("data-syntax-segment")) continue;

    el.style.scale = `1 ${1 + WAVE_AMP * env}`;
    const tone =
      CREST_TONES[(el.dataset.syntaxTone ?? "neutral") as SyntaxTone];
    if (tone) el.style.backgroundColor = tone(env);
  }

  if (head >= span) {
    for (const el of steps) settle(el);
    return { written: steps.length, progress, done: true };
  }

  return { written, progress, done: false };
}
