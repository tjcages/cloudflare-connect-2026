import { describe, expect, test, it } from "vitest";
import {
  ASSEMBLY_SETTLE,
  assemblyRevealAmountAtCell,
  resolveAssemblyRevealOvershoot,
  resolveWaveRevealGeometry,
  waveRevealAmountAtCell,
} from "./playgroundReveal";
import { DEFAULT_PLAYGROUND_REVEAL_CONFIG } from "./playgroundRevealConfig";
import type { PlaygroundAssemblyRevealConfig } from "./playgroundRevealConfig";

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

const ASSEMBLY: PlaygroundAssemblyRevealConfig = {
  speedMinMs: 800,
  speedMaxMs: 1200,
  staggerMs: 4000,
};

describe("assemblyRevealAmountAtCell", () => {
  it("is monotonic non-decreasing in progress", () => {
    let prev = -1;
    for (let p = 0; p <= 1.4; p += 0.1) {
      const v = assemblyRevealAmountAtCell(2, 2, 11, 11, p, ASSEMBLY, 0.1);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it("fully reveals every cell by progress 1 + bandRamp", () => {
    const bandRamp = 0.1;
    const done = 1 + bandRamp + 1e-3;
    for (const [c, r] of [
      [0, 0],
      [5, 5],
      [10, 10],
      [10, 0],
    ] as const) {
      expect(assemblyRevealAmountAtCell(c, r, 11, 11, done, ASSEMBLY, bandRamp)).toBeCloseTo(1, 5);
    }
  });
});

describe("resolveAssemblyRevealOvershoot", () => {
  it("covers at least the settle window and the band ramp", () => {
    expect(resolveAssemblyRevealOvershoot(0.04)).toBe(ASSEMBLY_SETTLE);
    expect(resolveAssemblyRevealOvershoot(0.3)).toBe(0.3);
  });
});
