import { describe, it, expect } from "vitest";
import { edgeMaskAlpha } from "./edgeMaskMath";
import type { EdgeMaskConfig } from "../config/types";

const ALL_SIDES = { top: true, right: true, bottom: true, left: true };
const ENABLED: EdgeMaskConfig = { enabled: true, start: 0, end: 0.1, power: 1, sides: ALL_SIDES };
const DISABLED: EdgeMaskConfig = { enabled: false, start: 0, end: 0.1, power: 1, sides: ALL_SIDES };

describe("edgeMaskAlpha — disabled", () => {
  it("returns 1 everywhere when disabled", () => {
    expect(edgeMaskAlpha(0, 0, DISABLED)).toBe(1);
    expect(edgeMaskAlpha(0.5, 0.5, DISABLED)).toBe(1);
    expect(edgeMaskAlpha(1, 1, DISABLED)).toBe(1);
  });
});

describe("edgeMaskAlpha — enabled", () => {
  it("returns 1 at center (0.5, 0.5)", () => {
    expect(edgeMaskAlpha(0.5, 0.5, ENABLED)).toBe(1);
  });

  it("returns 0 at corner (0, 0)", () => {
    expect(edgeMaskAlpha(0, 0, ENABLED)).toBe(0);
  });

  it("power:1 — (0.05, 0.5) → 0.5", () => {
    expect(edgeMaskAlpha(0.05, 0.5, ENABLED)).toBeCloseTo(0.5, 10);
  });

  it("power:2 — (0.05, 0.5) → 0.25", () => {
    const cfg: EdgeMaskConfig = { ...ENABLED, power: 2 };
    expect(edgeMaskAlpha(0.05, 0.5, cfg)).toBeCloseTo(0.25, 10);
  });

  it("symmetry: alpha(u,v) === alpha(1-u,v)", () => {
    expect(edgeMaskAlpha(0.1, 0.3, ENABLED)).toBeCloseTo(edgeMaskAlpha(0.9, 0.3, ENABLED), 10);
  });

  it("symmetry: alpha(u,v) === alpha(u,1-v)", () => {
    expect(edgeMaskAlpha(0.3, 0.1, ENABLED)).toBeCloseTo(edgeMaskAlpha(0.3, 0.9, ENABLED), 10);
  });
});
