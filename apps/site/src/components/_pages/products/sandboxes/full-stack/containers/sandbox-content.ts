import type { SyntaxTone } from "@/components/_animations/container-stream/tones";
import { between, pick } from "@/utils/random";

export type SandboxBar = { el: HTMLElement; tone: SyntaxTone | null };

const MIN_BAR = 3;
const MAX_BAR = 15;
const GAP = 3;
const MIN_ROW = 30;
const MAX_ROW = 64;
const MIN_BARS = 2;
const MAX_BARS = 6;
const MIN_ROWS = 6;
const MAX_ROWS = 7;

const ROW_TOPS = [
  "top-15",
  "top-24",
  "top-33",
  "top-51",
  "top-60",
  "top-69",
  "top-78",
];

const BAR_WIDTHS = [
  "w-3",
  "w-4",
  "w-5",
  "w-6",
  "w-7",
  "w-8",
  "w-9",
  "w-10",
  "w-11",
  "w-12",
  "w-13",
  "w-14",
  "w-15",
];

const ROW = "absolute left-15 flex gap-3";
const BAR = "h-3 shrink-0 rounded-4 bg-darker/7";
const TITLE = "h-7 w-72 rounded-4 bg-darker/2";
const BLOCK_ROW = "mt-11 flex gap-6";
const SLOTS = ["h-24 w-41", "h-24 w-25", "mt-6 h-24 w-72"];
const NEUTRAL = "rounded-4 bg-darker/2";
const ACCENT =
  "relative rounded-4 bg-(--color-dynamic-purple-7) before:inside-border before:border-(--color-dynamic-purple-5)";

let accentSlot = 1;

function rollAccent() {
  let next = accentSlot;
  while (next === accentSlot) next = between(0, SLOTS.length - 1);
  accentSlot = next;
  return next;
}

function widthsFor(count: number, total: number) {
  const widths = Array.from({ length: count }, () => MIN_BAR);
  let left = total - MIN_BAR * count;
  while (left > 0) {
    const room = widths.flatMap((width, index) =>
      width < MAX_BAR ? [index] : []
    );
    const index = pick(room);
    const give = Math.min(left, MAX_BAR - widths[index], between(1, 4));
    widths[index] += give;
    left -= give;
  }
  return widths;
}

function makeDiv(classes: string[]): HTMLElement {
  const el = document.createElement("div");
  el.className = classes.join(" ");
  return el;
}

function makeBar(
  classes: string[],
  tone: SyntaxTone | null,
  bars: SandboxBar[]
) {
  const el = makeDiv(classes);
  el.setAttribute("data-sandbox-bar", "");
  bars.push({ el, tone });
  return el;
}

function buildRows(bars: SandboxBar[]) {
  return Array.from({ length: between(MIN_ROWS, MAX_ROWS) }, (_, index) => {
    const total = between(MIN_ROW, MAX_ROW);
    const minCount = Math.max(
      MIN_BARS,
      Math.ceil((total + GAP) / (MAX_BAR + GAP))
    );
    const maxCount = Math.min(
      MAX_BARS,
      Math.floor((total + GAP) / (MIN_BAR + GAP))
    );
    const count = between(minCount, Math.max(minCount, maxCount));

    const row = makeDiv([ROW, ROW_TOPS[index]]);
    for (const width of widthsFor(count, total - GAP * (count - 1))) {
      row.appendChild(
        makeBar([BAR, BAR_WIDTHS[width - MIN_BAR]], "neutral", bars)
      );
    }
    return row;
  });
}

function buildPanel(beats: SandboxBar[][]) {
  const accent = rollAccent();
  const titleBeat: SandboxBar[] = [];
  const middleBeat: SandboxBar[] = [];
  const bottomBeat: SandboxBar[] = [];
  const slot = (index: number, beat: SandboxBar[]) => {
    const isAccent = index === accent;
    const el = makeBar([SLOTS[index], isAccent ? ACCENT : NEUTRAL], null, beat);
    if (isAccent) el.setAttribute("data-sandbox-accent", "");
    return el;
  };

  const title = makeBar([TITLE], null, titleBeat);
  const left = slot(0, middleBeat);
  const right = slot(1, middleBeat);
  const wide = slot(2, bottomBeat);
  beats.push(titleBeat, middleBeat, bottomBeat);

  const row = makeDiv([BLOCK_ROW]);
  row.appendChild(left);
  row.appendChild(right);
  return [title, row, wide];
}

export function shuffleSandbox(root: HTMLElement) {
  const lines = root.querySelector<HTMLElement>("[data-sandbox-lines]");
  const panel = root.querySelector<HTMLElement>("[data-sandbox-panel]");
  if (!lines || !panel) return { left: [], right: [] };

  const left: SandboxBar[] = [];
  const right: SandboxBar[][] = [];
  lines.replaceChildren(...buildRows(left));
  panel.replaceChildren(...buildPanel(right));
  return { left, right };
}
