import { describe, expect, test } from "vitest";
import { resolveWaveRevealGeometry, waveRevealAmountAtCell } from "./playgroundReveal";
import { DEFAULT_PLAYGROUND_REVEAL_CONFIG } from "./playgroundRevealConfig";

describe("playground wave reveal", () => {
  test("keeps origin cells revealed and masks distant cells to zero", () => {
    const wave = {
      ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave,
      position: "left center" as const,
      softness: 0,
      waviness: 0,
    };

    expect(waveRevealAmountAtCell(0, 0, 3, 1, 0.25, wave)).toBe(1);
    expect(waveRevealAmountAtCell(1, 0, 3, 1, 0.25, wave)).toBe(0);
    expect(waveRevealAmountAtCell(2, 0, 3, 1, 0.25, wave)).toBe(0);
  });

  test("full progress reveals every cell", () => {
    const wave = { ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave, softness: 0, waviness: 0 };
    for (let col = 0; col < 3; col++) {
      expect(waveRevealAmountAtCell(col, 0, 3, 1, 1, wave)).toBe(1);
    }
  });

  test("softness feathers the wave front", () => {
    const wave = {
      ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave,
      position: "left center" as const,
      softness: 0.3,
      waviness: 0,
    };
    const amount = waveRevealAmountAtCell(1, 0, 3, 1, 0.5, wave);
    expect(amount).toBeGreaterThan(0);
    expect(amount).toBeLessThan(1);
  });

  test("wave geometry resolves origins and the farthest-corner distance", () => {
    expect(resolveWaveRevealGeometry("center")).toEqual({ x: 0.5, y: 0.5, maxDistance: Math.hypot(0.5, 0.5) });
    expect(resolveWaveRevealGeometry("left top")).toEqual({ x: 0, y: 0, maxDistance: Math.hypot(1, 1) });
  });
});
