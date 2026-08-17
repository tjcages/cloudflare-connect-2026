const MIN_SEGMENT = 3;
const MAX_SEGMENT = 12;
const GAP = 3;
// Figma's three code rows run 33 to 85 wide. The band is a little wider so a
// reshuffled window reads varied, and still clears the 192 panel.
const MIN_ROW = 40;
const MAX_ROW = 85;

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
    const index = room[Math.floor(Math.random() * room.length)];
    const give = Math.min(left, MAX_SEGMENT - widths[index], between(1, 4));
    widths[index] += give;
    left -= give;
  }
  return widths;
}

export function shuffleRows(browser: HTMLElement) {
  for (const row of browser.querySelectorAll<HTMLElement>(
    "[data-stream-row]"
  )) {
    const segments = Array.from(
      row.querySelectorAll<HTMLElement>("[data-stream-segment]")
    );
    if (segments.length === 0) continue;

    const target = between(MIN_ROW, MAX_ROW);
    // A row of `n` segments spends `target - GAP * (n - 1)` on dashes, each
    // clamped to [3, 12], so `n` has to come from the range where that budget is
    // actually spendable or widthsFor cannot reach the target.
    const minCount = Math.max(
      4,
      Math.ceil((target + GAP) / (MAX_SEGMENT + GAP))
    );
    const maxCount = Math.min(
      segments.length,
      Math.floor((target + GAP) / (MIN_SEGMENT + GAP))
    );
    const count = between(minCount, Math.max(minCount, maxCount));
    const widths = widthsFor(count, target - GAP * (count - 1));

    for (const [index, segment] of segments.entries()) {
      if (index >= count) {
        segment.hidden = true;
        continue;
      }
      segment.hidden = false;
      segment.style.width = `${widths[index]}px`;
    }
  }
}
