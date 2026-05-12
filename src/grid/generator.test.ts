import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { generateGrid } from "./generator";
import { createGapMask } from "./mask";
import { BASE_UNIT, LARGE_CELL_SIZE } from "./types";
import { validateGeneratedGrid } from "./validate";

const footprint = (cell: { x: number; y: number; width: number; height: number }) => {
  const keys: string[] = [];

  for (let y = cell.y / BASE_UNIT; y < (cell.y + cell.height) / BASE_UNIT; y += 1) {
    for (let x = cell.x / BASE_UNIT; x < (cell.x + cell.width) / BASE_UNIT; x += 1) {
      keys.push(`${y}:${x}`);
    }
  }

  return keys;
};

const isConnected = (cells: ReturnType<typeof generateGrid>["cells"]) => {
  const occupied = new Set(cells.flatMap(footprint));
  const first = occupied.values().next().value as string | undefined;

  if (!first) {
    return true;
  }

  const visited = new Set<string>([first]);
  const queue = [first];

  while (queue.length > 0) {
    const [row, column] = queue.shift()!.split(":").map(Number);
    const neighbors = [
      `${row - 1}:${column}`,
      `${row + 1}:${column}`,
      `${row}:${column - 1}`,
      `${row}:${column + 1}`,
      `${row - 1}:${column - 1}`,
      `${row - 1}:${column + 1}`,
      `${row + 1}:${column - 1}`,
      `${row + 1}:${column + 1}`,
    ];

    for (const neighbor of neighbors) {
      if (occupied.has(neighbor) && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return visited.size === occupied.size;
};

const smallCellsShareEdge = (cells: ReturnType<typeof generateGrid>["cells"]) =>
  cells.some((left, leftIndex) =>
    cells.slice(leftIndex + 1).some((right) => {
      if (left.kind !== "small" || right.kind !== "small") {
        return false;
      }

      const verticalTouch =
        (left.x + left.width === right.x || right.x + right.width === left.x) &&
        Math.max(left.y, right.y) < Math.min(left.y + left.height, right.y + right.height);
      const horizontalTouch =
        (left.y + left.height === right.y || right.y + right.height === left.y) &&
        Math.max(left.x, right.x) < Math.min(left.x + left.width, right.x + right.width);

      return verticalTouch || horizontalTouch;
    }),
  );

const hasVerticalEdgeConnector = (grid: ReturnType<typeof generateGrid>) =>
  grid.cells.some(
    (cell) =>
      cell.kind === "large" &&
      (cell.y === 0 || cell.y + cell.height === grid.config.logicalHeight),
  );

const hasTopRightCoverage = (grid: ReturnType<typeof generateGrid>) =>
  grid.cells.some(
    (cell) =>
      cell.x + cell.width > grid.config.logicalWidth * 0.62 &&
      cell.y < grid.config.logicalHeight * 0.36,
  );

const isOverlayInsideLargeCell = (
  overlay: ReturnType<typeof generateGrid>["cells"][number],
  cells: ReturnType<typeof generateGrid>["cells"],
) =>
  cells.some(
    (cell) =>
      cell.kind === "large" &&
      overlay.x >= cell.x &&
      overlay.y >= cell.y &&
      overlay.x + overlay.width <= cell.x + cell.width &&
      overlay.y + overlay.height <= cell.y + cell.height,
  );

const getSmallDiagonalChainLength = (cells: ReturnType<typeof generateGrid>["cells"]) => {
  const smallSlots = new Set(
    cells
      .filter((cell) => cell.kind === "small")
      .map((cell) => `${cell.y / BASE_UNIT}:${cell.x / BASE_UNIT}`),
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

const hasOutsideCompanion = (
  overlay: ReturnType<typeof generateGrid>["cells"][number],
  cells: ReturnType<typeof generateGrid>["cells"],
) =>
  cells.some((cell) => {
    if (cell.kind !== "small") {
      return false;
    }

    const deltaX = Math.abs(cell.x - overlay.x);
    const deltaY = Math.abs(cell.y - overlay.y);

    return deltaX <= BASE_UNIT && deltaY <= BASE_UNIT && (deltaX > 0 || deltaY > 0);
  });

const countSmallVisuals = (cells: ReturnType<typeof generateGrid>["cells"]) =>
  cells.filter((cell) => cell.kind === "small" || cell.kind === "overlaySmall").length;

const countBaseOccupiedSlots = (cells: ReturnType<typeof generateGrid>["cells"]) =>
  cells
    .filter((cell) => cell.kind !== "overlaySmall")
    .reduce((total, cell) => total + (cell.width / BASE_UNIT) * (cell.height / BASE_UNIT), 0);

describe("generateGrid", () => {
  it("is deterministic for the same seed and config", () => {
    const config = {
      ...DEFAULT_CONFIG,
      seed: "same-seed",
    };

    expect(generateGrid(config).cells).toEqual(generateGrid(config).cells);
  });

  it("usually creates different layouts for different seeds", () => {
    const first = generateGrid({ ...DEFAULT_CONFIG, seed: "first-seed" });
    const second = generateGrid({ ...DEFAULT_CONFIG, seed: "second-seed" });

    expect(first.cells).not.toEqual(second.cells);
  });

  it("returns only valid cells", () => {
    const grid = generateGrid(DEFAULT_CONFIG);
    const result = validateGeneratedGrid(grid);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("uses 80x80 as the large cell size", () => {
    const grid = generateGrid({ ...DEFAULT_CONFIG, largeCellRatio: 0.8, smallCellRatio: 0.2 });

    expect(grid.cells.some((cell) => cell.kind === "large")).toBe(true);
    expect(grid.cells.filter((cell) => cell.kind === "large").every((cell) => cell.width === LARGE_CELL_SIZE)).toBe(true);
    expect(LARGE_CELL_SIZE).toBe(80);
  });

  it("respects very low 40x40 ratios across base cells and overlays", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      smallCellRatio: 0.05,
      largeCellRatio: 0.95,
    });
    const smallBudget = Math.floor(
      grid.config.columns * grid.config.rows * grid.config.density * grid.config.smallCellRatio,
    );

    expect(countSmallVisuals(grid.cells)).toBeLessThanOrEqual(smallBudget);
  });

  it("does not place 80x80 cells when their ratio is zero", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      smallCellRatio: 1,
      largeCellRatio: 0,
      density: 1,
    });

    expect(grid.cells.some((cell) => cell.kind === "large")).toBe(false);
  });

  it("allows all-small grids to grow beyond the decorative diagonal-chain cap", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      smallCellRatio: 1,
      largeCellRatio: 0,
      density: 1,
    });

    expect(validateGeneratedGrid(grid).valid).toBe(true);
    expect(grid.cells.filter((cell) => cell.kind === "small").length).toBeGreaterThan(3);
  });

  it("generates a denser footprint when density increases", () => {
    const sparseGrid = generateGrid({
      ...DEFAULT_CONFIG,
      seed: "density-check",
      density: 0.2,
    });
    const denseGrid = generateGrid({
      ...DEFAULT_CONFIG,
      seed: "density-check",
      density: 1,
    });

    expect(countBaseOccupiedSlots(denseGrid.cells)).toBeGreaterThan(countBaseOccupiedSlots(sparseGrid.cells));
  });

  it("uses density as the occupied-slot target", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      width: 80,
      height: 160,
      density: 0.5,
    });
    const occupiedSlots = countBaseOccupiedSlots(grid.cells);

    expect(occupiedSlots).toBeGreaterThanOrEqual(4);
  });

  it("allows zero density to generate an empty grid", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      density: 0,
    });

    expect(grid.cells).toEqual([]);
  });

  it("aligns 80x80 cells to the 80px grid", () => {
    const grid = generateGrid(DEFAULT_CONFIG);

    expect(
      grid.cells
        .filter((cell) => cell.kind === "large")
        .every((cell) => cell.x % LARGE_CELL_SIZE === 0 && cell.y % LARGE_CELL_SIZE === 0),
    ).toBe(true);
  });

  it("draws some 40x40 overlays inside large cells", () => {
    const grid = generateGrid(DEFAULT_CONFIG);
    const overlays = grid.cells.filter((cell) => cell.kind === "overlaySmall");

    expect(overlays.length).toBeGreaterThan(0);
    expect(overlays.every((overlay) => isOverlayInsideLargeCell(overlay, grid.cells))).toBe(true);
  });

  it("adds outside companions next to overlay cells when possible", () => {
    const grid = generateGrid(DEFAULT_CONFIG);
    const overlays = grid.cells.filter((cell) => cell.kind === "overlaySmall");

    expect(overlays.every((overlay) => hasOutsideCompanion(overlay, grid.cells))).toBe(true);
  });

  it("keeps diagonal small-cell chains capped at 3", () => {
    const grid = generateGrid(DEFAULT_CONFIG);

    expect(getSmallDiagonalChainLength(grid.cells)).toBeLessThanOrEqual(3);
  });

  it("rejects diagonal small-cell chains longer than 3", () => {
    const grid = generateGrid(DEFAULT_CONFIG);
    const result = validateGeneratedGrid({
      ...grid,
      cells: [
        { id: "small-a", kind: "small", x: 0, y: 0, width: 40, height: 40 },
        { id: "small-b", kind: "small", x: 40, y: 40, width: 40, height: 40 },
        { id: "small-c", kind: "small", x: 80, y: 80, width: 40, height: 40 },
        { id: "small-d", kind: "small", x: 120, y: 120, width: 40, height: 40 },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Small diagonal chains must not be longer than 3 cells.");
  });

  it("rejects misaligned 80x80 cells", () => {
    const grid = generateGrid(DEFAULT_CONFIG);
    const result = validateGeneratedGrid({
      ...grid,
      cells: [
        {
          id: "large-misaligned",
          kind: "large",
          x: 40,
          y: 0,
          width: 80,
          height: 80,
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("large-misaligned must be aligned to the 80px large-cell grid.");
  });

  it("biases large cells toward top or bottom edge connectors", () => {
    const grid = generateGrid(DEFAULT_CONFIG);

    expect(hasVerticalEdgeConnector(grid)).toBe(true);
  });

  it("grows one connected footprint through edges or corners instead of scattered islands", () => {
    const grid = generateGrid(DEFAULT_CONFIG);

    expect(isConnected(grid.cells)).toBe(true);
  });

  it("treats diagonal contact as connected", () => {
    const grid = generateGrid(DEFAULT_CONFIG);
    const result = validateGeneratedGrid({
      ...grid,
      cells: [
        { id: "small-a", kind: "small", x: 0, y: 0, width: 40, height: 40 },
        { id: "small-b", kind: "small", x: 40, y: 40, width: 40, height: 40 },
      ],
    });

    expect(result.valid).toBe(true);
  });

  it("rejects edge-touching small cells because they read as unsupported rectangles", () => {
    const grid = generateGrid(DEFAULT_CONFIG);
    const result = validateGeneratedGrid({
      ...grid,
      cells: [
        { id: "small-a", kind: "small", x: 0, y: 0, width: 40, height: 40 },
        { id: "small-b", kind: "small", x: 40, y: 0, width: 40, height: 40 },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Small cells must not share a full edge because they can read as 80x40 or 40x80.",
    );
  });

  it("does not reproduce the 80x40 visual block for seed 0caae61a", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      seed: "0caae61a",
      smallCellRatio: 0.15,
      largeCellRatio: 0.85,
    });

    expect(validateGeneratedGrid(grid).valid).toBe(true);
    expect(smallCellsShareEdge(grid.cells)).toBe(false);
  });

  it("does not place cells inside gap-mask slots", () => {
    const gapMask = createGapMask(8, 8);
    gapMask[0][0] = true;
    gapMask[0][1] = true;
    gapMask[1][0] = true;
    gapMask[1][1] = true;

    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      width: 320,
      height: 320,
      gapMask,
    });

    expect(validateGeneratedGrid(grid).valid).toBe(true);
    expect(
      grid.cells.some((cell) => cell.x < 80 && cell.y < 80),
    ).toBe(false);
  });

  it("still grows edge connectors near open columns when bottom-left is reserved", () => {
    const gapMask = createGapMask(14, 20);

    for (let row = 10; row < 14; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        gapMask[row][column] = true;
      }
    }

    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      density: 0.72,
      gapMask,
    });

    expect(validateGeneratedGrid(grid).valid).toBe(true);
    expect(
      grid.cells.some((cell) => cell.kind === "large" && cell.y === 0 && cell.x <= 160),
    ).toBe(true);
  });

  it("does not leave the top-right area empty for seed 860591a4", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      seed: "860591a4",
    });

    expect(validateGeneratedGrid(grid).valid).toBe(true);
    expect(hasTopRightCoverage(grid)).toBe(true);
  });
});
