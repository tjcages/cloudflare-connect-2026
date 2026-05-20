import { BASE_UNIT, type GridCell } from "./types";

const footprintKey = (row: number, column: number) => `${row}:${column}`;

export const getCellSlotSet = (cell: Pick<GridCell, "x" | "y" | "width" | "height">) => {
  const startColumn = cell.x / BASE_UNIT;
  const startRow = cell.y / BASE_UNIT;
  const columns = cell.width / BASE_UNIT;
  const rows = cell.height / BASE_UNIT;
  const slots = new Set<string>();

  for (let row = startRow; row < startRow + rows; row += 1) {
    for (let column = startColumn; column < startColumn + columns; column += 1) {
      slots.add(footprintKey(row, column));
    }
  }

  return slots;
};

const slotSetsShareEdge = (left: Set<string>, right: Set<string>) => {
  for (const key of left) {
    const [row, column] = key.split(":").map(Number);

    for (const neighbor of [
      footprintKey(row - 1, column),
      footprintKey(row + 1, column),
      footprintKey(row, column - 1),
      footprintKey(row, column + 1),
    ]) {
      if (right.has(neighbor)) {
        return true;
      }
    }
  }

  return false;
};

const slotSetsTouchDiagonally = (left: Set<string>, right: Set<string>) => {
  for (const key of left) {
    const [row, column] = key.split(":").map(Number);

    for (const neighbor of [
      footprintKey(row - 1, column - 1),
      footprintKey(row - 1, column + 1),
      footprintKey(row + 1, column - 1),
      footprintKey(row + 1, column + 1),
    ]) {
      if (right.has(neighbor)) {
        return true;
      }
    }
  }

  return false;
};

export const isSlotDiagonalTipToLarge = (
  small: Pick<GridCell, "x" | "y" | "width" | "height">,
  large: Pick<GridCell, "x" | "y" | "width" | "height">,
) => {
  const smallSlots = getCellSlotSet(small);
  const largeSlots = getCellSlotSet(large);

  return slotSetsTouchDiagonally(smallSlots, largeSlots) && !slotSetsShareEdge(smallSlots, largeSlots);
};

export const smallSharesSlotEdgeWithLarge = (
  small: Pick<GridCell, "x" | "y" | "width" | "height">,
  large: Pick<GridCell, "x" | "y" | "width" | "height">,
) => slotSetsShareEdge(getCellSlotSet(small), getCellSlotSet(large));

export const findSoleSlotDiagonalLargeForSmall = (
  small: Pick<GridCell, "x" | "y" | "width" | "height">,
  cells: GridCell[],
) => {
  const diagonalLarges = cells.filter((cell) => cell.kind === "large" && isSlotDiagonalTipToLarge(small, cell));

  if (diagonalLarges.length !== 1) {
    return null;
  }

  const smallSlots = getCellSlotSet(small);

  const edgeLarges = cells.filter(
    (cell) => cell.kind === "large" && slotSetsShareEdge(smallSlots, getCellSlotSet(cell)),
  );

  if (edgeLarges.length > 0) {
    return null;
  }

  return diagonalLarges[0]!;
};
