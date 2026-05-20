import { findSoleSlotDiagonalLargeForSmall, smallSharesSlotEdgeWithLarge } from "./cellAttachment";
import { usesMixedCellRules } from "./config";
import { countLargeExposureSides, MAX_LARGE_EXPOSURE_SIDES } from "./largeExposure";
import { candidateTouchesGap } from "./mask";
import { BASE_UNIT, LARGE_CELL_SIZE, SMALL_CELL_SIZE, type GeneratedGrid, type GridCell } from "./types";

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const footprintKey = (row: number, column: number) => `${row}:${column}`;

export const getCellFootprint = (cell: GridCell): string[] => {
  const startColumn = cell.x / BASE_UNIT;
  const startRow = cell.y / BASE_UNIT;
  const columns = cell.width / BASE_UNIT;
  const rows = cell.height / BASE_UNIT;
  const footprint: string[] = [];

  for (let row = startRow; row < startRow + rows; row += 1) {
    for (let column = startColumn; column < startColumn + columns; column += 1) {
      footprint.push(footprintKey(row, column));
    }
  }

  return footprint;
};

const getNeighborKeys = (key: string, includeDiagonals = false) => {
  const [row, column] = key.split(":").map(Number);
  const neighbors = [`${row - 1}:${column}`, `${row + 1}:${column}`, `${row}:${column - 1}`, `${row}:${column + 1}`];

  if (includeDiagonals) {
    neighbors.push(
      `${row - 1}:${column - 1}`,
      `${row - 1}:${column + 1}`,
      `${row + 1}:${column - 1}`,
      `${row + 1}:${column + 1}`,
    );
  }

  return neighbors;
};

const cellsAreConnected = (cells: GridCell[]) => {
  const baseCells = cells.filter((cell) => cell.kind !== "overlaySmall");

  if (baseCells.length <= 1) {
    return true;
  }

  const occupied = new Set(baseCells.flatMap(getCellFootprint));
  const first = occupied.values().next().value as string | undefined;

  if (!first) {
    return true;
  }

  const visited = new Set<string>([first]);
  const queue = [first];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const neighborKey of getNeighborKeys(current, true)) {
      if (occupied.has(neighborKey) && !visited.has(neighborKey)) {
        visited.add(neighborKey);
        queue.push(neighborKey);
      }
    }
  }

  return visited.size === occupied.size;
};

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(startA, startB) < Math.min(endA, endB);

const smallCellsShareEdge = (left: GridCell, right: GridCell) => {
  if (left.kind !== "small" || right.kind !== "small") {
    return false;
  }

  const touchesVertically =
    (left.x + left.width === right.x || right.x + right.width === left.x) &&
    rangesOverlap(left.y, left.y + left.height, right.y, right.y + right.height);
  const touchesHorizontally =
    (left.y + left.height === right.y || right.y + right.height === left.y) &&
    rangesOverlap(left.x, left.x + left.width, right.x, right.x + right.width);

  return touchesVertically || touchesHorizontally;
};

const smallCellsTouch = (left: GridCell, right: GridCell) => {
  if (left.kind !== "small" || right.kind !== "small") {
    return false;
  }

  const touchesCorner =
    (left.x + left.width === right.x || right.x + right.width === left.x) &&
    (left.y + left.height === right.y || right.y + right.height === left.y);

  return smallCellsShareEdge(left, right) || touchesCorner;
};

const isOverlayInsideLargeCell = (overlay: GridCell, cells: GridCell[]) =>
  overlay.kind === "overlaySmall" &&
  cells.some(
    (cell) =>
      cell.kind === "large" &&
      overlay.x >= cell.x &&
      overlay.y >= cell.y &&
      overlay.x + overlay.width <= cell.x + cell.width &&
      overlay.y + overlay.height <= cell.y + cell.height,
  );

