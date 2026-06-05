import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
  isDefaultPlaygroundSourceTransform,
  normalizePlaygroundSourceTransform,
  resolvePlaygroundDrawRects,
  resolvePlaygroundSourceRect,
} from "./playgroundSourceTransform";

describe("playground source transform", () => {
  it("normalizes fit mode, zoom, and pan controls", () => {
    expect(
      normalizePlaygroundSourceTransform({
        fit: "cover",
        zoom: 20,
        panX: -4,
        panY: 4,
      }),
    ).toEqual({
      fit: "cover",
      zoom: 8,
      panX: -1,
      panY: 1,
    });
  });

  it("detects default-equivalent transform configs", () => {
    expect(isDefaultPlaygroundSourceTransform(DEFAULT_PLAYGROUND_SOURCE_TRANSFORM)).toBe(true);
    expect(isDefaultPlaygroundSourceTransform({ ...DEFAULT_PLAYGROUND_SOURCE_TRANSFORM, fit: "cover" })).toBe(false);
  });

  it("keeps stretch sampling over the full source", () => {
    const rect = resolvePlaygroundSourceRect(
      { width: 1920, height: 1080 },
      { width: 640, height: 640 },
      DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
    );

    expect(rect).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });

  it("applies zoom and pan when stretching the source", () => {
    const rect = resolvePlaygroundSourceRect(
      { width: 1920, height: 1080 },
      { width: 640, height: 640 },
      { fit: "stretch", zoom: 2, panX: 1, panY: -1 },
    );

    expect(rect).toEqual({ sx: 960, sy: 0, sw: 960, sh: 540 });
  });

  it("resolves cover crop with pan and zoom", () => {
    const rect = resolvePlaygroundSourceRect(
      { width: 1920, height: 1080 },
      { width: 640, height: 640 },
      { fit: "cover", zoom: 2, panX: 1, panY: -1 },
    );

    expect(rect.sx).toBeCloseTo(1380, 5);
    expect(rect.sy).toBeCloseTo(0, 5);
    expect(rect.sw).toBeCloseTo(540, 5);
    expect(rect.sh).toBeCloseTo(540, 5);
  });

  it("resolves contain crop as letterboxed source bounds", () => {
    const rect = resolvePlaygroundSourceRect(
      { width: 1920, height: 1080 },
      { width: 640, height: 640 },
      { fit: "contain", zoom: 1, panX: 0, panY: 0 },
    );

    expect(rect).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });

  it("resolves contain draw rect with centered letterboxing", () => {
    const rects = resolvePlaygroundDrawRects(
      { width: 1920, height: 1080 },
      { width: 640, height: 640 },
      { fit: "contain", zoom: 1, panX: 0, panY: 0 },
    );

    expect(rects.source).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
    expect(rects.destination).toEqual({ dx: 0, dy: 140, dw: 640, dh: 360 });
  });
});
