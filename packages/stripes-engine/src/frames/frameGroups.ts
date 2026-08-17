import type { Stripe } from "../config/types";
import type { CellGridReadback } from "../engine";

/**
 * Row extent of one occupied column in a group. Sparkle motion offsets whole
 * columns at a time, so a group's on-screen bounds resolve from these rather
 * than from every cell it contains — a few entries per group instead of
 * thousands, re-evaluated on every frame the overlay paints.
 */
export type FrameColumn = { col: number; minRow: number; maxRow: number };

export type FrameGroup = {
  /** Occupied columns, ascending. Never empty. */
  columns: FrameColumn[];
};

/**
 * Flood-fill the cell grid into clusters of bright cells, one frame per cluster.
 *
 * A cell qualifies when its luminance clears `luminanceThreshold` *and* it falls
 * in one of the `highlightedStripeCount` thickest stripe bands, which is what
 * keeps the frames on the artwork's peaks instead of ringing every lit cell.
 * `groupDistanceCells` is the Chebyshev radius that still counts as touching, so
 * raising it merges neighbouring clusters into one larger frame.
 */
export function buildFrameGroups(
  readback: CellGridReadback,
  luminanceThreshold: number,
  groupDistanceCells = 1,
  stripes: readonly Stripe[] = [],
  highlightedStripeCount = 3,
): FrameGroup[] {
  const { cols, rows, values } = readback;
  const thresholdByte = Math.round(Math.max(0, Math.min(1, luminanceThreshold)) * 255);
  const groupDistance = Math.round(Math.max(0, Math.min(8, groupDistanceCells)));
  const sortedStripes = [...stripes].sort((a, b) => a.startFrom - b.startFrom);
  const highlightedBands = new Set(
    sortedStripes
      .map((stripe, band) => ({ stripe, band }))
      .filter(({ stripe }) => stripe.width >= 0.5 && stripe.opacity > 0.001)
      .sort((a, b) => b.stripe.startFrom - a.stripe.startFrom || b.band - a.band)
      .slice(0, Math.max(1, Math.round(highlightedStripeCount)))
      .map(({ band }) => band),
  );
  const active = new Uint8Array(cols * rows);
  const isHighlightedStripe = (value: number) => {
    if (sortedStripes.length === 0) return true;
    const normalizedValue = value / 255;
    let band = -1;
    for (let index = 0; index < sortedStripes.length; index++) {
      if (sortedStripes[index].startFrom <= normalizedValue) band = index;
    }
    return highlightedBands.has(band);
  };

  // GL reads bottom-up and the overlay draws top-down, so rows flip here once
  // rather than at every consumer of the group.
  for (let readbackRow = 0; readbackRow < rows; readbackRow++) {
    const displayRow = rows - 1 - readbackRow;
    for (let col = 0; col < cols; col++) {
      const value = values[readbackRow * cols + col] ?? 0;
      if (value >= thresholdByte && isHighlightedStripe(value)) {
        active[displayRow * cols + col] = 1;
      }
    }
  }

  const groups: FrameGroup[] = [];
  const queue: number[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const startIndex = row * cols + col;
      if (active[startIndex] === 0) continue;
      active[startIndex] = 0;
      queue.length = 0;
      queue.push(startIndex);
      const extents = new Map<number, FrameColumn>();

      for (let cursor = 0; cursor < queue.length; cursor++) {
        const index = queue[cursor];
        const cellRow = Math.floor(index / cols);
        const cellCol = index - cellRow * cols;
        const extent = extents.get(cellCol);
        if (!extent) extents.set(cellCol, { col: cellCol, minRow: cellRow, maxRow: cellRow });
        else if (cellRow < extent.minRow) extent.minRow = cellRow;
        else if (cellRow > extent.maxRow) extent.maxRow = cellRow;

        for (let rowOffset = -groupDistance; rowOffset <= groupDistance; rowOffset++) {
          for (let colOffset = -groupDistance; colOffset <= groupDistance; colOffset++) {
            if (rowOffset === 0 && colOffset === 0) continue;
            const nextCol = cellCol + colOffset;
            const nextRow = cellRow + rowOffset;
            if (nextCol < 0 || nextCol >= cols || nextRow < 0 || nextRow >= rows) continue;
            const nextIndex = nextRow * cols + nextCol;
            if (active[nextIndex] === 0) continue;
            active[nextIndex] = 0;
            queue.push(nextIndex);
          }
        }
      }

      groups.push({ columns: [...extents.values()].sort((a, b) => a.col - b.col) });
    }
  }

  return groups;
}
