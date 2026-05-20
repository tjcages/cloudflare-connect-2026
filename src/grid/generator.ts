import {
  findSoleSlotDiagonalLargeForSmall,
  isSlotDiagonalTipToLarge,
  smallSharesSlotEdgeWithLarge,
} from "./cellAttachment";
import { getPlaceableSlotCount, normalizeConfig, prefersAllSmallCells, usesMixedCellRules } from "./config";
import { countLargeExposureSides, MAX_LARGE_EXPOSURE_SIDES } from "./largeExposure";
import { candidateTouchesGap } from "./mask";
import { createPrng, shuffleWithPrng, type Prng } from "./prng";
import {
  BASE_UNIT,
  LARGE_CELL_SIZE,
  SMALL_CELL_SIZE,
  type CandidateCell,
  type GeneratedGrid,
  type GridCell,
  type GridConfig,
  type NormalizedGridConfig,
} from "./types";
import { assertValidGeneratedGrid } from "./validate";

const MAX_GROWTH_ATTEMPT_MULTIPLIER = 48;

const footprintKeys = (candidate: CandidateCell): string[] => {
  const keys: string[] = [];
  const startColumn = candidate.x / BASE_UNIT;
  const startRow = candidate.y / BASE_UNIT;
  const columns = candidate.width / BASE_UNIT;
  const rows = candidate.height / BASE_UNIT;

  for (let row = startRow; row < startRow + rows; row += 1) {
    for (let column = startColumn; column < startColumn + columns; column += 1) {
      keys.push(`${row}:${column}`);
    }
  }

  return keys;
};

const collides = (candidate: CandidateCell, occupied: Set<string>) =>
  footprintKeys(candidate).some((key) => occupied.has(key));

const neighborKeys = (key: string, includeDiagonals = false) => {
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

const rebuildOccupied = (cells: GridCell[]) => new Set(cells.flatMap(footprintKeys));

const isFootprintConnected = (cells: GridCell[]) => {
  const occupied = rebuildOccupied(cells);
  const first = occupied.values().next().value as string | undefined;

  if (!first) {
    return true;
  }

  const visited = new Set<string>([first]);
  const queue = [first];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const neighborKey of neighborKeys(current, true)) {
      if (occupied.has(neighborKey) && !visited.has(neighborKey)) {
        visited.add(neighborKey);
        queue.push(neighborKey);
      }
    }
  }

  return visited.size === occupied.size;
};

const touchesOccupied = (candidate: CandidateCell, occupied: Set<string>, includeDiagonals: boolean) => {
  const footprint = new Set(footprintKeys(candidate));

  for (const key of footprint) {
    for (const neighborKey of neighborKeys(key, includeDiagonals)) {
      if (!footprint.has(neighborKey) && occupied.has(neighborKey)) {
        return true;
      }
    }
  }

  return false;
};

const countOrthogonalContacts = (candidate: CandidateCell, occupied: Set<string>) => {
  const footprint = new Set(footprintKeys(candidate));
  const contacts = new Set<string>();

  for (const key of footprint) {
    for (const neighborKey of neighborKeys(key)) {
      if (!footprint.has(neighborKey) && occupied.has(neighborKey)) {
        contacts.add(neighborKey);
      }
    }
  }

  return contacts.size;
};

const countDiagonalContacts = (candidate: CandidateCell, occupied: Set<string>) => {
  const footprint = new Set(footprintKeys(candidate));
  const contacts = new Set<string>();

  for (const key of footprint) {
    const [row, column] = key.split(":").map(Number);
    const diagonalKeys = [
      `${row - 1}:${column - 1}`,
      `${row - 1}:${column + 1}`,
      `${row + 1}:${column - 1}`,
      `${row + 1}:${column + 1}`,
    ];

    for (const diagonalKey of diagonalKeys) {
      if (!footprint.has(diagonalKey) && occupied.has(diagonalKey)) {
        contacts.add(diagonalKey);
      }
    }
  }

  return contacts.size;
};

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(startA, startB) < Math.min(endA, endB);

const isVerticalEdgeConnector = (candidate: CandidateCell, config: NormalizedGridConfig) =>
  candidate.kind === "large" && (candidate.y === 0 || candidate.y + candidate.height === config.logicalHeight);

const getCandidateColumns = (candidate: CandidateCell) => {
  const columns: number[] = [];

  for (let column = candidate.x / BASE_UNIT; column < (candidate.x + candidate.width) / BASE_UNIT; column += 1) {
    columns.push(column);
  }

  return columns;
};

const getBlockedColumnPressure = (candidate: CandidateCell, config: NormalizedGridConfig) => {
  const candidateColumns = new Set(getCandidateColumns(candidate));
  let pressure = 0;

  config.gapMask.forEach((row) => {
    row.forEach((blocked, column) => {
      if (blocked && candidateColumns.has(column)) {
        pressure += 1;
      }
    });
  });

  return Math.min(1, pressure / 4);
};

const verticalEdgeConnectorScore = (candidate: CandidateCell, config: NormalizedGridConfig) => {
  if (candidate.kind !== "large") {
    return 0;
  }

  if (isVerticalEdgeConnector(candidate, config)) {
    const blockedColumnPressure = getBlockedColumnPressure(candidate, config);
    const openRightBias =
      blockedColumnPressure === 0 && candidate.x + candidate.width > config.logicalWidth * 0.62 ? 1.4 : 0;

    return 1.6 + blockedColumnPressure + openRightBias;
  }

  if (candidate.y === BASE_UNIT || candidate.y + candidate.height === config.logicalHeight - BASE_UNIT) {
    return 0.6;
  }

  return 0;
};

const hasLargeEdgeNeighbor = (candidate: CandidateCell, cells: GridCell[]) => {
  if (candidate.kind !== "large") {
    return false;
  }

  return cells.some((cell) => {
    if (cell.kind !== "large") {
      return false;
    }

    const touchesVertically =
      (cell.x + cell.width === candidate.x || candidate.x + candidate.width === cell.x) &&
      rangesOverlap(cell.y, cell.y + cell.height, candidate.y, candidate.y + candidate.height);
    const touchesHorizontally =
      (cell.y + cell.height === candidate.y || candidate.y + candidate.height === cell.y) &&
      rangesOverlap(cell.x, cell.x + cell.width, candidate.x, candidate.x + candidate.width);

    return touchesVertically || touchesHorizontally;
  });
};

const hasSmallEdgeNeighbor = (candidate: CandidateCell, cells: GridCell[]) => {
  if (candidate.kind !== "small") {
    return false;
  }

  return cells.some((cell) => cell.kind === "small" && cellsShareEdge(cell, candidate));
};

/** Mixed layouts: small tips must not touch another small (edge or diagonal). */
const hasAdjacentSmallNeighbor = (candidate: CandidateCell, cells: GridCell[], config: NormalizedGridConfig) => {
  if (candidate.kind !== "small" || !usesMixedCellRules(config.smallCellRatio)) {
    return false;
  }

  return cells.some((cell) => cell.kind === "small" && cellsTouch(cell, candidate));
};

