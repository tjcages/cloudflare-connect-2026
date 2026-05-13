import { BASE_UNIT, LARGE_CELL_SIZE, SMALL_CELL_SIZE, type GeneratedGrid, type GridCell } from "./types";
import { candidateTouchesGap } from "./mask";

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

const getSmallDiagonalChainLength = (cells: GridCell[]) => {
  const smallSlots = new Set(
    cells.filter((cell) => cell.kind === "small").map((cell) => `${cell.y / BASE_UNIT}:${cell.x / BASE_UNIT}`),
  );
  let maxChain = 0;

  for (const slot of smallSlots) {
    const visited = new Set<string>([slot]);
    const queue = [slot];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const [row, column] = current.split(":").map(Number);
      const diagonalNeighbors = [
        `${row - 1}:${column - 1}`,
        `${row - 1}:${column + 1}`,
        `${row + 1}:${column - 1}`,
        `${row + 1}:${column + 1}`,
      ];

      for (const neighbor of diagonalNeighbors) {
        if (smallSlots.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    maxChain = Math.max(maxChain, visited.size);
  }

  return maxChain;
};

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
      if (smallCellsShareEdge(grid.cells[leftIndex], grid.cells[rightIndex])) {
        errors.push("Small cells must not share a full edge because they can read as 80x40 or 40x80.");
      }
    }
  }

  if (grid.config.largeCellRatio > 0 && getSmallDiagonalChainLength(grid.cells) > 3) {
    errors.push("Small diagonal chains must not be longer than 3 cells.");
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
