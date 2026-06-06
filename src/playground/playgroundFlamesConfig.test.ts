import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_FLAMES_CONFIG,
  isDefaultPlaygroundFlamesConfig,
  normalizePlaygroundFlamesConfig,
  normalizePlaygroundFlamesDirection,
  resolveFlamesGradientStops,
  resolveFlamesSpeedRange,
} from "./playgroundFlamesConfig";

describe("playgroundFlamesConfig", () => {
  it("returns defaults when input is undefined", () => {
    expect(normalizePlaygroundFlamesConfig(undefined)).toEqual(DEFAULT_PLAYGROUND_FLAMES_CONFIG);
  });

  it("clamps max width/height to min values", () => {
    const normalized = normalizePlaygroundFlamesConfig({
      minWidthRatio: 0.05,
      maxWidthRatio: 0.01,
      minHeightRatio: 0.04,
      maxHeightRatio: 0.02,
    });
    expect(normalized.maxWidthRatio).toBeGreaterThanOrEqual(normalized.minWidthRatio);
    expect(normalized.maxHeightRatio).toBeGreaterThanOrEqual(normalized.minHeightRatio);
  });

  it("detects non-default config", () => {
    expect(isDefaultPlaygroundFlamesConfig(DEFAULT_PLAYGROUND_FLAMES_CONFIG)).toBe(true);
    expect(isDefaultPlaygroundFlamesConfig({ ...DEFAULT_PLAYGROUND_FLAMES_CONFIG, enabled: true })).toBe(false);
    expect(isDefaultPlaygroundFlamesConfig({ ...DEFAULT_PLAYGROUND_FLAMES_CONFIG, maxActive: 24 })).toBe(false);
    expect(isDefaultPlaygroundFlamesConfig({ ...DEFAULT_PLAYGROUND_FLAMES_CONFIG, direction: "right" })).toBe(false);
  });

  it("normalizes invalid flame directions to up", () => {
    expect(normalizePlaygroundFlamesDirection("right")).toBe("right");
    expect(normalizePlaygroundFlamesDirection("sideways")).toBe("up");
    expect(normalizePlaygroundFlamesConfig({ direction: "left" }).direction).toBe("left");
  });

  it("resolves speed range from base speed and variation", () => {
    const range = resolveFlamesSpeedRange({
      ...DEFAULT_PLAYGROUND_FLAMES_CONFIG,
      baseSpeedPxPerSec: 100,
      speedVariation: 0.5,
    });
    expect(range.minPxPerSec).toBe(75);
    expect(range.maxPxPerSec).toBe(125);
  });

  it("sharpens gradient stops as edge sharpness increases", () => {
    const soft = resolveFlamesGradientStops(0);
    const sharp = resolveFlamesGradientStops(1);
    expect(sharp.outer - sharp.inner).toBeLessThan(soft.outer - soft.inner);
  });
});