const getSmallDiagonalChainLength = (cells: Array<GridCell | CandidateCell>) => {
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

const shouldCapSmallDiagonalChains = (config: NormalizedGridConfig) => usesMixedCellRules(config.smallCellRatio);

const MAX_SMALL_DIAGONAL_CHAIN = 2;

const wouldViolateSmallIsolation = (candidate: CandidateCell, cells: GridCell[], config: NormalizedGridConfig) =>
  hasAdjacentSmallNeighbor(candidate, cells, config);

const wouldExceedSmallDiagonalChain = (candidate: CandidateCell, cells: GridCell[], config: NormalizedGridConfig) =>
  shouldCapSmallDiagonalChains(config) &&
  candidate.kind === "small" &&
  !wouldViolateSmallIsolation(candidate, cells, config) &&
  getSmallDiagonalChainLength([...cells, candidate]) > MAX_SMALL_DIAGONAL_CHAIN;

const buildSlotKindMap = (cells: GridCell[]) => {
  const slotKinds = new Map<string, GridCell["kind"]>();

  for (const cell of cells) {
    if (cell.kind === "overlaySmall") {
      continue;
    }

    for (const key of footprintKeys(cell)) {
      slotKinds.set(key, cell.kind);
    }
  }

  return slotKinds;
};

const cellsShareEdge = (
  left: Pick<GridCell, "x" | "y" | "width" | "height">,
  right: Pick<GridCell, "x" | "y" | "width" | "height">,
) => {
  const touchesVertically =
    (left.x + left.width === right.x || right.x + right.width === left.x) &&
    rangesOverlap(left.y, left.y + left.height, right.y, right.y + right.height);
  const touchesHorizontally =
    (left.y + left.height === right.y || right.y + right.height === left.y) &&
    rangesOverlap(left.x, left.x + left.width, right.x, right.x + right.width);

  return touchesVertically || touchesHorizontally;
};

const cellsTouch = (
  left: Pick<GridCell, "x" | "y" | "width" | "height">,
  right: Pick<GridCell, "x" | "y" | "width" | "height">,
) => {
  const touchesCorner =
    (left.x + left.width === right.x || right.x + right.width === left.x) &&
    (left.y + left.height === right.y || right.y + right.height === left.y);

  return cellsShareEdge(left, right) || touchesCorner;
};

const isLargeOnCanvasPerimeter = (
  large: Pick<GridCell, "x" | "y" | "width" | "height">,
  config: NormalizedGridConfig,
) =>
  large.x === 0 ||
  large.y === 0 ||
  large.x + large.width === config.logicalWidth ||
  large.y + large.height === config.logicalHeight;

const findAttachedLargeForSmall = (small: CandidateCell, cells: GridCell[]) => {
  const attached = cells.filter((cell) => cell.kind === "large" && cellsTouch(cell, small));

  return attached.length === 1 ? attached[0] : null;
};

const findDiagonalAttachedLargeForSmall = (small: CandidateCell, cells: GridCell[]) =>
  findSoleSlotDiagonalLargeForSmall(small, cells);

const requiresDiagonalLargeTip = (config: NormalizedGridConfig) => usesMixedCellRules(config.smallCellRatio);

const isValidDiagonalLargeTip = (small: CandidateCell, cells: GridCell[], config: NormalizedGridConfig) => {
  if (!requiresDiagonalLargeTip(config) || small.kind !== "small") {
    return true;
  }

  const attachedLarge = findDiagonalAttachedLargeForSmall(small, cells);

  return attachedLarge !== null;
};

const isValidSmallTipPlacement = (
  candidate: CandidateCell,
  occupied: Set<string>,
  cells: GridCell[],
  config: NormalizedGridConfig,
) => {
  if (candidate.kind !== "small" || !usesMixedCellRules(config.smallCellRatio)) {
    return true;
  }

  const attachedLarge = requiresDiagonalLargeTip(config)
    ? findDiagonalAttachedLargeForSmall(candidate, cells)
    : findAttachedLargeForSmall(candidate, cells);

  if (!attachedLarge) {
    return false;
  }

  if (isLargeOnCanvasPerimeter(attachedLarge, config)) {
    return false;
  }

  const slotKinds = buildSlotKindMap(cells);

  return countLargeExposureSides(attachedLarge, occupied, slotKinds, config) <= MAX_LARGE_EXPOSURE_SIDES;
};

const smallTipTargetScore = (
  candidate: CandidateCell,
  occupied: Set<string>,
  cells: GridCell[],
  config: NormalizedGridConfig,
) => {
  if (candidate.kind !== "small") {
    return 0;
  }

  const attachedLarge = findAttachedLargeForSmall(candidate, cells);

  if (!attachedLarge || isLargeOnCanvasPerimeter(attachedLarge, config)) {
    return -6;
  }

  const slotKinds = buildSlotKindMap(cells);
  const occupiedSides = countLargeExposureSides(attachedLarge, occupied, slotKinds, config);

  if (occupiedSides > MAX_LARGE_EXPOSURE_SIDES) {
    return -4;
  }

  const bottomBias = (candidate.y / config.logicalHeight) * 1.2;

  if (occupiedSides === 2) {
    return 5 + bottomBias;
  }

  if (occupiedSides === 1) {
    return 3.5 + bottomBias * 0.5;
  }

  return 0;
};

const countAdjacentLargeCells = (candidate: CandidateCell, cells: GridCell[]) => {
  const seen = new Set<string>();
  let count = 0;

  for (const cell of cells) {
    if (cell.kind !== "large" || seen.has(cell.id)) {
      continue;
    }

    if (cellsTouch(cell, candidate)) {
      seen.add(cell.id);
      count += 1;
    }
  }

  return count;
};

const countDiagonalAdjacentLargeCells = (candidate: CandidateCell, cells: GridCell[]) => {
  const seen = new Set<string>();
  let count = 0;

  for (const cell of cells) {
    if (cell.kind !== "large" || seen.has(cell.id)) {
      continue;
    }

    if (isSlotDiagonalTipToLarge(candidate, cell)) {
      seen.add(cell.id);
      count += 1;
    }
  }

  return count;
};

const wouldPlaceSmallWithWrongLargeCount = (
  candidate: CandidateCell,
  cells: GridCell[],
  config: NormalizedGridConfig,
) => {
  if (!requiresDiagonalLargeTip(config) || candidate.kind !== "small" || cells.length === 0) {
    return false;
  }

  return countDiagonalAdjacentLargeCells(candidate, cells) !== 1;
};

const wouldAddSecondLargeNeighborToSmall = (candidate: CandidateCell, cells: GridCell[]) => {
  if (candidate.kind !== "large") {
    return false;
  }

  const hypothetical = [...cells, { ...candidate, id: "hypothetical-large" } as GridCell];

  return cells.some((cell) => cell.kind === "small" && countAdjacentLargeCells(cell, hypothetical) > 1);
};

const touchesLargeOccupied = (candidate: CandidateCell, occupied: Set<string>, cells: GridCell[]) => {
  const slotKinds = buildSlotKindMap(cells);

  for (const key of footprintKeys(candidate)) {
    for (const neighborKey of neighborKeys(key, true)) {
      if (occupied.has(neighborKey) && slotKinds.get(neighborKey) === "large") {
        return true;
      }
    }
  }

  return false;
};

const wouldGrowFromSmallOnly = (
  candidate: CandidateCell,
  occupied: Set<string>,
  cells: GridCell[],
  config: NormalizedGridConfig,
  isSeedPlacement: boolean,
) => {
  if (isSeedPlacement || cells.length === 0 || prefersAllSmallCells(config.smallCellRatio)) {
    return false;
  }

  return !touchesLargeOccupied(candidate, occupied, cells);
};

const countLargeNeighborsOfSlot = (slotKey: string, cells: GridCell[]) => {
  const [row, column] = slotKey.split(":").map(Number);
  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  const seen = new Set<string>();
  let count = 0;

  for (const cell of cells) {
    if (cell.kind !== "large") {
      continue;
    }

    const startRow = cell.y / BASE_UNIT;
    const startCol = cell.x / BASE_UNIT;
    const endRow = startRow + cell.height / BASE_UNIT;
    const endCol = startCol + cell.width / BASE_UNIT;

    for (const [dr, dc] of offsets) {
      const nr = row + dr;
      const nc = column + dc;

      if (nr >= startRow && nr < endRow && nc >= startCol && nc < endCol && !seen.has(cell.id)) {
        seen.add(cell.id);
        count += 1;
      }
    }
  }

  return count;
};

const wouldContinueAfterSmall = (candidate: CandidateCell, occupied: Set<string>, cells: GridCell[]) => {
  if (candidate.kind !== "large" || cells.length === 0) {
    return false;
  }

  if (touchesLargeOccupied(candidate, occupied, cells)) {
    return false;
  }

  const slotKinds = buildSlotKindMap(cells);

  for (const key of footprintKeys(candidate)) {
    for (const neighborKey of neighborKeys(key, true)) {
      if (!occupied.has(neighborKey) || slotKinds.get(neighborKey) !== "small") {
        continue;
      }

      if (countLargeNeighborsOfSlot(neighborKey, cells) >= 1) {
        return true;
      }
    }
  }

  return false;
};

type PickCandidateOptions = {
  highDensity?: boolean;
  allowDenseContacts?: boolean;
  isSeedPlacement?: boolean;
  /** Skips rejecting perimeter smalls when a large could cover the same slot (replacement tips). */
  allowPerimeterSmallTips?: boolean;
  /** Skips exposed-large tip checks; replacement picks sites on the removed large exterior. */
  skipSmallTipPlacementCheck?: boolean;
  /** Skips the decorative diagonal small-chain cap (replacement pass). */
  skipDiagonalChainCap?: boolean;
  /** Allows large fills in post-replacement void healing near existing smalls. */
  allowVoidLargeFill?: boolean;
};

const isOnCanvasPerimeter = (candidate: CandidateCell, config: NormalizedGridConfig) =>
  candidate.x === 0 ||
  candidate.y === 0 ||
  candidate.x + candidate.width === config.logicalWidth ||
  candidate.y + candidate.height === config.logicalHeight;

const largeCandidateCoversCell = (large: CandidateCell, row: number, column: number) => {
  const startRow = large.y / BASE_UNIT;
  const startColumn = large.x / BASE_UNIT;
  const endRow = startRow + large.height / BASE_UNIT;
  const endColumn = startColumn + large.width / BASE_UNIT;

  return row >= startRow && row < endRow && column >= startColumn && column < endColumn;
};

const wouldPlaceSmallOnPerimeterWhenLargeFits = (
  candidate: CandidateCell,
  config: NormalizedGridConfig,
  occupied: Set<string>,
  cells: GridCell[],
  largeCandidates: CandidateCell[],
  options: PickCandidateOptions,
) => {
  if (
    prefersAllSmallCells(config.smallCellRatio) ||
    candidate.kind !== "small" ||
    !isOnCanvasPerimeter(candidate, config)
  ) {
    return false;
  }

  const row = candidate.y / BASE_UNIT;
  const column = candidate.x / BASE_UNIT;

  return largeCandidates.some((large) => {
    if (!largeCandidateCoversCell(large, row, column) || collides(large, occupied)) {
      return false;
    }

    if (cells.length > 0 && !touchesOccupied(large, occupied, true)) {
      return false;
    }

    return passesHierarchyRules(large, occupied, cells, config, options);
  });
};

const wouldInterruptLargeColumn = (candidate: CandidateCell, occupied: Set<string>, cells: GridCell[]) => {
  if (candidate.kind !== "small") {
    return false;
  }

  const row = candidate.y / BASE_UNIT;
  const column = candidate.x / BASE_UNIT;
  const slotKinds = buildSlotKindMap(cells);
  const aboveKey = `${row - 1}:${column}`;
  const belowKey = `${row + 1}:${column}`;

  return (
    occupied.has(aboveKey) &&
    occupied.has(belowKey) &&
    slotKinds.get(aboveKey) === "large" &&
    slotKinds.get(belowKey) === "large"
  );
};

const getEmptyPlaceableSlots = (config: NormalizedGridConfig, occupied: Set<string>) => {
  const slots: Array<{ row: number; column: number; gapPressure: number; occupiedNeighbors: number }> = [];

  for (let row = 0; row < config.rows; row += 1) {
    for (let column = 0; column < config.columns; column += 1) {
      const key = `${row}:${column}`;

      if (config.gapMask[row]?.[column] || occupied.has(key)) {
        continue;
      }

      let gapPressure = 0;
      let occupiedNeighbors = 0;

      for (const neighborKey of neighborKeys(key, true)) {
        const [neighborRow, neighborColumn] = neighborKey.split(":").map(Number);

        if (config.gapMask[neighborRow]?.[neighborColumn]) {
          gapPressure += 1;
        }

        if (occupied.has(neighborKey)) {
          occupiedNeighbors += 1;
        }
      }

      slots.push({ row, column, gapPressure, occupiedNeighbors });
    }
  }

  return slots.sort((left, right) => {
    if (right.gapPressure !== left.gapPressure) {
      return right.gapPressure - left.gapPressure;
    }

    return right.occupiedNeighbors - left.occupiedNeighbors;
  });
};

const countLargeOccupiedSlots = (cells: GridCell[]) =>
  cells
    .filter((cell) => cell.kind === "large")
    .reduce((total, cell) => total + (cell.width / BASE_UNIT) * (cell.height / BASE_UNIT), 0);

const canPlaceLargeCandidate = (
  large: CandidateCell,
  config: NormalizedGridConfig,
  occupied: Set<string>,
  cells: GridCell[],
  options: PickCandidateOptions,
  largeCandidates: CandidateCell[],
) => {
  if (collides(large, occupied)) {
    return false;
  }

  if (cells.length > 0 && !touchesOccupied(large, occupied, true)) {
    return false;
  }

  if (hasSmallEdgeNeighbor(large, cells)) {
    return false;
  }

  if (options.allowVoidLargeFill && cells.some((cell) => cell.kind === "small" && cellsShareEdge(cell, large))) {
    return false;
  }

  return passesHierarchyRules(large, occupied, cells, config, options, largeCandidates);
};

const fillEmptyLargeFootprints = (
  config: NormalizedGridConfig,
  occupied: Set<string>,
  cells: GridCell[],
  largeCandidates: CandidateCell[],
  prng: Prng,
  options: PickCandidateOptions,
) => {
  let progress = true;
  let guard = 0;
  const maxGuard = config.columns * config.rows;

  const centerColumn = (config.columns - 1) / 2;
  const holes: Array<{ row: number; column: number }> = [];

  for (let row = 0; row < config.rows - 1; row += 2) {
    for (let column = 0; column < config.columns - 1; column += 2) {
      const keys = [`${row}:${column}`, `${row}:${column + 1}`, `${row + 1}:${column}`, `${row + 1}:${column + 1}`];

      if (
        keys.some((key) => {
          const [slotRow, slotColumn] = key.split(":").map(Number);

          return config.gapMask[slotRow]?.[slotColumn] || occupied.has(key);
        })
      ) {
        continue;
      }

      const touchingOccupied = keys.some((key) =>
        neighborKeys(key, true).some((neighborKey) => occupied.has(neighborKey)),
      );

      if (touchingOccupied) {
        holes.push({ row, column });
      }
    }
  }

  holes.sort((left, right) => {
    if (right.row !== left.row) {
      return right.row - left.row;
    }

    const leftCenterDistance = Math.abs(left.column + 1 - centerColumn);
    const rightCenterDistance = Math.abs(right.column + 1 - centerColumn);

    return leftCenterDistance - rightCenterDistance;
  });

  while (progress && guard < maxGuard) {
    guard += 1;
    progress = false;

    for (const hole of holes) {
      const keys = [
        `${hole.row}:${hole.column}`,
        `${hole.row}:${hole.column + 1}`,
        `${hole.row + 1}:${hole.column}`,
        `${hole.row + 1}:${hole.column + 1}`,
      ];

      if (keys.some((key) => occupied.has(key))) {
        continue;
      }

      const holeKeys = new Set(keys);
      const fittingLarges = shuffleWithPrng(
        largeCandidates.filter((large) => footprintKeys(large).every((key) => holeKeys.has(key))),
        prng,
      );

      for (const candidate of fittingLarges) {
        if (canPlaceLargeCandidate(candidate, config, occupied, cells, options, largeCandidates)) {
          commitCandidate(candidate, occupied, cells, cells.length);
          progress = true;
          break;
        }
      }

      if (progress) {
        break;
      }
    }
  }
};

const fillResidualPlaceableSlots = (
  config: NormalizedGridConfig,
  occupied: Set<string>,
  cells: GridCell[],
  largeCandidates: CandidateCell[],
  prng: Prng,
  targetLargeSlots: number,
  options: PickCandidateOptions,
) => {
  const fillOptions: PickCandidateOptions = { ...options, highDensity: true, allowDenseContacts: true };
  let guard = 0;
  const maxGuard = config.columns * config.rows * 6;

  while (countLargeOccupiedSlots(cells) < targetLargeSlots && guard < maxGuard) {
    guard += 1;
    const emptySlots = getEmptyPlaceableSlots(config, occupied);

    if (emptySlots.length === 0) {
      break;
    }

    let placed = false;

    for (const slot of emptySlots) {
      const coveringLarges = shuffleWithPrng(
        largeCandidates.filter((large) => largeCandidateCoversCell(large, slot.row, slot.column)),
        prng,
      );

      for (const large of coveringLarges) {
        if (!canPlaceLargeCandidate(large, config, occupied, cells, fillOptions, largeCandidates)) {
          continue;
        }

        commitCandidate(large, occupied, cells, cells.length);
        placed = true;
        break;
      }

      if (placed) {
        break;
      }
    }

    if (!placed) {
      break;
    }
  }
};

const fillToTargetOccupancy = (
  config: NormalizedGridConfig,
  occupied: Set<string>,
  cells: GridCell[],
  largeCandidates: CandidateCell[],
  prng: Prng,
  targetOccupied: number,
  options: PickCandidateOptions,
) => {
  const fillOptions: PickCandidateOptions = { ...options, highDensity: true, allowDenseContacts: true };
  let guard = 0;
  const maxGuard = config.columns * config.rows * 8;

  while (occupied.size < targetOccupied && guard < maxGuard) {
    guard += 1;
    const emptySlots = getEmptyPlaceableSlots(config, occupied);

    if (emptySlots.length === 0) {
      break;
    }

    let placed = false;

    for (const slot of emptySlots) {
      const coveringLarges = shuffleWithPrng(
        largeCandidates.filter((large) => largeCandidateCoversCell(large, slot.row, slot.column)),
        prng,
      );

      for (const large of coveringLarges) {
        if (!canPlaceLargeCandidate(large, config, occupied, cells, fillOptions, largeCandidates)) {
          continue;
        }

        commitCandidate(large, occupied, cells, cells.length);
        placed = true;
        break;
      }

      if (placed) {
        break;
      }
    }

    if (!placed) {
      break;
    }
  }
};

const removeCellFromGrid = (cellId: string, occupied: Set<string>, cells: GridCell[]) => {
  const index = cells.findIndex((cell) => cell.id === cellId);

  if (index < 0) {
    return;
  }

  const cell = cells[index]!;

  for (const key of footprintKeys(cell)) {
    occupied.delete(key);
  }

  cells.splice(index, 1);
};

const buildDiagonalCornerExteriorCandidatesForLarge = (
  large: GridCell,
  config: NormalizedGridConfig,
  occupied: Set<string>,
): CandidateCell[] => {
  const startRow = large.y / BASE_UNIT;
  const startColumn = large.x / BASE_UNIT;
  const endRow = startRow + large.height / BASE_UNIT;
  const endColumn = startColumn + large.width / BASE_UNIT;
  const cornerSlots: Array<[number, number]> = [];

  if (startRow > 0 && startColumn > 0) {
    cornerSlots.push([startRow - 1, startColumn - 1]);
  }

  if (startRow > 0 && endColumn < config.columns) {
    cornerSlots.push([startRow - 1, endColumn]);
  }

  if (endRow < config.rows && startColumn > 0) {
    cornerSlots.push([endRow, startColumn - 1]);
  }

  if (endRow < config.rows && endColumn < config.columns) {
    cornerSlots.push([endRow, endColumn]);
  }

  const candidates: CandidateCell[] = [];

  for (const [row, column] of cornerSlots) {
    const key = `${row}:${column}`;

    if (config.gapMask[row]?.[column] || occupied.has(key)) {
      continue;
    }

    candidates.push({
      kind: "small",
      x: column * BASE_UNIT,
      y: row * BASE_UNIT,
      width: SMALL_CELL_SIZE,
      height: SMALL_CELL_SIZE,
    });
  }

  return candidates;
};

const buildInteriorCornerShrinkCandidatesForLarge = (large: GridCell): CandidateCell[] => [
  {
    kind: "small",
    x: large.x,
    y: large.y,
    width: SMALL_CELL_SIZE,
    height: SMALL_CELL_SIZE,
  },
  {
    kind: "small",
    x: large.x + BASE_UNIT,
    y: large.y,
    width: SMALL_CELL_SIZE,
    height: SMALL_CELL_SIZE,
  },
  {
    kind: "small",
    x: large.x,
    y: large.y + BASE_UNIT,
    width: SMALL_CELL_SIZE,
    height: SMALL_CELL_SIZE,
  },
  {
    kind: "small",
    x: large.x + BASE_UNIT,
    y: large.y + BASE_UNIT,
    width: SMALL_CELL_SIZE,
    height: SMALL_CELL_SIZE,
  },
];

const passesReplacementSmallValidate = (small: CandidateCell, cells: GridCell[], config: NormalizedGridConfig) => {
  const attachedLarge = findDiagonalAttachedLargeForSmall(small, cells);

  if (!attachedLarge) {
    return false;
  }

  if (isLargeOnCanvasPerimeter(attachedLarge, config)) {
    return false;
  }

  const slotKinds = buildSlotKindMap(cells);
  const occupied = new Set(slotKinds.keys());

  return countLargeExposureSides(attachedLarge, occupied, slotKinds, config) <= MAX_LARGE_EXPOSURE_SIDES;
};

const MAX_REPLACEMENT_EDGE_BLOCKERS = 2;

const buildEdgeBlockersForReplacementSite = (site: CandidateCell, large: GridCell, cells: GridCell[]) =>
  cells.filter((cell) => cell.kind === "large" && cell.id !== large.id && smallSharesSlotEdgeWithLarge(site, cell));

const buildReplacementRemovalState = (
  large: GridCell,
  site: CandidateCell,
  cells: GridCell[],
  occupied: Set<string>,
  removeEdgeBlockers: boolean,
) => {
  const edgeBlockers = buildEdgeBlockersForReplacementSite(site, large, cells);
  const extraRemoveIds =
    removeEdgeBlockers && edgeBlockers.length > 0 && edgeBlockers.length <= MAX_REPLACEMENT_EDGE_BLOCKERS
      ? edgeBlockers.map((cell) => cell.id)
      : [];
  const removeIds = new Set([large.id, ...extraRemoveIds]);
  const cellsAfter = cells.filter((cell) => !removeIds.has(cell.id));
  const occupiedAfter = rebuildOccupied(cellsAfter);

  return { cellsAfter, occupiedAfter, edgeBlockers, extraRemoveIds };
};

const hasReplacementDiagonalAnchor = (site: CandidateCell, large: GridCell, cells: GridCell[]) => {
  const cellsWithoutLarge = cells.filter((cell) => cell.id !== large.id);

  if (findDiagonalAttachedLargeForSmall(site, cellsWithoutLarge) !== null) {
    return true;
  }

  const edgeBlockers = buildEdgeBlockersForReplacementSite(site, large, cells);

  if (edgeBlockers.length === 0 || edgeBlockers.length > MAX_REPLACEMENT_EDGE_BLOCKERS) {
    return false;
  }

  const cellsAfterBlockers = cellsWithoutLarge.filter(
    (cell) => !edgeBlockers.some((blocker) => blocker.id === cell.id),
  );

  return findDiagonalAttachedLargeForSmall(site, cellsAfterBlockers) !== null;
};

const buildReplacementSmallCandidatesForLarge = (
  large: GridCell,
  config: NormalizedGridConfig,
  occupied: Set<string>,
  cells: GridCell[],
) => {
  const occupiedWithoutLarge = new Set(occupied);

  for (const key of footprintKeys(large)) {
    occupiedWithoutLarge.delete(key);
  }

  const seen = new Set<string>();
  const candidates: CandidateCell[] = [];

  for (const site of [
    ...buildInteriorCornerShrinkCandidatesForLarge(large),
    ...buildDiagonalCornerExteriorCandidatesForLarge(large, config, occupiedWithoutLarge),
  ]) {
    const key = footprintKeys(site).join("|");

    if (seen.has(key) || collides(site, occupiedWithoutLarge)) {
      continue;
    }

    if (!hasReplacementDiagonalAnchor(site, large, cells)) {
      continue;
    }

    seen.add(key);
    candidates.push(site);
  }

  return candidates;
};

const pickWeightedByScore = <T>(
  entries: Array<{ value: T; score: number }>,
  prng: Prng,
  options: { topPool?: number; temperature?: number } = {},
): T | null => {
  if (entries.length === 0) {
    return null;
  }

  const topPool = options.topPool ?? 6;
  const temperature = options.temperature ?? 1.35;
  const pool = [...entries].sort((left, right) => right.score - left.score).slice(0, Math.min(topPool, entries.length));
  const maxScore = pool[0]!.score;
  let roll = prng.next();
  let totalWeight = 0;
  const weights = pool.map((entry) => {
    const weight = Math.exp((entry.score - maxScore) / temperature) + 0.2;

    totalWeight += weight;

    return { value: entry.value, weight };
  });

  roll *= totalWeight;

  for (const entry of weights) {
    roll -= entry.weight;

    if (roll <= 0) {
      return entry.value;
    }
  }

  return weights[weights.length - 1]!.value;
};

const replacementSmallScore = (
  candidate: CandidateCell,
  occupied: Set<string>,
  cells: GridCell[],
  config: NormalizedGridConfig,
  prng: Prng,
) => {
  const attachedLarge = findDiagonalAttachedLargeForSmall(candidate, cells);

  if (candidate.kind !== "small" || !attachedLarge) {
    return -8;
  }

  const contacts = countOrthogonalContacts(candidate, occupied);

  if (contacts >= 3) {
    return -6;
  }

  const spatialJitter = prng.next() * 0.9;
  const bottomBias = (candidate.y / config.logicalHeight) * 2.5;

  return 6 + bottomBias + spatialJitter + (contacts === 1 ? 1 : 0);
};

const largeReplacementScore = (large: GridCell, contactSides: number, config: NormalizedGridConfig, prng: Prng) => {
  const bottomBias = (large.y / config.logicalHeight) * 8;
  const centerColumn = (config.columns - 1) / 2;
  const largeCenterColumn = large.x / BASE_UNIT + large.width / BASE_UNIT / 2;
  const bottomCenterBias =
    large.y >= config.logicalHeight * 0.5 ? Math.max(0, 3 - Math.abs(largeCenterColumn - centerColumn)) * 2 : 0;
  const exposureBonus = Math.max(0, MAX_LARGE_EXPOSURE_SIDES + 1 - contactSides) * 6;

  return exposureBonus + bottomBias + bottomCenterBias + prng.next() * 0.5;
};

type ReplacementPick = {
  site: CandidateCell;
  extraRemoveIds: string[];
};

const pickBestReplacementSmall = (
  large: GridCell,
  sites: CandidateCell[],
  config: NormalizedGridConfig,
  occupied: Set<string>,
  cells: GridCell[],
  prng: Prng,
  options: PickCandidateOptions,
): ReplacementPick | null => {
  const viable: Array<{ value: ReplacementPick; score: number }> = [];

  for (const site of shuffleWithPrng(sites, prng)) {
    for (const removeEdgeBlockers of [false, true]) {
      const { cellsAfter, occupiedAfter, edgeBlockers, extraRemoveIds } = buildReplacementRemovalState(
        large,
        site,
        cells,
        occupied,
        removeEdgeBlockers,
      );

      if (collides(site, occupiedAfter)) {
        continue;
      }

      if (!touchesOccupied(site, occupiedAfter, true)) {
        continue;
      }

      if (hasAdjacentSmallNeighbor(site, cellsAfter, config)) {
        continue;
      }

      if (!passesHierarchyRules(site, occupiedAfter, cellsAfter, config, options)) {
        continue;
      }

      if (!passesReplacementSmallValidate(site, cellsAfter, config)) {
        continue;
      }

      const cellsWithSmall: GridCell[] = [...cellsAfter, { ...site, id: "replacement-small" } as GridCell];

      if (!isFootprintConnected(cellsWithSmall)) {
        continue;
      }

      const score = replacementSmallScore(site, occupiedAfter, cellsAfter, config, prng);

      if (score < 0) {
        continue;
      }

      if (!isValidDiagonalLargeTip(site, cellsAfter, config)) {
        continue;
      }

      if (removeEdgeBlockers && edgeBlockers.length === 0) {
        continue;
      }

      const blockerPenalty = extraRemoveIds.length * 5;

      viable.push({
        value: { site, extraRemoveIds },
        score: score - blockerPenalty,
      });

      if (!removeEdgeBlockers) {
        break;
      }
    }
  }

  const picked = pickWeightedByScore(viable, prng, {
    topPool: 6,
    temperature: 0.85,
  });

  return picked ?? null;
};

const isSoleLargeAnchorForSmall = (large: GridCell, cells: GridCell[]) =>
  cells.some(
    (cell) =>
      cell.kind === "small" &&
      isSlotDiagonalTipToLarge(cell, large) &&
      countDiagonalAdjacentLargeCells(cell, cells) === 1,
  );

const replaceLargeCellsWithSmalls = (
  config: NormalizedGridConfig,
  occupied: Set<string>,
  cells: GridCell[],
  prng: Prng,
  replaceCount: number,
) => {
  if (prefersAllSmallCells(config.smallCellRatio) || config.smallCellRatio === 0 || replaceCount <= 0) {
    return;
  }

  const replacementOptions: PickCandidateOptions = {
    highDensity: true,
    allowDenseContacts: true,
    allowPerimeterSmallTips: true,
    skipSmallTipPlacementCheck: true,
    skipDiagonalChainCap: true,
  };

  let remaining = replaceCount;

  const rankReplaceableLargesForState = (stateCells: GridCell[], stateOccupied: Set<string>) => {
    const slotKinds = buildSlotKindMap(stateCells);

    return shuffleWithPrng(
      stateCells.filter((cell) => cell.kind === "large" && !isSoleLargeAnchorForSmall(cell, stateCells)),
      prng,
    )
      .map((large) => {
        const contactSides = countLargeExposureSides(large, stateOccupied, slotKinds, config);
        const sites = buildReplacementSmallCandidatesForLarge(large, config, stateOccupied, stateCells);
        const pick = pickBestReplacementSmall(
          large,
          sites,
          config,
          stateOccupied,
          stateCells,
          prng,
          replacementOptions,
        );

        return {
          large,
          pick,
          score: pick ? largeReplacementScore(large, contactSides, config, prng) : -1,
          contactSides,
        };
      })
      .filter((entry) => entry.pick !== null);
  };

  const rankReplaceableLarges = () => rankReplaceableLargesForState(cells, occupied);

  type ReplaceableLarge = {
    large: GridCell;
    pick: ReplacementPick | null;
    score: number;
    contactSides: number;
  };

  const pickReplacementPool = (ranked: ReplaceableLarge[]) => {
    if (ranked.length === 0) {
      return [];
    }

    const chairPool = ranked.filter((entry) => entry.contactSides <= MAX_LARGE_EXPOSURE_SIDES);

    if (chairPool.length > 0) {
      return chairPool;
    }

    const threeSidePool = ranked.filter((entry) => entry.contactSides === 3);

    if (threeSidePool.length > 0) {
      return threeSidePool;
    }

    return ranked;
  };

  while (remaining > 0) {
    const ranked = rankReplaceableLarges();
    const pool = pickReplacementPool(ranked);

    if (pool.length === 0) {
      break;
    }

    const picked = pickWeightedByScore(
      pool.map((entry) => ({ value: entry, score: entry.score })),
      prng,
      { topPool: 8, temperature: 0.9 },
    );

    if (!picked?.pick) {
      break;
    }

    const { large, pick } = picked;

    removeCellFromGrid(large.id, occupied, cells);

    for (const blockerId of pick.extraRemoveIds) {
      removeCellFromGrid(blockerId, occupied, cells);
    }

    commitCandidate(pick.site, occupied, cells, cells.length);
    remaining -= 1;
  }
};

const passesHierarchyRules = (
  candidate: CandidateCell,
  occupied: Set<string>,
  cells: GridCell[],
  config: NormalizedGridConfig,
  options: PickCandidateOptions,
  largeCandidates: CandidateCell[] = [],
) => {
  if (wouldViolateSmallIsolation(candidate, cells, config)) {
    return false;
  }

  if (!isValidDiagonalLargeTip(candidate, cells, config)) {
    return false;
  }

  if (!options.skipDiagonalChainCap && wouldExceedSmallDiagonalChain(candidate, cells, config)) {
    return false;
  }

  if (wouldGrowFromSmallOnly(candidate, occupied, cells, config, options.isSeedPlacement ?? false)) {
    return false;
  }

  if (wouldPlaceSmallWithWrongLargeCount(candidate, cells, config)) {
    return false;
  }

  if (
    !options.allowVoidLargeFill &&
    usesMixedCellRules(config.smallCellRatio) &&
    wouldAddSecondLargeNeighborToSmall(candidate, cells)
  ) {
    return false;
  }

  if (wouldContinueAfterSmall(candidate, occupied, cells)) {
    return false;
  }

  if (wouldInterruptLargeColumn(candidate, occupied, cells)) {
    return false;
  }

  if (
    !options.allowPerimeterSmallTips &&
    wouldPlaceSmallOnPerimeterWhenLargeFits(candidate, config, occupied, cells, largeCandidates, options)
  ) {
    return false;
  }

  if (
    candidate.kind === "small" &&
    !options.skipSmallTipPlacementCheck &&
    !isValidSmallTipPlacement(candidate, occupied, cells, config)
  ) {
    return false;
  }

  return true;
};

const commitCandidate = (candidate: CandidateCell, occupied: Set<string>, cells: GridCell[], index: number) => {
  for (const key of footprintKeys(candidate)) {
    occupied.add(key);
  }

  cells.push({
    ...candidate,
    id: `${candidate.kind}-${index}-${candidate.x}-${candidate.y}`,
  });
};

const buildCandidates = (
  config: NormalizedGridConfig,
  size: typeof SMALL_CELL_SIZE | typeof LARGE_CELL_SIZE,
): CandidateCell[] => {
  const kind = size === SMALL_CELL_SIZE ? "small" : "large";
  const candidates: CandidateCell[] = [];
  const step = size === LARGE_CELL_SIZE ? LARGE_CELL_SIZE : BASE_UNIT;

  for (let y = 0; y <= config.logicalHeight - size; y += step) {
    for (let x = 0; x <= config.logicalWidth - size; x += step) {
      const candidate = {
        kind,
        x,
        y,
        width: size,
        height: size,
      } satisfies CandidateCell;

      if (!candidateTouchesGap(config.gapMask, candidate)) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
};

const startCandidateScore = (candidate: CandidateCell, config: NormalizedGridConfig, prng: Prng) => {
  const centerX = candidate.x + candidate.width / 2;
  const centerY = candidate.y + candidate.height / 2;
  const normalizedX = centerX / config.logicalWidth;
  const normalizedY = centerY / config.logicalHeight;
  const distanceFromCenter = Math.hypot(normalizedX - 0.5, normalizedY - 0.5);

  return prng.next() - distanceFromCenter * 0.35 + verticalEdgeConnectorScore(candidate, config);
};

const prioritizeCandidates = (candidates: CandidateCell[], config: NormalizedGridConfig, prng: Prng) =>
  shuffleWithPrng(candidates, prng).sort(
    (left, right) => startCandidateScore(right, config, prng) - startCandidateScore(left, config, prng),
  );

const pickValidCandidate = (
  candidates: CandidateCell[],
  config: NormalizedGridConfig,
  occupied: Set<string>,
  cells: GridCell[],
  prng: Prng,
  requireConnection: boolean,
  options: PickCandidateOptions = {},
  largeCandidatesForRules: CandidateCell[] = [],
) => {
  const highDensity = options.highDensity ?? config.density >= 0.85;
  const allowDenseContacts = options.allowDenseContacts ?? false;
  const bounds = getCellBounds(cells);
  const coverage = getCoverageState(cells, config);
  const shuffled = shuffleWithPrng(candidates, prng)
    .map((candidate) => ({
      candidate,
      score:
        verticalEdgeConnectorScore(candidate, config) +
        growthCoverageScore(candidate, bounds) +
        quadrantCoverageScore(candidate, coverage, config) +
        gapPerimeterScore(candidate, config) +
        smallTipTargetScore(candidate, occupied, cells, config) +
        (candidate.kind === "large" && highDensity && isOnCanvasPerimeter(candidate, config) ? 1.1 : 0) +
        prng.next() * 0.2,
    }))
    .sort((left, right) => right.score - left.score)
    .map(({ candidate }) => candidate);

  for (const candidate of shuffled) {
    if (collides(candidate, occupied)) {
      continue;
    }

    if (requireConnection && !touchesOccupied(candidate, occupied, true)) {
      continue;
    }

    if (hasSmallEdgeNeighbor(candidate, cells)) {
      continue;
    }

    if (hasAdjacentSmallNeighbor(candidate, cells, config)) {
      continue;
    }

    if (!passesHierarchyRules(candidate, occupied, cells, config, options, largeCandidatesForRules)) {
      continue;
    }

    const orthogonalContacts = countOrthogonalContacts(candidate, occupied);
    const diagonalContacts = countDiagonalContacts(candidate, occupied);

    if (!allowDenseContacts && orthogonalContacts >= 4) {
      continue;
    }

    if (candidate.kind === "small" && orthogonalContacts >= 3) {
      continue;
    }

    if (!highDensity) {
      if (candidate.kind === "large" && orthogonalContacts >= 3 && prng.chance(0.55)) {
        continue;
      }

      if (candidate.kind === "small" && orthogonalContacts >= 3 && prng.chance(0.86)) {
        continue;
      }

      if (candidate.kind === "large" && hasLargeEdgeNeighbor(candidate, cells) && prng.chance(0.55)) {
        continue;
      }

      if (orthogonalContacts === 0 && diagonalContacts > 0 && prng.chance(0.82)) {
        return candidate;
      }

      if (orthogonalContacts === 0 && prng.chance(0.42)) {
        return candidate;
      }

      if (orthogonalContacts === 1 && prng.chance(0.48)) {
        return candidate;
      }

      if (orthogonalContacts === 2 && prng.chance(0.22)) {
        return candidate;
      }

      continue;
    }

    if (orthogonalContacts <= 4) {
      return candidate;
    }
  }

  for (const candidate of shuffled) {
    if (collides(candidate, occupied)) {
      continue;
    }

    if (requireConnection && !touchesOccupied(candidate, occupied, true)) {
      continue;
    }

    if (hasSmallEdgeNeighbor(candidate, cells)) {
      continue;
    }

    if (hasAdjacentSmallNeighbor(candidate, cells, config)) {
      continue;
    }

    if (!passesHierarchyRules(candidate, occupied, cells, config, options, largeCandidatesForRules)) {
      continue;
    }

    return candidate;
  }

  return null;
};

const getCandidateSlots = (candidate: CandidateCell) => (candidate.width / BASE_UNIT) * (candidate.height / BASE_UNIT);

const getCellBounds = (cells: GridCell[]) => {
  if (cells.length === 0) {
    return null;
  }

  return {
    minX: Math.min(...cells.map((cell) => cell.x)),
    minY: Math.min(...cells.map((cell) => cell.y)),
    maxX: Math.max(...cells.map((cell) => cell.x + cell.width)),
    maxY: Math.max(...cells.map((cell) => cell.y + cell.height)),
  };
};

const growthCoverageScore = (candidate: CandidateCell, bounds: ReturnType<typeof getCellBounds>) => {
  if (!bounds) {
    return 0;
  }

  let score = 0;

  if (candidate.x < bounds.minX) {
    score += 0.55;
  }

  if (candidate.y < bounds.minY) {
    score += 0.55;
  }

  if (candidate.x + candidate.width > bounds.maxX) {
    score += 0.7;
  }

  if (candidate.y + candidate.height > bounds.maxY) {
    score += 0.45;
  }

  return score;
};

const getCoverageState = (cells: GridCell[], config: NormalizedGridConfig) => {
  const midpointX = config.logicalWidth / 2;
  const midpointY = config.logicalHeight / 2;

  return {
    hasTopRight: cells.some((cell) => cell.x + cell.width > midpointX && cell.y < midpointY),
    hasTopLeft: cells.some((cell) => cell.x < midpointX && cell.y < midpointY),
    hasRight: cells.some((cell) => cell.x + cell.width > config.logicalWidth * 0.72),
    hasTop: cells.some((cell) => cell.y < config.logicalHeight * 0.28),
  };
};

const quadrantCoverageScore = (
  candidate: CandidateCell,
  coverage: ReturnType<typeof getCoverageState>,
  config: NormalizedGridConfig,
) => {
  let score = 0;
  const candidateRight = candidate.x + candidate.width;
  const candidateBottom = candidate.y + candidate.height;

  if (!coverage.hasTopRight && candidateRight > config.logicalWidth / 2 && candidate.y < config.logicalHeight / 2) {
    score += 2.6;
  }

  if (!coverage.hasTopLeft && candidate.x < config.logicalWidth / 2 && candidate.y < config.logicalHeight / 2) {
    score += 0.65;
  }

  if (!coverage.hasRight && candidateRight > config.logicalWidth * 0.72) {
    score += 1.4;
  }

  if (!coverage.hasTop && candidateBottom < config.logicalHeight * 0.34) {
    score += 0.55;
  }

  return score;
};

const gapPerimeterScore = (candidate: CandidateCell, config: NormalizedGridConfig) => {
  const footprint = new Set(footprintKeys(candidate));
  let adjacentGapSlots = 0;

  for (const key of footprint) {
    for (const neighborKey of neighborKeys(key, true)) {
      if (footprint.has(neighborKey)) {
        continue;
      }

      const [row, column] = neighborKey.split(":").map(Number);

      if (config.gapMask[row]?.[column]) {
        adjacentGapSlots += 1;
      }
    }
  }

  return Math.min(0.9, adjacentGapSlots * 0.18);
};

const removeDenseSmallCorners = (cells: GridCell[], prng: Prng) => {
  const bySlot = new Map<string, GridCell>();
  const removableIds = new Set<string>();

  for (const cell of cells) {
    if (cell.kind === "small") {
      bySlot.set(`${cell.y / BASE_UNIT}:${cell.x / BASE_UNIT}`, cell);
    }
  }

  for (const cell of cells) {
    if (cell.kind !== "small") {
      continue;
    }

    const row = cell.y / BASE_UNIT;
    const column = cell.x / BASE_UNIT;
    const block = [
      bySlot.get(`${row}:${column}`),
      bySlot.get(`${row}:${column + 1}`),
      bySlot.get(`${row + 1}:${column}`),
      bySlot.get(`${row + 1}:${column + 1}`),
    ];

    if (block.every(Boolean) && prng.chance(0.58)) {
      const corner = block[prng.integer(0, block.length - 1)];

      if (corner) {
        removableIds.add(corner.id);
      }
    }
  }

  let nextCells = cells;

  for (const id of removableIds) {
    const candidateCells = nextCells.filter((cell) => cell.id !== id);

    if (candidateCells.length > 0 && isFootprintConnected(candidateCells)) {
      nextCells = candidateCells;
    }
  }

  return nextCells;
};

export const generateGrid = (config: GridConfig): GeneratedGrid => {
  const normalizedConfig = normalizeConfig(config);
  const prng = createPrng(
    JSON.stringify({
      seed: normalizedConfig.seed,
      width: normalizedConfig.logicalWidth,
      height: normalizedConfig.logicalHeight,
      density: normalizedConfig.density,
      small: normalizedConfig.smallCellRatio,
      gapMask: normalizedConfig.gapMask,
    }),
  );
  const placeableSlots = getPlaceableSlotCount(normalizedConfig);
  const largeOnlyMode = !prefersAllSmallCells(normalizedConfig.smallCellRatio);
  const targetLargeSlots = Math.floor(placeableSlots * normalizedConfig.density);
  const targetOccupiedSlots = largeOnlyMode ? 0 : Math.floor(placeableSlots * normalizedConfig.density);
  const growthTargetMet = () =>
    largeOnlyMode ? countLargeOccupiedSlots(cells) >= targetLargeSlots : occupied.size >= targetOccupiedSlots;
  const highDensity = normalizedConfig.density >= 0.85;
  const occupied = new Set<string>();
  const cells: GridCell[] = [];

  if ((largeOnlyMode && targetLargeSlots === 0) || (!largeOnlyMode && targetOccupiedSlots === 0)) {
    const grid = { config: normalizedConfig, cells };

    assertValidGeneratedGrid(grid);

    return grid;
  }

  const largeCandidates = largeOnlyMode ? buildCandidates(normalizedConfig, LARGE_CELL_SIZE) : [];
  const smallCandidates = prefersAllSmallCells(normalizedConfig.smallCellRatio)
    ? buildCandidates(normalizedConfig, SMALL_CELL_SIZE)
    : [];
  const edgeConnectorCandidates = largeCandidates.filter((candidate) =>
    isVerticalEdgeConnector(candidate, normalizedConfig),
  );
  const canStartLarge = largeCandidates.length > 0 && targetLargeSlots > 0;
  const preferredStartPool = canStartLarge ? largeCandidates : smallCandidates;
  const fallbackStartPool =
    preferredStartPool === largeCandidates ? smallCandidates : canStartLarge ? largeCandidates : [];
  const startCandidate =
    (canStartLarge && edgeConnectorCandidates.length > 0 && prng.chance(0.82)
      ? prioritizeCandidates(edgeConnectorCandidates, normalizedConfig, prng)[0]
      : undefined) ??
    prioritizeCandidates(preferredStartPool, normalizedConfig, prng)[0] ??
    prioritizeCandidates(fallbackStartPool, normalizedConfig, prng)[0];

  if (startCandidate) {
    commitCandidate(startCandidate, occupied, cells, cells.length);
  }

  let attempts = 0;
  let largeSlots = countLargeOccupiedSlots(cells);
  let smallSlots = cells.filter((cell) => cell.kind === "small").length;
  const totalSlots = normalizedConfig.columns * normalizedConfig.rows;
  const maxAttempts = Math.max(totalSlots * MAX_GROWTH_ATTEMPT_MULTIPLIER, 120);
  const pickOptions: PickCandidateOptions = { highDensity };

  while (!growthTargetMet() && attempts < maxAttempts) {
    attempts += 1;
    const underLargeTarget = largeOnlyMode && largeSlots < targetLargeSlots;
    const underOccupiedTarget = !largeOnlyMode && occupied.size < targetOccupiedSlots;
    const prioritizeLargeFill = largeOnlyMode || (highDensity && underOccupiedTarget && underLargeTarget);

    const canPlaceLarge =
      largeCandidates.length > 0 &&
      (largeOnlyMode ? largeSlots < targetLargeSlots : underOccupiedTarget || largeSlots < targetLargeSlots);
    const canPlaceSmall = !largeOnlyMode && smallCandidates.length > 0 && !prioritizeLargeFill && underOccupiedTarget;

    if (!canPlaceLarge && !canPlaceSmall) {
      break;
    }

    const shouldTryLarge = canPlaceLarge && (!canPlaceSmall || prioritizeLargeFill || prng.chance(0.72));
    const primaryPool = shouldTryLarge ? largeCandidates : smallCandidates;
    const secondaryPool =
      shouldTryLarge && canPlaceSmall ? smallCandidates : !shouldTryLarge && canPlaceLarge ? largeCandidates : [];
    const candidate =
      pickValidCandidate(primaryPool, normalizedConfig, occupied, cells, prng, true, pickOptions, largeCandidates) ??
      pickValidCandidate(secondaryPool, normalizedConfig, occupied, cells, prng, true, pickOptions, largeCandidates);

    if (!candidate) {
      break;
    }

    commitCandidate(candidate, occupied, cells, cells.length);

    if (candidate.kind === "large") {
      largeSlots += getCandidateSlots(candidate);
    } else if (candidate.kind === "small") {
      smallSlots += 1;
    }
  }

  if (!growthTargetMet()) {
    const fillOptions: PickCandidateOptions = { highDensity: true, allowDenseContacts: true };
    let fillAttempts = 0;
    const maxFillAttempts = Math.max(placeableSlots * 12, 80);

    while (!growthTargetMet() && fillAttempts < maxFillAttempts) {
      fillAttempts += 1;
      const underLargeTarget = largeOnlyMode && largeSlots < targetLargeSlots;
      const underOccupiedTarget = !largeOnlyMode && occupied.size < targetOccupiedSlots;
      const prioritizeLargeFill = largeOnlyMode || underLargeTarget;
      const canPlaceLarge =
        largeCandidates.length > 0 &&
        (largeOnlyMode ? largeSlots < targetLargeSlots : underOccupiedTarget || largeSlots < targetLargeSlots);
      const canPlaceSmall = !largeOnlyMode && smallCandidates.length > 0 && !prioritizeLargeFill && underOccupiedTarget;

      if (!canPlaceLarge && !canPlaceSmall) {
        break;
      }

      const shouldTryLarge = canPlaceLarge && (!canPlaceSmall || prioritizeLargeFill || prng.chance(0.95));
      const primaryPool = shouldTryLarge ? largeCandidates : smallCandidates;
      const secondaryPool =
        shouldTryLarge && canPlaceSmall ? smallCandidates : !shouldTryLarge && canPlaceLarge ? largeCandidates : [];
      const candidate =
        pickValidCandidate(primaryPool, normalizedConfig, occupied, cells, prng, true, fillOptions, largeCandidates) ??
        pickValidCandidate(secondaryPool, normalizedConfig, occupied, cells, prng, true, fillOptions, largeCandidates);

      if (!candidate) {
        break;
      }

      commitCandidate(candidate, occupied, cells, cells.length);

      if (candidate.kind === "large") {
        largeSlots += getCandidateSlots(candidate);
      } else if (candidate.kind === "small") {
        smallSlots += 1;
      }
    }
  }

  if (largeOnlyMode && largeSlots < targetLargeSlots) {
    fillResidualPlaceableSlots(normalizedConfig, occupied, cells, largeCandidates, prng, targetLargeSlots, pickOptions);
    largeSlots = countLargeOccupiedSlots(cells);
    smallSlots = cells.filter((cell) => cell.kind === "small").length;
  }

  if (largeOnlyMode && normalizedConfig.smallCellRatio > 0) {
    const replaceCount = Math.floor(
      cells.filter((cell) => cell.kind === "large").length * normalizedConfig.smallCellRatio,
    );
    const refillOptions: PickCandidateOptions = {
      ...pickOptions,
      highDensity: true,
      allowDenseContacts: true,
      allowVoidLargeFill: true,
    };
    replaceLargeCellsWithSmalls(normalizedConfig, occupied, cells, prng, replaceCount);
    fillEmptyLargeFootprints(normalizedConfig, occupied, cells, largeCandidates, prng, refillOptions);
    const smallSlotCount = cells.filter((cell) => cell.kind === "small").length;
    fillResidualPlaceableSlots(
      normalizedConfig,
      occupied,
      cells,
      largeCandidates,
      prng,
      Math.max(0, targetLargeSlots - smallSlotCount),
      refillOptions,
    );
    fillToTargetOccupancy(
      normalizedConfig,
      occupied,
      cells,
      largeCandidates,
      prng,
      Math.floor(placeableSlots * normalizedConfig.density),
      refillOptions,
    );
  }

  const baseCells = highDensity || largeOnlyMode ? cells : removeDenseSmallCorners(cells, prng);
  const grid = {
    config: normalizedConfig,
    cells: baseCells,
  };

  assertValidGeneratedGrid(grid);

  return grid;
};
