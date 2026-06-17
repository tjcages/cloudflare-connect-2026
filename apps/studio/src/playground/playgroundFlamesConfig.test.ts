import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_FLAMES_CONFIG,
  isDefaultPlaygroundFlamesConfig,
  normalizePlaygroundFlamesConfig,
  normalizePlaygroundFlamesDirection,
  resolveFlamesEdgeMaskAlpha,
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

  it("narrows the gradient plateau as edge sharpness increases", () => {
    const widePlateau = resolveFlamesGradientStops(0);
    const narrowPlateau = resolveFlamesGradientStops(1);
    expect(narrowPlateau.outer - narrowPlateau.inner).toBeLessThan(widePlateau.outer - widePlateau.inner);
  });

  it("clamps opacity max to opacity min", () => {
    const normalized = normalizePlaygroundFlamesConfig({
      opacityMin: 0.8,
      opacityMax: 0.2,
    });
    expect(normalized.opacityMin).toBe(0.8);
    expect(normalized.opacityMax).toBe(0.8);
  });

  it("ramps edge mask alpha from start to end inset", () => {
    const config = {
      edgeMaskEnabled: true,
      edgeMaskStart: 0.1,
      edgeMaskEnd: 0.2,
      edgeMaskPower: 1,
    };
    expect(resolveFlamesEdgeMaskAlpha(0.05, 0.5, config)).toBe(0);
    expect(resolveFlamesEdgeMaskAlpha(0.15, 0.5, config)).toBeCloseTo(0.5, 5);
    expect(resolveFlamesEdgeMaskAlpha(0.25, 0.5, config)).toBe(1);
  });

  it("returns full mask alpha when edge mask is disabled", () => {
    expect(
      resolveFlamesEdgeMaskAlpha(0, 0, {
        edgeMaskEnabled: false,
        edgeMaskStart: 0,
        edgeMaskEnd: 0.1,
        edgeMaskPower: 1,
      }),
    ).toBe(1);
  });
});
