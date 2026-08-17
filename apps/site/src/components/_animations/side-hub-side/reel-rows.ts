export type ReelDir = "up" | "down";

export interface ReelCell {
  row: number;
  itemIndex: number;
  center: boolean;
}

const MIN_CELLS = 4;
export const CENTER_ROW = 1;

const wrap = (value: number, size: number) => ((value % size) + size) % size;

export function reelCellCount(itemCount: number) {
  return itemCount * Math.ceil(MIN_CELLS / itemCount);
}

export function reelRow(
  index: number,
  step: number,
  count: number,
  dir: ReelDir
) {
  const first = dir === "up" ? 0 : -1;
  return first + wrap(dir === "up" ? index - step : index + step, count);
}

export function reelCenterIndex(step: number, count: number, dir: ReelDir) {
  for (let index = 0; index < count; index++) {
    if (reelRow(index, step, count, dir) === CENTER_ROW) return index;
  }
  return 0;
}

export function reelCells(itemCount: number, dir: ReelDir): ReelCell[] {
  const count = reelCellCount(itemCount);
  return Array.from({ length: count }, (_, index) => {
    const row = reelRow(index, 0, count, dir);
    const distance = dir === "up" ? row - CENTER_ROW : CENTER_ROW - row;
    return {
      row,
      itemIndex: wrap(distance, itemCount),
      center: row === CENTER_ROW,
    };
  });
}
