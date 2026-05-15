import { describe, expect, it } from "vitest";
import { connectorLegPlateauEase } from "./legPlateauEase";

describe("connectorLegPlateauEase", () => {
  it("hits the endpoints", () => {
    expect(connectorLegPlateauEase(0)).toBeCloseTo(0, 10);
    expect(connectorLegPlateauEase(1)).toBeCloseTo(1, 10);
  });

  it("is monotone non-decreasing", () => {
    let prev = 0;
    for (let i = 0; i <= 200; i += 1) {
      const v = connectorLegPlateauEase(i / 200);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-10);
      prev = v;
    }
  });

  it("covers most spatial progress across the central time window (plateau region)", () => {
    const u25 = connectorLegPlateauEase(0.25);
    const u75 = connectorLegPlateauEase(0.75);
    expect(u75 - u25).toBeGreaterThan(0.52);
    const edgeSpan =
      connectorLegPlateauEase(0.15) -
      connectorLegPlateauEase(0) +
      (connectorLegPlateauEase(1) - connectorLegPlateauEase(0.85));
    expect(u75 - u25).toBeGreaterThan(edgeSpan);
  });
});
