import { createTimer, cubicBezier } from "animejs";
import { RAIN_CHARS } from "./presets";

const SWEEP_EASE = cubicBezier(0.6, 0.6, 0, 1);

type ParsedLine = { chars: string; colors: string[] };

type RainCell = {
  el: HTMLElement;
  to: string;
  toColor: string;
  len: number;
  bare: boolean;
  row: number;
  trigger: number;
  resolveAt: number;
  settleAt: number;
  nextTick: number;
  live: boolean;
  done: boolean;
};

function parseHtml(html: string): ParsedLine[] {
  const scratch = document.createElement("div");
  scratch.innerHTML = html;
  const lines: ParsedLine[] = [{ chars: "", colors: [] }];
  for (const node of scratch.childNodes) {
    if (node.nodeName === "BR") {
      lines.push({ chars: "", colors: [] });
      continue;
    }
    const color = node instanceof HTMLElement ? node.style.color : "";
    const text = node.textContent ?? "";
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "\n") {
        lines.push({ chars: "", colors: [] });
        continue;
      }
      const line = lines[lines.length - 1];
      line.chars += text[i];
      line.colors.push(color);
    }
  }
  return lines;
}

function noise(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++)
    out += RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];
  return out;
}

export function rainLayer({
  layerEl,
  numbersEl,
  underHtml,
  toHtml,
  direction = 1,
  background = "var(--color-background-base)",
  onComplete,
}: {
  layerEl: HTMLElement;
  numbersEl?: HTMLElement;
  underHtml: string;
  toHtml: string;
  direction?: number;
  background?: string;
  onComplete?: () => void;
}) {
  const toLines = parseHtml(toHtml);
  const underLines = parseHtml(underHtml);
  const fromNums = numbersEl
    ? [...numbersEl.children].map((el) => el.textContent ?? "")
    : [];
  const rows = Math.max(toLines.length, underLines.length, fromNums.length);
  const cells: RainCell[] = [];

  let maxCols = 0;
  for (let r = 0; r < rows; r++)
    maxCols = Math.max(
      maxCols,
      toLines[r]?.chars.length ?? 0,
      underLines[r]?.chars.length ?? 0
    );

  const sweepSpan = Math.max(maxCols - 1, 1);
  const sweepMs = sweepSpan * 10;
  const rowDelays = Array.from({ length: rows }, () => Math.random() * 75);

  const addCell = (
    el: HTMLElement,
    to: string,
    toColor: string,
    row: number,
    column: number,
    bare: boolean
  ) => {
    const sweep = direction < 0 ? maxCols - 1 - column : column;
    cells.push({
      el,
      to,
      toColor,
      len: Math.max(to.length, el.textContent?.length ?? 0, 1),
      bare,
      row,
      trigger: sweep + Math.random() * 1.8,
      resolveAt: 0,
      settleAt: 0,
      nextTick: 0,
      live: false,
      done: false,
    });
  };

  layerEl.textContent = "";
  const frag = document.createDocumentFragment();
  for (let r = 0; r < rows; r++) {
    if (r > 0) frag.appendChild(document.createElement("br"));
    const under = underLines[r];
    const to = toLines[r];
    const cols = Math.max(under?.chars.length ?? 0, to?.chars.length ?? 0);
    let hiddenRun = "";
    const flush = () => {
      if (!hiddenRun) return;
      const span = document.createElement("span");
      span.textContent = hiddenRun;
      span.style.visibility = "hidden";
      frag.appendChild(span);
      hiddenRun = "";
    };
    for (let c = 0; c < cols; c++) {
      const underChar = under?.chars[c] ?? " ";
      const toChar = to?.chars[c] ?? " ";
      const underColor = under?.colors[c] ?? "";
      const toColor = to?.colors[c] ?? "";
      if (toChar === underChar && (toColor === underColor || toChar === " ")) {
        hiddenRun += toChar;
        continue;
      }
      flush();
      const span = document.createElement("span");
      span.textContent = toChar;
      span.style.visibility = "hidden";
      frag.appendChild(span);
      addCell(span, toChar, toColor, r, c, false);
    }
    flush();
  }
  layerEl.appendChild(frag);

  const finalNumbers = () => {
    if (!numbersEl) return;
    numbersEl.textContent = "";
    for (let r = 0; r < toLines.length; r++) {
      const span = document.createElement("span");
      span.textContent = String(r + 1);
      numbersEl.appendChild(span);
    }
  };

  if (numbersEl) {
    numbersEl.textContent = "";
    for (let r = 0; r < rows; r++) {
      const span = document.createElement("span");
      const fromNum = fromNums[r] ?? "";
      const toNum = r < toLines.length ? String(r + 1) : "";
      span.textContent = fromNum;
      numbersEl.appendChild(span);
      if (fromNum !== toNum) addCell(span, toNum, "", r, 0, true);
    }
  }

  const fronts = new Array<number>(rows);

  const timer = createTimer({
    duration: 75 + sweepMs + 125 + 130 + 10,
    onUpdate: (self) => {
      const t = self.currentTime;

      for (let r = 0; r < rows; r++) {
        const local = (t - rowDelays[r]) / sweepMs;
        fronts[r] =
          local <= 0 ? -1 : SWEEP_EASE(Math.min(local, 1)) * sweepSpan;
        if (local >= 1) fronts[r] = Number.POSITIVE_INFINITY;
      }

      for (const cell of cells) {
        if (cell.done) continue;
        if (cell.settleAt) {
          if (t >= cell.settleAt) {
            cell.el.style.color = cell.toColor;
            cell.done = true;
          }
          continue;
        }
        if (!cell.live) {
          if (fronts[cell.row] < cell.trigger) continue;
          cell.live = true;
          cell.resolveAt = t + 70 + Math.random() * 55;
          cell.el.style.color = "var(--color-text-subtle)";
          if (!cell.bare) {
            cell.el.style.visibility = "";
            cell.el.style.backgroundColor = background;
          }
        }
        if (t >= cell.resolveAt) {
          cell.el.textContent = cell.to;
          if (cell.to.trim()) {
            cell.el.style.color = "var(--color-orange-900)";
            cell.settleAt = cell.resolveAt + 130;
          } else {
            cell.el.style.color = cell.toColor;
            cell.done = true;
          }
          continue;
        }
        if (t >= cell.nextTick) {
          cell.el.textContent = noise(cell.len);
          cell.nextTick = t + 14 + Math.random() * 16;
        }
      }
    },
    onComplete: () => {
      finalNumbers();
      onComplete?.();
    },
  });

  return {
    rows,
    stop: () => {
      timer.cancel();
    },
  };
}
