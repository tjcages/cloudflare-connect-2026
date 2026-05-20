import { describe, expect, it } from "vitest";
import { findSoleSlotDiagonalLargeForSmall } from "./cellAttachment";
import { DEFAULT_CONFIG, getPlaceableSlotCount } from "./config";
import { generateGrid } from "./generator";
import { countLargeExposureSides } from "./largeExposure";
import { parseBuilderDocumentSnapshotInput } from "../lib/documentSnapshot";
import { createGapMask } from "./mask";
import { BASE_UNIT, LARGE_CELL_SIZE, type GridCell } from "./types";
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
    (cell) => cell.kind === "large" && (cell.y === 0 || cell.y + cell.height === grid.config.logicalHeight),
  );

const hasTopRightCoverage = (grid: ReturnType<typeof generateGrid>) =>
  grid.cells.some(
    (cell) => cell.x + cell.width > grid.config.logicalWidth * 0.62 && cell.y < grid.config.logicalHeight * 0.36,
  );

const countSmallCells = (cells: ReturnType<typeof generateGrid>["cells"]) =>
  cells.filter((cell) => cell.kind === "small").length;

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

  it("prefers chair larges with the fewest closed sides for replacement", () => {
    const grid = generateGrid({ ...DEFAULT_CONFIG, seed: "exposed-tip-priority", density: 0.68 });
    const slotKinds = new Map<string, "small" | "large">();

    for (const cell of grid.cells) {
      for (let row = cell.y / BASE_UNIT; row < (cell.y + cell.height) / BASE_UNIT; row += 1) {
        for (let column = cell.x / BASE_UNIT; column < (cell.x + cell.width) / BASE_UNIT; column += 1) {
          slotKinds.set(`${row}:${column}`, cell.kind === "large" ? "large" : "small");
        }
      }
    }

    const occupied = new Set(slotKinds.keys());
    const exposureKinds = slotKinds as Map<string, GridCell["kind"]>;

    const cellsTouch = (
      left: { x: number; y: number; width: number; height: number },
      right: { x: number; y: number; width: number; height: number },
    ) => {
      const touchesVertically =
        (left.x + left.width === right.x || right.x + right.width === left.x) &&
        Math.max(left.y, right.y) < Math.min(left.y + left.height, right.y + right.height);
      const touchesHorizontally =
        (left.y + left.height === right.y || right.y + right.height === left.y) &&
        Math.max(left.x, right.x) < Math.min(left.x + left.width, right.x + right.width);
      const touchesCorner =
        (left.x + left.width === right.x || right.x + right.width === left.x) &&
        (left.y + left.height === right.y || right.y + right.height === left.y);

      return touchesVertically || touchesHorizontally || touchesCorner;
    };

    const smalls = grid.cells.filter((cell) => cell.kind === "small");
    const attachedSideCounts = smalls
      .map((small) => {
        const attached = grid.cells.filter((cell) => cell.kind === "large" && cellsTouch(cell, small));

        return attached.length === 1 ? countLargeExposureSides(attached[0]!, occupied, exposureKinds, grid.config) : 99;
      })
      .filter((count) => count !== 99);

    expect(smalls.length).toBeGreaterThan(0);
    expect(attachedSideCounts.length).toBeGreaterThan(0);
    expect(attachedSideCounts.filter((count) => count <= 2).length).toBe(attachedSideCounts.length);
    expect(Math.min(...attachedSideCounts)).toBeLessThanOrEqual(2);
  });

  it("places small tips only diagonally on the attached large corner", () => {
    const grid = generateGrid({ ...DEFAULT_CONFIG, seed: "diagonal-tip-bias", density: 0.68 });
    const larges = grid.cells.filter((cell) => cell.kind === "large");
    const diagonalTips = grid.cells
      .filter((cell) => cell.kind === "small")
      .filter((small) => findSoleSlotDiagonalLargeForSmall(small, larges) !== null);

    expect(diagonalTips.length).toBeGreaterThan(0);
    expect(diagonalTips.length).toBe(grid.cells.filter((cell) => cell.kind === "small").length);
  });

  it("varies small tip positions across seeds", () => {
    const smallLayouts = ["alpha-tip", "beta-tip", "gamma-tip", "delta-tip"].map((seed) => {
      const grid = generateGrid({ ...DEFAULT_CONFIG, seed, density: 0.72 });

      return grid.cells
        .filter((cell) => cell.kind === "small")
        .map((cell) => `${cell.x}:${cell.y}`)
        .sort()
        .join("|");
    });

    expect(new Set(smallLayouts).size).toBeGreaterThan(1);
  });

  it("returns only valid cells", () => {
    const grid = generateGrid(DEFAULT_CONFIG);
    const result = validateGeneratedGrid(grid);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("uses 80x80 as the large cell size", () => {
    const grid = generateGrid({ ...DEFAULT_CONFIG, smallCellRatio: 0.2 });

    expect(grid.cells.some((cell) => cell.kind === "large")).toBe(true);
    expect(grid.cells.filter((cell) => cell.kind === "large").every((cell) => cell.width === LARGE_CELL_SIZE)).toBe(
      true,
    );
    expect(LARGE_CELL_SIZE).toBe(80);
  });

  it("places diagonal small tips when the small-cell ratio is below 1", () => {
    const grid = generateGrid({ ...DEFAULT_CONFIG, seed: "diagonal-tip-bias", density: 0.68, smallCellRatio: 0.35 });

    expect(grid.cells.filter((cell) => cell.kind === "small").length).toBeGreaterThan(0);
  });

  it("places small tips at a 0.33 ratio on the default config", () => {
    const grid = generateGrid({ ...DEFAULT_CONFIG, smallCellRatio: 0.33, density: 0.72 });
    const largeCount = grid.cells.filter((cell) => cell.kind === "large").length;
    const smallCount = grid.cells.filter((cell) => cell.kind === "small").length;

    expect(smallCount).toBeGreaterThan(0);
    expect(smallCount).toBeGreaterThanOrEqual(Math.floor(largeCount * 0.33 * 0.35));
  });

  it("respects very low 40x40 ratios via large-to-small replacement", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      smallCellRatio: 0.05,
    });
    const largeCount = grid.cells.filter((cell) => cell.kind === "large").length;
    const smallCount = countSmallCells(grid.cells);
    const expectedReplacements = Math.floor((largeCount + smallCount) * grid.config.smallCellRatio);

    expect(smallCount).toBeLessThanOrEqual(expectedReplacements + 1);
  });

  it("does not place 80x80 cells when the small-cell ratio is 1", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      smallCellRatio: 1,
      density: 1,
    });

    expect(grid.cells.some((cell) => cell.kind === "large")).toBe(false);
  });

  it("allows all-small grids to grow beyond the decorative diagonal-chain cap", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      smallCellRatio: 1,
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

  it("uses density as the large-slot target when large cells are enabled", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      width: 80,
      height: 160,
      density: 0.5,
    });
    const largeSlots = grid.cells
      .filter((cell) => cell.kind === "large")
      .reduce((total, cell) => total + (cell.width / 40) * (cell.height / 40), 0);

    expect(largeSlots).toBeGreaterThanOrEqual(4);
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

  it("does not emit overlaySmall decorative cells", () => {
    const grid = generateGrid(DEFAULT_CONFIG);

    expect(grid.cells.some((cell) => cell.kind === "overlaySmall")).toBe(false);
  });

  it("does not place small cells that touch each other in mixed layouts", () => {
    const grid = generateGrid(DEFAULT_CONFIG);
    const smalls = grid.cells.filter((cell) => cell.kind === "small");
    const smallsTouch = (
      left: { x: number; y: number; width: number; height: number },
      right: { x: number; y: number; width: number; height: number },
    ) => {
      const touchesVertically =
        (left.x + left.width === right.x || right.x + right.width === left.x) &&
        Math.max(left.y, right.y) < Math.min(left.y + left.height, right.y + right.height);
      const touchesHorizontally =
        (left.y + left.height === right.y || right.y + right.height === left.y) &&
        Math.max(left.x, right.x) < Math.min(left.x + left.width, right.x + right.width);
      const touchesCorner =
        (left.x + left.width === right.x || right.x + right.width === left.x) &&
        (left.y + left.height === right.y || right.y + right.height === left.y);

      return touchesVertically || touchesHorizontally || touchesCorner;
    };

    for (let leftIndex = 0; leftIndex < smalls.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < smalls.length; rightIndex += 1) {
        expect(smallsTouch(smalls[leftIndex]!, smalls[rightIndex]!)).toBe(false);
      }
    }
  });

  it("rejects small cells that touch each other in mixed layouts", () => {
    const grid = generateGrid(DEFAULT_CONFIG);
    const result = validateGeneratedGrid({
      ...grid,
      cells: [
        { id: "large-a", kind: "large", x: 0, y: 80, width: 80, height: 80 },
        { id: "small-a", kind: "small", x: 40, y: 40, width: 40, height: 40 },
        { id: "small-b", kind: "small", x: 80, y: 80, width: 40, height: 40 },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Small cells must not touch each other horizontally, vertically, or diagonally.");
  });

  it("rejects edge-flush small tips in mixed layouts", () => {
    const grid = generateGrid(DEFAULT_CONFIG);
    const result = validateGeneratedGrid({
      ...grid,
      cells: [
        { id: "large-a", kind: "large", x: 0, y: 0, width: 80, height: 80 },
        { id: "large-b", kind: "large", x: 80, y: 0, width: 80, height: 80 },
        { id: "small-a", kind: "small", x: 80, y: 0, width: 40, height: 40 },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("small-a must attach diagonally to its large cell, not on a shared edge.");
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
      config: { ...grid.config, smallCellRatio: 1 },
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
      config: { ...grid.config, smallCellRatio: 1 },
      cells: [
        { id: "small-a", kind: "small", x: 0, y: 0, width: 40, height: 40 },
        { id: "small-b", kind: "small", x: 40, y: 0, width: 40, height: 40 },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Small cells must not share a full edge because they can read as 80x40 or 40x80.");
  });

  it("does not reproduce the 80x40 visual block for seed 0caae61a", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      seed: "0caae61a",
      smallCellRatio: 0.15,
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
    expect(grid.cells.some((cell) => cell.x < 80 && cell.y < 80)).toBe(false);
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
    expect(grid.cells.some((cell) => cell.kind === "large" && cell.y === 0 && cell.x <= 160)).toBe(true);
  });

  it("does not leave the top-right area empty for seed 860591a4", () => {
    const grid = generateGrid({
      ...DEFAULT_CONFIG,
      seed: "860591a4",
    });

    expect(validateGeneratedGrid(grid).valid).toBe(true);
    expect(hasTopRightCoverage(grid)).toBe(true);
  });

  it("fills most placeable slots at density 1 for the user import config", async () => {
    const USER_IMPORT =
      "z:H4sIAAAAAAAAE-3UMQ6CQBCF4bv8thOyy4Ikc5XNFoqoBVqASkG4u4knEIEYyE7x2vmSmbyeF5oJF7SnRbHHPHNVmdvUuixH6FCbGiNc0SI1wgm1QoN6k7hCTLJ3QShRduYzCDfU-_Ohbiv5LR_Nc2RM2BYkWqN1kvVPuWn1-PvP-CfRGI3RuIhxfu_yrbkW5zTz8p2-Bev37pm2rM4bBqFGfRDuqC2GNz5wuNVnDAAA";
    const snapshot = (await parseBuilderDocumentSnapshotInput(USER_IMPORT)) as {
      gridConfig: Parameters<typeof generateGrid>[0];
    };
    const grid = generateGrid(snapshot.gridConfig);
    const placeable = getPlaceableSlotCount(grid.config);
    const occupied = countBaseOccupiedSlots(grid.cells);
    const smallCount = countSmallCells(grid.cells);
    const largeCount = grid.cells.filter((cell) => cell.kind === "large").length;
    const expectedReplacements = Math.floor((largeCount + smallCount) * grid.config.smallCellRatio);
    const minOccupiedAfterReplace = Math.floor(placeable * grid.config.density) - expectedReplacements * 3;

    expect(smallCount).toBeLessThanOrEqual(expectedReplacements + 2);
    expect(occupied).toBeGreaterThanOrEqual(
      smallCount > 0
        ? Math.max(minOccupiedAfterReplace - 96, Math.floor(placeable * 0.38))
        : Math.floor(placeable * 0.6),
    );

    if (smallCount === 0) {
      return;
    }

    expect(smallCount).toBeGreaterThanOrEqual(Math.floor(expectedReplacements * 0.5));
    expect(grid.cells.some((cell) => cell.kind === "overlaySmall")).toBe(false);

    const occupiedSlots = new Set<string>();
    for (const cell of grid.cells) {
      if (cell.kind === "overlaySmall") {
        continue;
      }

      for (let row = cell.y / BASE_UNIT; row < (cell.y + cell.height) / BASE_UNIT; row += 1) {
        for (let column = cell.x / BASE_UNIT; column < (cell.x + cell.width) / BASE_UNIT; column += 1) {
          occupiedSlots.add(`${row}:${column}`);
        }
      }
    }

    const larges = grid.cells.filter((cell) => cell.kind === "large");

    for (const small of grid.cells.filter((cell) => cell.kind === "small")) {
      const attached = findSoleSlotDiagonalLargeForSmall(small, larges);

      expect(attached).not.toBeNull();
      expect(
        attached!.x === 0 ||
          attached!.y === 0 ||
          attached!.x + attached!.width === grid.config.logicalWidth ||
          attached!.y + attached!.height === grid.config.logicalHeight,
      ).toBe(false);

      const slotKinds = new Map<string, "small" | "large">();
      for (const cell of grid.cells) {
        if (cell.kind === "overlaySmall") {
          continue;
        }

        for (let row = cell.y / BASE_UNIT; row < (cell.y + cell.height) / BASE_UNIT; row += 1) {
          for (let column = cell.x / BASE_UNIT; column < (cell.x + cell.width) / BASE_UNIT; column += 1) {
            slotKinds.set(`${row}:${column}`, cell.kind === "large" ? "large" : "small");
          }
        }
      }

      const occupied = new Set(slotKinds.keys());
      const exposureKinds = slotKinds as Map<string, GridCell["kind"]>;

      expect(countLargeExposureSides(attached!, occupied, exposureKinds, grid.config)).toBeLessThanOrEqual(2);
    }
  });
});
