import { describe, expect, it } from "vitest";
import {
  PLAYGROUND_DEFAULT_DISPLAY_MAX_WIDTH,
  resolveDefaultPlaygroundDisplaySize,
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
