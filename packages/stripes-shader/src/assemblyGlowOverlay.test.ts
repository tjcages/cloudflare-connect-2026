import { describe, expect, it } from "vitest";
import { assemblyEmitterAt, assemblySpawnPoint } from "./assemblyGlowOverlay";

const OPTS = { flight: 0.22, spread: 0.85, glowSize: 34, overshoot: false };

describe("assemblySpawnPoint", () => {
  it("scatter spawns outside the canvas", () => {
    const [x, y] = assemblySpawnPoint(3, 200, 150, 400, 300, "scatter");
    const outside = x < 0 || x > 400 || y < 0 || y > 300;
    expect(outside).toBe(true);
  });

  it("edge spawns just past the nearest border", () => {
    const [x] = assemblySpawnPoint(1, 380, 150, 400, 300, "edge"); // near right edge
    expect(x).toBeGreaterThan(400);
  });

  it("radial spawns along the center->cell ray, beyond the cell", () => {
    const cx = 320;
    const cy = 150;
    const [x, y] = assemblySpawnPoint(2, cx, cy, 400, 300, "radial"); // cell right of center
    expect(x).toBeGreaterThan(cx);
    expect(Math.abs(y - 150)).toBeLessThan(1); // same horizontal ray as center (200,150)
  });
});

describe("assemblyEmitterAt", () => {
  const o = 0;
  const spawn: [number, number] = [-50, -50];
  const cell: [number, number] = [100, 80];

  it("is invisible before its start", () => {
    const before = assemblyEmitterAt(0.5, spawn[0], spawn[1], cell[0], cell[1], 0, OPTS);
    expect(before.visible).toBe(false);
  });

  it("travels from spawn toward the cell during flight", () => {
    const mid = assemblyEmitterAt(o, spawn[0], spawn[1], cell[0], cell[1], 0.11, OPTS);
    expect(mid.visible).toBe(true);
    expect(mid.alpha).toBeGreaterThan(0);
    expect(mid.x).toBeGreaterThan(spawn[0]);
    expect(mid.x).toBeLessThanOrEqual(cell[0] + 1);
  });

  it("sits on the cell while settling, then disappears", () => {
    const arrival = o * (1 - OPTS.flight) * OPTS.spread + OPTS.flight; // = flight here
    const settling = assemblyEmitterAt(o, spawn[0], spawn[1], cell[0], cell[1], arrival + 0.01, OPTS);
    expect(settling.visible).toBe(true);
    expect(settling.x).toBeCloseTo(cell[0], 5);
    const gone = assemblyEmitterAt(o, spawn[0], spawn[1], cell[0], cell[1], arrival + 0.2, OPTS);
    expect(gone.visible).toBe(false);
  });
});
