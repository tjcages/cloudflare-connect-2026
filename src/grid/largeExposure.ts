import { BASE_UNIT, type GridCell, type NormalizedGridConfig } from "./types";

/** Max large-cell sides that may touch other larges or the canvas edge for a chair-like tip. */
export const MAX_LARGE_EXPOSURE_SIDES = 2;

/**
 * Counts how many sides of a large footprint are "closed" by other large cells or the canvas edge.
 * A side on y=0 with two large neighbors reads as three contacts (top canvas + two larges).
 */
export const countLargeExposureSides = (
  large: Pick<GridCell, "x" | "y" | "width" | "height">,
  occupied: Set<string>,
  slotKinds: Map<string, GridCell["kind"]>,
  config: Pick<NormalizedGridConfig, "rows" | "columns" | "gapMask">,
) => {
  const startRow = large.y / BASE_UNIT;
  const startColumn = large.x / BASE_UNIT;
  const endRow = startRow + large.height / BASE_UNIT;
  const endColumn = startColumn + large.width / BASE_UNIT;
  const sides = new Set<string>();
  const touchesLargeSlot = (key: string) => occupied.has(key) && slotKinds.get(key) === "large";

  for (let column = startColumn; column < endColumn; column += 1) {
    if (startRow === 0) {
      sides.add("top");
    } else if (!config.gapMask[startRow - 1]?.[column] && touchesLargeSlot(`${startRow - 1}:${column}`)) {
      sides.add("top");
    }

    if (endRow === config.rows) {
      sides.add("bottom");
    } else if (endRow < config.rows && !config.gapMask[endRow]?.[column] && touchesLargeSlot(`${endRow}:${column}`)) {
      sides.add("bottom");
    }
  }

  for (let row = startRow; row < endRow; row += 1) {
    if (startColumn === 0) {
      sides.add("left");
    } else if (!config.gapMask[row]?.[startColumn - 1] && touchesLargeSlot(`${row}:${startColumn - 1}`)) {
      sides.add("left");
    }

    if (endColumn === config.columns) {
      sides.add("right");
    } else if (
      endColumn < config.columns &&
      !config.gapMask[row]?.[endColumn] &&
      touchesLargeSlot(`${row}:${endColumn}`)
    ) {
      sides.add("right");
    }
  }

  return sides.size;
};
