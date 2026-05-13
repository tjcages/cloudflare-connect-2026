import { normalizeConfig } from "./config";
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

  return cells.some((cell) => {
    if (cell.kind !== "small") {
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

const shouldCapSmallDiagonalChains = (config: NormalizedGridConfig) => config.largeCellRatio > 0;

const wouldExceedSmallDiagonalChain = (candidate: CandidateCell, cells: GridCell[], config: NormalizedGridConfig) =>
  shouldCapSmallDiagonalChains(config) &&
  candidate.kind === "small" &&
  getSmallDiagonalChainLength([...cells, candidate]) > 3;

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
) => {
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

    if (wouldExceedSmallDiagonalChain(candidate, cells, config)) {
      continue;
    }

    const orthogonalContacts = countOrthogonalContacts(candidate, occupied);
    const diagonalContacts = countDiagonalContacts(candidate, occupied);

    if (orthogonalContacts >= 4) {
      continue;
    }

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

    if (wouldExceedSmallDiagonalChain(candidate, cells, config)) {
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

const addSmallOverlays = (
  cells: GridCell[],
  config: NormalizedGridConfig,
  prng: Prng,
  smallVisualBudget: number,
): GridCell[] => {
  const baseCells = [...cells];
  const occupied = rebuildOccupied(baseCells);
  let usedSmallVisuals = baseCells.filter((cell) => cell.kind === "small").length;
  const largeCells = shuffleWithPrng(
    baseCells.filter((cell) => cell.kind === "large"),
    prng,
  );
  const overlays: GridCell[] = [];

  for (const largeCell of largeCells) {
    if (usedSmallVisuals + 2 > smallVisualBudget) {
      break;
    }

    const overlayCount = prng.integer(0, 4);
    const corners = shuffleWithPrng([0, 1, 2, 3], prng).slice(0, overlayCount);

    for (const corner of corners) {
      if (usedSmallVisuals + 2 > smallVisualBudget) {
        break;
      }

      const x = largeCell.x + (corner % 2) * SMALL_CELL_SIZE;
      const y = largeCell.y + (corner > 1 ? SMALL_CELL_SIZE : 0);
      const overlay = {
        id: `overlay-${overlays.length}-${x}-${y}`,
        kind: "overlaySmall",
        x,
        y,
        width: SMALL_CELL_SIZE,
        height: SMALL_CELL_SIZE,
      } satisfies GridCell;

      if (candidateTouchesGap(config.gapMask, overlay)) {
        continue;
      }

      const companion = pickOverlayCompanion(overlay, largeCell, baseCells, occupied, config, prng);

      if (!companion) {
        continue;
      }

      overlays.push(overlay);
      baseCells.push(companion);
      usedSmallVisuals += 2;

      for (const key of footprintKeys(companion)) {
        occupied.add(key);
      }
    }
  }

  return [...baseCells, ...overlays];
};

const pickOverlayCompanion = (
  overlay: GridCell,
  largeCell: GridCell,
  cells: GridCell[],
  occupied: Set<string>,
  config: NormalizedGridConfig,
  prng: Prng,
) => {
  const offsets = shuffleWithPrng(
    [
      [-BASE_UNIT, -BASE_UNIT],
      [0, -BASE_UNIT],
      [BASE_UNIT, -BASE_UNIT],
      [-BASE_UNIT, 0],
      [BASE_UNIT, 0],
      [-BASE_UNIT, BASE_UNIT],
      [0, BASE_UNIT],
      [BASE_UNIT, BASE_UNIT],
    ],
    prng,
  );

  for (const [offsetX, offsetY] of offsets) {
    const candidate = {
      id: `overlay-companion-${overlay.id}-${overlay.x + offsetX}-${overlay.y + offsetY}`,
      kind: "small",
      x: overlay.x + offsetX,
      y: overlay.y + offsetY,
      width: SMALL_CELL_SIZE,
      height: SMALL_CELL_SIZE,
    } satisfies GridCell;
    const insideLarge =
      candidate.x >= largeCell.x &&
      candidate.y >= largeCell.y &&
      candidate.x + candidate.width <= largeCell.x + largeCell.width &&
      candidate.y + candidate.height <= largeCell.y + largeCell.height;

    if (insideLarge) {
      continue;
    }

    if (
      candidate.x < 0 ||
      candidate.y < 0 ||
      candidate.x + candidate.width > config.logicalWidth ||
      candidate.y + candidate.height > config.logicalHeight
    ) {
      continue;
    }

    if (candidateTouchesGap(config.gapMask, candidate)) {
      continue;
    }

    if (collides(candidate, occupied)) {
      continue;
    }

    if (hasSmallEdgeNeighbor(candidate, cells)) {
      continue;
    }

    if (wouldExceedSmallDiagonalChain(candidate, cells, config)) {
      continue;
    }

    return candidate;
  }

  return null;
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
      large: normalizedConfig.largeCellRatio,
      gapMask: normalizedConfig.gapMask,
    }),
  );
  const totalSlots = normalizedConfig.columns * normalizedConfig.rows;
  const targetOccupiedSlots = Math.floor(totalSlots * normalizedConfig.density);
  const targetLargeSlots = Math.floor(targetOccupiedSlots * normalizedConfig.largeCellRatio);
  const targetSmallVisuals = Math.floor(targetOccupiedSlots * normalizedConfig.smallCellRatio);
  const targetBaseSmallSlots = Math.floor(targetSmallVisuals * (normalizedConfig.density >= 0.95 ? 1 : 0.55));
  const occupied = new Set<string>();
  const cells: GridCell[] = [];

  if (targetOccupiedSlots === 0) {
    const grid = { config: normalizedConfig, cells };

    assertValidGeneratedGrid(grid);

    return grid;
  }

  const largeCandidates = normalizedConfig.largeCellRatio > 0 ? buildCandidates(normalizedConfig, LARGE_CELL_SIZE) : [];
  const smallCandidates = normalizedConfig.smallCellRatio > 0 ? buildCandidates(normalizedConfig, SMALL_CELL_SIZE) : [];
  const edgeConnectorCandidates = largeCandidates.filter((candidate) =>
    isVerticalEdgeConnector(candidate, normalizedConfig),
  );
  const canStartLarge = largeCandidates.length > 0 && targetLargeSlots > 0;
  const canStartSmall = smallCandidates.length > 0 && targetBaseSmallSlots > 0;
  const preferredStartPool =
    canStartLarge && (!canStartSmall || prng.chance(normalizedConfig.largeCellRatio))
      ? largeCandidates
      : smallCandidates;
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
  let largeSlots = cells
    .filter((cell) => cell.kind === "large")
    .reduce((total, cell) => total + getCandidateSlots(cell), 0);
  let smallSlots = cells.filter((cell) => cell.kind === "small").length;
  const maxAttempts = Math.max(totalSlots * MAX_GROWTH_ATTEMPT_MULTIPLIER, 120);

  while (occupied.size < targetOccupiedSlots && attempts < maxAttempts) {
    attempts += 1;

    const canPlaceSmall = smallCandidates.length > 0 && smallSlots < targetBaseSmallSlots;
    const canPlaceLarge =
      largeCandidates.length > 0 &&
      (largeSlots < targetLargeSlots || (normalizedConfig.density >= 0.95 && !canPlaceSmall));

    if (!canPlaceLarge && !canPlaceSmall) {
      break;
    }

    const shouldTryLarge = canPlaceLarge && (!canPlaceSmall || prng.chance(0.72));
    const primaryPool = shouldTryLarge ? largeCandidates : smallCandidates;
    const secondaryPool =
      shouldTryLarge && canPlaceSmall ? smallCandidates : !shouldTryLarge && canPlaceLarge ? largeCandidates : [];
    const candidate =
      pickValidCandidate(primaryPool, normalizedConfig, occupied, cells, prng, true) ??
      pickValidCandidate(secondaryPool, normalizedConfig, occupied, cells, prng, true);

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

  const baseCells = removeDenseSmallCorners(cells, prng);
  const grid = {
    config: normalizedConfig,
    cells: addSmallOverlays(baseCells, normalizedConfig, prng, targetSmallVisuals),
  };

  assertValidGeneratedGrid(grid);

  return grid;
};