export const validateGeneratedGrid = (grid: GeneratedGrid): ValidationResult => {
  const errors: string[] = [];
  const occupied = new Set<string>();

  if (grid.config.renderWidth !== grid.config.logicalWidth + 1) {
    errors.push("Render width must equal logical width plus 1px.");
  }

  if (grid.config.renderHeight !== grid.config.logicalHeight + 1) {
    errors.push("Render height must equal logical height plus 1px.");
  }

  for (const cell of grid.cells) {
    if (cell.x % BASE_UNIT !== 0 || cell.y % BASE_UNIT !== 0) {
      errors.push(`${cell.id} is not aligned to the base grid.`);
    }

    if (cell.kind === "large" && (cell.x % LARGE_CELL_SIZE !== 0 || cell.y % LARGE_CELL_SIZE !== 0)) {
      errors.push(`${cell.id} must be aligned to the 80px large-cell grid.`);
    }

    if (cell.kind === "overlaySmall" && !isOverlayInsideLargeCell(cell, grid.cells)) {
      errors.push(`${cell.id} overlay must sit fully inside a large cell.`);
    }

    if (cell.width !== SMALL_CELL_SIZE && cell.width !== LARGE_CELL_SIZE) {
      errors.push(`${cell.id} has an invalid width.`);
    }

    if (cell.height !== SMALL_CELL_SIZE && cell.height !== LARGE_CELL_SIZE) {
      errors.push(`${cell.id} has an invalid height.`);
    }

    if (cell.width !== cell.height) {
      errors.push(`${cell.id} must be square.`);
    }

    if (cell.x < 0 || cell.y < 0) {
      errors.push(`${cell.id} starts outside the canvas.`);
    }

    if (cell.x + cell.width > grid.config.logicalWidth || cell.y + cell.height > grid.config.logicalHeight) {
      errors.push(`${cell.id} extends outside the logical canvas.`);
    }

    if (candidateTouchesGap(grid.config.gapMask, cell)) {
      errors.push(`${cell.id} intersects the gap mask.`);
    }

    if (cell.kind !== "overlaySmall") {
      for (const key of getCellFootprint(cell)) {
        if (occupied.has(key)) {
          errors.push(`${cell.id} overlaps another cell.`);
          break;
        }

        occupied.add(key);
      }
    }
  }

  if (!cellsAreConnected(grid.cells)) {
    errors.push("Generated cells must form one connected grid through edges or corners.");
  }

  for (let leftIndex = 0; leftIndex < grid.cells.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < grid.cells.length; rightIndex += 1) {
      const left = grid.cells[leftIndex]!;
      const right = grid.cells[rightIndex]!;

      if (usesMixedCellRules(grid.config.smallCellRatio)) {
        if (smallCellsTouch(left, right)) {
          errors.push("Small cells must not touch each other horizontally, vertically, or diagonally.");
        }

        continue;
      }

      if (smallCellsShareEdge(left, right)) {
        errors.push("Small cells must not share a full edge because they can read as 80x40 or 40x80.");
      }
    }
  }

  const baseCells = grid.cells.filter((cell) => cell.kind !== "overlaySmall");

  const hasLargeCells = baseCells.some((cell) => cell.kind === "large");

  if (hasLargeCells && grid.cells.some((cell) => cell.kind === "small")) {
    for (const cell of baseCells) {
      if (cell.kind !== "small") {
        continue;
      }
      const attachedLarge = findSoleSlotDiagonalLargeForSmall(cell, baseCells);

      if (!attachedLarge) {
        if (baseCells.some((other) => other.kind === "large" && smallSharesSlotEdgeWithLarge(cell, other))) {
          errors.push(`${cell.id} must attach diagonally to its large cell, not on a shared edge.`);
        } else {
          errors.push(`${cell.id} must attach diagonally to exactly one large cell.`);
        }

        continue;
      }

      if (
        attachedLarge.x === 0 ||
        attachedLarge.y === 0 ||
        attachedLarge.x + attachedLarge.width === grid.config.logicalWidth ||
        attachedLarge.y + attachedLarge.height === grid.config.logicalHeight
      ) {
        errors.push(`${cell.id} must not attach to a canvas-edge large cell.`);
      }

      const slotKinds = new Map<string, GridCell["kind"]>();

      for (const baseCell of baseCells) {
        for (const key of getCellFootprint(baseCell)) {
          slotKinds.set(key, baseCell.kind);
        }
      }

      const occupied = new Set(slotKinds.keys());

      if (countLargeExposureSides(attachedLarge, occupied, slotKinds, grid.config) > MAX_LARGE_EXPOSURE_SIDES) {
        errors.push(`${cell.id} must attach only to an exposed large-cell tip.`);
      }

      const row = cell.y / BASE_UNIT;
      const column = cell.x / BASE_UNIT;
      const aboveKey = `${row - 1}:${column}`;
      const belowKey = `${row + 1}:${column}`;

      if (slotKinds.get(aboveKey) === "large" && slotKinds.get(belowKey) === "large") {
        errors.push(`${cell.id} must not interrupt a vertical large-cell column.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const assertValidGeneratedGrid = (grid: GeneratedGrid) => {
  const result = validateGeneratedGrid(grid);

  if (!result.valid) {
    throw new Error(result.errors.join("\n"));
  }
};
