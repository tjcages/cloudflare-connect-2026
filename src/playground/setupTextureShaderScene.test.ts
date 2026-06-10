import { describe, expect, it } from "vitest";
import {
  PLAYGROUND_DEFAULT_DISPLAY_MAX_WIDTH,
  resolveDefaultPlaygroundDisplaySize,
  resolvePlaygroundDisplaySize,
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
