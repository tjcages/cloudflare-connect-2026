import { describe, expect, test } from "vitest";
import type { LumaGrid } from "./computeBlockGrid";
import { applyPlaygroundRevealToLumaGrid } from "./playgroundReveal";
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
