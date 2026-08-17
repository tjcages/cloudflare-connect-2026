import { SYNTAX_TONES, type SyntaxTone } from "./tones";

const MIN_SEGMENT = 3;
const MAX_SEGMENT = 15;
const GAP = 3;
// Figma's seven rows run 55 to 106 wide on the full-width panel. The floor is a
// ratio of whatever room the row actually has, not an absolute: on the Sandbox
// window the code only gets the left 96 of the panel, and an absolute 55 there
// would sample 55 to 69 and read as a solid block instead of as code. 0.52 of
// the ceiling reproduces the shipped 55 on the wide panel exactly.
const MIN_RATIO = 0.52;
// Below this a row cannot hold the four shortest segments and their gaps, so it
// keeps whatever widths it was authored with. This is the guard the ratio cannot
// give: a fraction of the ceiling is never above the ceiling.
const MIN_ROW = MIN_SEGMENT * 4 + GAP * 3;
const MAX_ROW = 106;
// Its 46 segments are 31 neutral, 6 purple, 5 blue, 4 orange.
const TONE_BAG: SyntaxTone[] = [
  ...Array.from({ length: 31 }, () => "neutral" as const),
  ...Array.from({ length: 6 }, () => "purple" as const),
  ...Array.from({ length: 5 }, () => "blue" as const),
  ...Array.from({ length: 4 }, () => "orange" as const),
];

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function between(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function widthsFor(count: number, total: number) {
  const widths = Array.from({ length: count }, () => MIN_SEGMENT);
  let left = total - MIN_SEGMENT * count;
  while (left > 0) {
    const room = widths.flatMap((width, index) =>
      width < MAX_SEGMENT ? [index] : []
    );
    const index = pick(room);
    const give = Math.min(left, MAX_SEGMENT - widths[index], between(1, 4));
    widths[index] += give;
    left -= give;
  }
  return widths;
}

export function shuffleCode(browser: HTMLElement) {
  for (const row of browser.querySelectorAll<HTMLElement>(
    "[data-syntax-row]"
  )) {
    const segments = Array.from(
      row.querySelectorAll<HTMLElement>("[data-syntax-segment]")
    );
    if (segments.length === 0) continue;

    // What is left of the panel to the row's right is the real ceiling — this is
    // what lets one shuffler serve the 176 and 192 wide container panels and the
    // Sandbox window's 96 wide code column without being told which card it is on.
    const room = (row.offsetParent as HTMLElement | null)?.clientWidth ?? 0;
    const ceiling = Math.min(MAX_ROW, room - row.offsetLeft - 12);
    if (ceiling < MIN_ROW) continue;

    const target = between(Math.round(MIN_RATIO * ceiling), ceiling);
    // A row of `n` segments spends `target - GAP * (n - 1)` on bars, each clamped
    // to [3, 15], so `n` has to come from the range where that budget is actually
    // spendable or widthsFor cannot reach the target.
    const minCount = Math.max(
      4,
      Math.ceil((target + GAP) / (MAX_SEGMENT + GAP))
    );
    const maxCount = Math.min(
      8,
      segments.length,
      Math.floor((target + GAP) / (MIN_SEGMENT + GAP))
    );
    const count = between(minCount, Math.max(minCount, maxCount));
    const widths = widthsFor(count, target - GAP * (count - 1));

    let previous: SyntaxTone = "neutral";
    for (const [index, segment] of segments.entries()) {
      if (index >= count) {
        segment.hidden = true;
        continue;
      }
      // Figma never places two accents side by side; a run of them reads as a
      // highlight rather than as syntax.
      const tone: SyntaxTone =
        previous === "neutral" ? pick(TONE_BAG) : "neutral";
      previous = tone;

      segment.hidden = false;
      segment.style.width = `${widths[index]}px`;
      segment.dataset.syntaxTone = tone;
      segment.style.setProperty("--syntax-tone", SYNTAX_TONES[tone]);
    }
  }
}
