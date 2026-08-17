import { resolveZoom } from "@/utils/zoom";
import {
  type From,
  type PresetConfig,
  SCRAMBLE_PRESETS,
  type ScramblePreset,
} from "./presets";

type Cell = { char: string; className: string };

const FRAME_MS = 33;
const PLACEHOLDER = "&nbsp;";
const CARET_OPACITY = 0.35;
const CARET_HTML = '<span class="relative top-[-0.167em]">█</span>';

function buildCells(root: HTMLElement): Cell[] {
  const cells: Cell[] = [];
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const char of node.textContent ?? "")
        cells.push({ char, className: "" });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const { className } = el;
      for (const char of el.textContent ?? "") cells.push({ char, className });
    }
  }
  return cells;
}

function escapeChar(char: string): string {
  if (char === "&") return "&amp;";
  if (char === "<") return "&lt;";
  if (char === ">") return "&gt;";
  return char;
}

function wrap(content: string, className: string): string {
  return className ? `<span class="${className}">${content}</span>` : content;
}

function revealOrder(count: number, from: From): number[] {
  const order = new Array<number>(count);
  if (from === "center") {
    const mid = (count - 1) / 2;
    for (let i = 0; i < count; i++) order[i] = Math.round(Math.abs(i - mid));
  } else {
    for (let i = 0; i < count; i++) order[i] = i;
  }
  return order;
}

export function scrambleChars(
  root: HTMLElement,
  preset: ScramblePreset,
  from?: From,
  options: {
    conceal?: boolean;
    duration?: number;
    morphFrom?: string;
    onComplete?: () => void;
  } = {}
) {
  const cfg: PresetConfig = SCRAMBLE_PRESETS[preset];
  const conceal = options.conceal ?? false;
  const cells = buildCells(root);
  // A morph away from longer text needs columns for the tail it is losing,
  // otherwise those characters pop out on the first frame instead of dissolving.
  if (options.morphFrom)
    for (let i = cells.length; i < options.morphFrom.length; i++)
      cells.push({ char: " ", className: cells.at(-1)?.className ?? "" });
  const count = cells.length;
  if (count === 0) {
    options.onComplete?.();
    return () => undefined;
  }

  const { chars } = cfg;
  const cursor = conceal || typeof cfg.cursor !== "string" ? "" : cfg.cursor;
  const order = revealOrder(count, from ?? cfg.from);
  const maxOrder = Math.max(...order);
  const baseInterval = 1000 / cfg.revealRate;
  const settle = cfg.settleDuration;
  // `duration` pins the whole run instead of letting the preset's per-character
  // rate stretch it, so a long label lands with the motion it travels under.
  const interval = options.duration
    ? Math.max(options.duration - settle, 0) / Math.max(maxOrder, 1)
    : maxOrder > 0
      ? (baseInterval * (count - 1)) / maxOrder
      : baseInterval;
  const caretHold = cfg.caretHold ?? 0;
  const lastClassName = cells[count - 1]?.className ?? "";
  const finalHTML = root.innerHTML;
  const concealedHTML = PLACEHOLDER.repeat(count);
  const total = maxOrder * interval + settle;

  const randomChar = () => chars[Math.floor(Math.random() * chars.length)];

  let raf = 0;
  let done = false;
  let start: number | null = null;
  let lastRender = 0;
  let caretTimer = 0;
  let caretAnim: Animation | null = null;
  let caretEl: HTMLElement | null = null;
  let raisedRoot = false;

  const removeCaret = () => {
    if (caretTimer) clearTimeout(caretTimer);
    caretAnim?.cancel();
    caretEl?.remove();
    caretEl = null;
    if (raisedRoot) {
      root.style.position = "";
      raisedRoot = false;
    }
  };

  const showCaret = () => {
    if (!cursor || caretHold <= 0) return;
    const rootStyle = getComputedStyle(root);
    // Absolute positioning keeps add/remove from reflowing a centered line.
    if (rootStyle.position === "static") {
      root.style.position = "relative";
      raisedRoot = true;
    }
    const zoom = resolveZoom(root);
    const rootRect = root.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(root);
    const textRect = range.getBoundingClientRect();
    const el = document.createElement("span");
    if (lastClassName) el.className = lastClassName;
    el.innerHTML = CARET_HTML;
    el.setAttribute("aria-hidden", "true");
    el.style.position = "absolute";
    el.style.left = `${(textRect.right - rootRect.left) / zoom}px`;
    el.style.top = `${(textRect.top - rootRect.top) / zoom}px`;
    el.style.pointerEvents = "none";
    root.appendChild(el);
    caretEl = el;
    caretAnim = el.animate(
      [
        { opacity: CARET_OPACITY, offset: 0 },
        { opacity: CARET_OPACITY, offset: 0.5 },
        { opacity: 0, offset: 0.5 },
        { opacity: 0, offset: 1 },
      ],
      { duration: 500, iterations: Number.POSITIVE_INFINITY }
    );
    caretTimer = window.setTimeout(removeCaret, caretHold);
  };

  const tick = (now: number) => {
    start ??= now;
    const elapsed = now - start;

    if (elapsed >= total) {
      done = true;
      if (conceal) {
        root.innerHTML = concealedHTML;
      } else {
        root.innerHTML = finalHTML;
        showCaret();
      }
      options.onComplete?.();
      return;
    }

    if (now - lastRender >= FRAME_MS) {
      lastRender = now;

      let frontier = -1;
      for (let i = 0; i < count; i++) {
        if (cells[i].char !== " " && elapsed < order[i] * interval) {
          frontier = frontier === -1 ? order[i] : Math.min(frontier, order[i]);
        }
      }

      let html = "";
      for (let i = 0; i < count; i++) {
        const { char, className } = cells[i];
        if (cursor && char !== " " && order[i] === frontier) {
          html += `<span${className ? ` class="${className}"` : ""} style="opacity:${CARET_OPACITY}">${CARET_HTML}</span>`;
          continue;
        }
        if (conceal) {
          const dissolveAt = order[i] * interval;
          if (char === " " || elapsed >= dissolveAt + settle)
            html += PLACEHOLDER;
          else if (elapsed < dissolveAt)
            html += wrap(escapeChar(char), className);
          else html += wrap(escapeChar(randomChar()), className);
          continue;
        }
        if (elapsed < order[i] * interval) {
          const seed = options.morphFrom?.[i];
          html +=
            seed && seed !== " "
              ? wrap(escapeChar(seed), className)
              : PLACEHOLDER;
          continue;
        }
        if (char === " ") {
          html += PLACEHOLDER;
          continue;
        }
        const out =
          elapsed >= order[i] * interval + settle ? char : randomChar();
        html += wrap(escapeChar(out), className);
      }
      root.innerHTML = html;
    }

    raf = requestAnimationFrame(tick);
  };

  // Frame 0 renders synchronously: a morph must never paint the settled text.
  tick(performance.now());

  return () => {
    if (raf) cancelAnimationFrame(raf);
    removeCaret();
    // A finished run has nothing to restore, and rewriting here would clobber
    // whatever the caller rendered next.
    if (!(conceal || done)) root.innerHTML = finalHTML;
  };
}
