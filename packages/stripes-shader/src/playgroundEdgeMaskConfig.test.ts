import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG,
  isDefaultPlaygroundEdgeMaskConfig,
  normalizePlaygroundEdgeMaskConfig,
  resolveEdgeMaskAlpha,
} from "./playgroundEdgeMaskConfig";

describe("playgroundEdgeMaskConfig", () => {
  it("defaults to enabled", () => {
    expect(DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG.enabled).toBe(true);
    expect(normalizePlaygroundEdgeMaskConfig(undefined)).toEqual(DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG);
    expect(normalizePlaygroundEdgeMaskConfig({}).enabled).toBe(true);
  });

  it("returns full mask alpha when disabled", () => {
    expect(resolveEdgeMaskAlpha(0, 0, { enabled: false, start: 0, end: 0.1, power: 1 })).toBe(1);
    expect(resolveEdgeMaskAlpha(0.5, 0.5, { enabled: false, start: 0, end: 0.1, power: 1 })).toBe(1);
  });

  it("ramps from 0 at the edge to 1 at the end inset when enabled", () => {
    const config = { enabled: true, start: 0.1, end: 0.2, power: 1 };
    expect(resolveEdgeMaskAlpha(0.05, 0.5, config)).toBe(0);
    expect(resolveEdgeMaskAlpha(0.15, 0.5, config)).toBeCloseTo(0.5, 5);
    expect(resolveEdgeMaskAlpha(0.25, 0.5, config)).toBe(1);
  });

  it("clamps end above start", () => {
    const normalized = normalizePlaygroundEdgeMaskConfig({ enabled: true, start: 0.3, end: 0.1 });
    expect(normalized.start).toBe(0.3);
    expect(normalized.end).toBeGreaterThan(normalized.start);
  });

  it("clamps power into the [0.1, 4] range", () => {
    expect(normalizePlaygroundEdgeMaskConfig({ power: 100 }).power).toBe(4);
    expect(normalizePlaygroundEdgeMaskConfig({ power: 0 }).power).toBe(0.1);
  });

  it("detects default vs non-default config", () => {
    expect(isDefaultPlaygroundEdgeMaskConfig(DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG)).toBe(true);
    expect(isDefaultPlaygroundEdgeMaskConfig({ ...DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG, enabled: false })).toBe(false);
    expect(isDefaultPlaygroundEdgeMaskConfig({ ...DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG, end: 0.2 })).toBe(false);
  });
});
