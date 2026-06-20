import { describe, expect, test, it } from "vitest";
import {
  ASSEMBLY_SETTLE,
  assemblyOrderNorm,
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
  order: "center",
  from: "scatter",
  durationMs: 2600,
  spread: 0.85,
  glowSize: 34,
  flight: 0.22,
  overshoot: false,
};

describe("assemblyOrderNorm", () => {
  it("orders center cells before corner cells for center order", () => {
    const center = assemblyOrderNorm(5, 5, 11, 11, "center");
    const corner = assemblyOrderNorm(0, 0, 11, 11, "center");
    expect(center).toBeLessThan(corner);
    expect(center).toBeCloseTo(0, 0);
    expect(corner).toBeCloseTo(1, 0);
  });

  it("inverts the center field for edges order", () => {
    const center = assemblyOrderNorm(5, 5, 11, 11, "edges");
    const corner = assemblyOrderNorm(0, 0, 11, 11, "edges");
    expect(center).toBeGreaterThan(corner);
  });

  it("orders left-to-right for sweep order", () => {
    expect(assemblyOrderNorm(0, 3, 11, 11, "sweep")).toBeLessThan(assemblyOrderNorm(10, 3, 11, 11, "sweep"));
  });

  it("is deterministic and within 0..1 for random order", () => {
    const a = assemblyOrderNorm(4, 7, 20, 20, "random");
    const b = assemblyOrderNorm(4, 7, 20, 20, "random");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  });
});

describe("assemblyRevealAmountAtCell", () => {
  it("is monotonic non-decreasing in progress", () => {
    let prev = -1;
    for (let p = 0; p <= 1.4; p += 0.1) {
      const v = assemblyRevealAmountAtCell(2, 2, 11, 11, p, ASSEMBLY, 0.1);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it("reveals the center cell before a corner cell at mid progress (center order)", () => {
    const center = assemblyRevealAmountAtCell(5, 5, 11, 11, 0.4, ASSEMBLY, 0.1);
    const corner = assemblyRevealAmountAtCell(0, 0, 11, 11, 0.4, ASSEMBLY, 0.1);
    expect(center).toBeGreaterThan(corner);
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
