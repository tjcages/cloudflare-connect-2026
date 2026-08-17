import { RIPPLE_CHARS, RIPPLE_HOLD_MS, RIPPLE_STEP_MS } from "./presets";

const rippleFrames = new WeakMap<HTMLElement, number>();

export function ripple(el: HTMLElement, text: string) {
  const len = text.length;
  if (len === 0) return;

  const prev = rippleFrames.get(el);
  if (prev !== undefined) cancelAnimationFrame(prev);

  const duration = (len - 1) * RIPPLE_STEP_MS + RIPPLE_HOLD_MS;
  let start: number | null = null;

  const tick = (now: number) => {
    start ??= now;
    const elapsed = now - start;
    if (elapsed >= duration) {
      el.textContent = text;
      rippleFrames.delete(el);
      return;
    }

    let out = "";
    for (let i = 0; i < len; i++) {
      const char = text[i];
      const from = i * RIPPLE_STEP_MS;
      out +=
        char === " " || elapsed < from || elapsed >= from + RIPPLE_HOLD_MS
          ? char
          : RIPPLE_CHARS[Math.floor(Math.random() * RIPPLE_CHARS.length)];
    }
    el.textContent = out;
    rippleFrames.set(el, requestAnimationFrame(tick));
  };

  rippleFrames.set(el, requestAnimationFrame(tick));
}
