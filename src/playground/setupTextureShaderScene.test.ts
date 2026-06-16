import { describe, expect, it } from "vitest";
import {
  canUseCellResGridSampling,
  isShaderTextureLiveRenderNeeded,
  PLAYGROUND_DEFAULT_DISPLAY_MAX_WIDTH,
  resolveDefaultPlaygroundDisplaySize,
  resolveGridSampleDecision,
  resolvePlaygroundDisplaySize,
  resolveStripeSpriteFilters,
} from "./setupTextureShaderScene";

describe("setupTextureShaderScene display size", () => {
  it("defaults to max 1000px width while preserving aspect ratio", () => {
    expect(resolveDefaultPlaygroundDisplaySize({ width: 4000, height: 2000 })).toEqual({
      width: PLAYGROUND_DEFAULT_DISPLAY_MAX_WIDTH,
      height: 500,
    });
    expect(resolveDefaultPlaygroundDisplaySize({ width: 800, height: 600 })).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("uses persisted canvas size when provided", () => {
    expect(
      resolvePlaygroundDisplaySize({ width: 4000, height: 2000 }, { displayWidth: 640, displayHeight: 320 }),
    ).toEqual({ width: 640, height: 320 });
  });
});

describe("resolveStripeSpriteFilters", () => {
  const stripeFilter = { kind: "stripe" } as never;

  it("returns null when stripes are not active", () => {
    expect(resolveStripeSpriteFilters("preview", stripeFilter)).toBeNull();
    expect(resolveStripeSpriteFilters("off", stripeFilter)).toBeNull();
  });

  it("uses only the stripe filter in stripes mode (overlay bakes the preview texture instead of chaining filters)", () => {
    expect(resolveStripeSpriteFilters("stripes", stripeFilter)).toEqual([stripeFilter]);
  });
});

describe("resolveGridSampleDecision", () => {
  it("skips sampling while waiting for full-resample throttle window", () => {
    const decision = resolveGridSampleDecision({
      hasBuiltGrid: true,
      pendingFullResample: true,
      fullResampleReady: false,
      sourceSampleDirty: true,
      gridUpdateDue: true,
    });
    expect(decision).toEqual({
      needsSourceFrame: false,
      shouldRebuildGrid: false,
    });
  });

  it("samples when regular grid cadence is due", () => {
    const decision = resolveGridSampleDecision({
      hasBuiltGrid: true,
      pendingFullResample: false,
      fullResampleReady: false,
      sourceSampleDirty: true,
      gridUpdateDue: true,
    });
    expect(decision).toEqual({
      needsSourceFrame: true,
      shouldRebuildGrid: true,
    });
  });
});

describe("isShaderTextureLiveRenderNeeded", () => {
  it("skips per-tick shader renders in pure stripe modes where the filter replaces every pixel", () => {
    expect(
      isShaderTextureLiveRenderNeeded({ duotoneEnabled: true, stripesEnabled: true, luminanceMode: "luminance" }),
    ).toBe(false);
    expect(
      isShaderTextureLiveRenderNeeded({ duotoneEnabled: true, stripesEnabled: true, luminanceMode: "colors" }),
    ).toBe(false);
  });

  it("keeps live renders when the raw texture is visible", () => {
    expect(
      isShaderTextureLiveRenderNeeded({ duotoneEnabled: true, stripesEnabled: true, luminanceMode: "overlay" }),
    ).toBe(true);
    expect(
      isShaderTextureLiveRenderNeeded({ duotoneEnabled: true, stripesEnabled: false, luminanceMode: "luminance" }),
    ).toBe(true);
    expect(
      isShaderTextureLiveRenderNeeded({ duotoneEnabled: false, stripesEnabled: true, luminanceMode: "luminance" }),
    ).toBe(true);
  });
});

describe("canUseCellResGridSampling", () => {
  it("allows the cell-resolution fast path for luminance and overlay modes, including with flames (flames composite on the GPU in live ticks)", () => {
    expect(canUseCellResGridSampling({ revealEnabled: false, luminanceMode: "luminance" })).toBe(true);
    expect(canUseCellResGridSampling({ revealEnabled: false, luminanceMode: "overlay" })).toBe(true);
  });

  it("falls back to full-resolution sampling for display-pixel-space features", () => {
    expect(canUseCellResGridSampling({ revealEnabled: true, luminanceMode: "luminance" })).toBe(false);
    expect(canUseCellResGridSampling({ revealEnabled: false, luminanceMode: "colors" })).toBe(false);
  });
});
