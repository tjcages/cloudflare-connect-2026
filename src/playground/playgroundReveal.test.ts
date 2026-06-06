import { describe, expect, test } from "vitest";
import type { LumaGrid } from "./computeBlockGrid";
import {
  applyPlaygroundRevealToLumaGrid,
  buildRandomColumnRevealRanks,
  randomColumnShiftReturnEasing,
  randomColumnRevealMultiplier,
} from "./playgroundReveal";
import { DEFAULT_PLAYGROUND_REVEAL_CONFIG } from "./playgroundRevealConfig";

describe("playground wave reveal", () => {
  test("keeps origin cells revealed and pushes unrevealed cells to darkest luminance", () => {
    const grid: LumaGrid = {
      cols: 3,
      rows: 1,
      luma: new Uint8Array([50, 150, 250]),
    };

    const revealed = applyPlaygroundRevealToLumaGrid(grid, {
      config: {
        preset: "wave",
        wave: {
          ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave,
          position: "left center",
          softness: 0,
          waviness: 0,
        },
        randomColumns: DEFAULT_PLAYGROUND_REVEAL_CONFIG.randomColumns,
      },
      progress: 0.25,
    });

    expect([...revealed.luma]).toEqual([50, 0, 0]);
    expect(grid.luma).toEqual(new Uint8Array([50, 150, 250]));
  });

  test("fully revealed progress preserves the adjusted luminance grid", () => {
    const grid: LumaGrid = {
      cols: 2,
      rows: 2,
      luma: new Uint8Array([20, 80, 160, 240]),
    };

    const revealed = applyPlaygroundRevealToLumaGrid(grid, {
      config: DEFAULT_PLAYGROUND_REVEAL_CONFIG,
      progress: 1,
    });

    expect([...revealed.luma]).toEqual([20, 80, 160, 240]);
  });
});

describe("playground random-columns reveal", () => {
  test("builds stable ranks for the same seed and reshuffles when replay key changes", () => {
    const first = [...buildRandomColumnRevealRanks(8, 0)];
    const same = [...buildRandomColumnRevealRanks(8, 0)];
    const replayed = [...buildRandomColumnRevealRanks(8, 1)];

    expect(first).toEqual(same);
    expect(new Set(first)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(replayed).not.toEqual(first);
  });

  test("collapses the black overlay toward the column center", () => {
    const config = {
      ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.randomColumns,
      stagger: 0,
    };
    const ranks = new Uint32Array([0]);

    expect(
      randomColumnRevealMultiplier({
        x: 3,
        col: 0,
        cols: 1,
        cellWidth: 8,
        progress: 0,
        config,
        ranks,
      }),
    ).toBe(0);
    expect(
      randomColumnRevealMultiplier({
        x: 0,
        col: 0,
        cols: 1,
        cellWidth: 8,
        progress: 0.5,
        config,
        ranks,
      }),
    ).toBe(1);
    expect(
      randomColumnRevealMultiplier({
        x: 3,
        col: 0,
        cols: 1,
        cellWidth: 8,
        progress: 1,
        config,
        ranks,
      }),
    ).toBe(1);
  });

  test("random-columns y shift returns displaced columns to their original rows", () => {
    const grid: LumaGrid = {
      cols: 2,
      rows: 4,
      luma: new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]),
    };
    const config = {
      ...DEFAULT_PLAYGROUND_REVEAL_CONFIG,
      preset: "randomColumns" as const,
      randomColumns: {
        ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.randomColumns,
        stagger: 0,
      },
    };

    const shifted = applyPlaygroundRevealToLumaGrid(grid, {
      config,
      progress: 0,
      replayKey: 1,
    });
    const restored = applyPlaygroundRevealToLumaGrid(grid, {
      config,
      progress: 1,
      replayKey: 1,
    });

    expect([...shifted.luma]).not.toEqual([...grid.luma]);
    expect([...restored.luma]).toEqual([...grid.luma]);
  });

  test("random-columns y shift can be disabled", () => {
    const grid: LumaGrid = {
      cols: 2,
      rows: 4,
      luma: new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]),
    };
    const config = {
      ...DEFAULT_PLAYGROUND_REVEAL_CONFIG,
      preset: "randomColumns" as const,
      randomColumns: {
        ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.randomColumns,
        stagger: 0,
        yShift: 0,
      },
    };

    const revealed = applyPlaygroundRevealToLumaGrid(grid, {
      config,
      progress: 0,
      replayKey: 1,
    });

    expect([...revealed.luma]).toEqual([...grid.luma]);
  });

  test("random-columns y shift uses the requested cubic-bezier return easing", () => {
    expect(randomColumnShiftReturnEasing(0)).toBeCloseTo(0, 5);
    expect(randomColumnShiftReturnEasing(0.5)).toBeCloseTo(0.9249, 3);
    expect(randomColumnShiftReturnEasing(1)).toBeCloseTo(1, 5);
  });
});
