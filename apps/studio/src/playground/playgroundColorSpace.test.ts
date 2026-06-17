import { describe, expect, it } from "vitest";
import { supportsDisplayP3 } from "../theme/colorSpace";
import { createPlaygroundWebGLContext, playgroundPrefersDisplayP3, readCanvasColorSpace } from "./playgroundColorSpace";

describe("playgroundColorSpace", () => {
  it("readCanvasColorSpace defaults to srgb when unset", () => {
    const canvas = document.createElement("canvas");
    expect(readCanvasColorSpace(canvas)).toBe("srgb");
  });

  it("playgroundPrefersDisplayP3 follows supportsDisplayP3", () => {
    const canvas = document.createElement("canvas");
    expect(playgroundPrefersDisplayP3(canvas, null)).toBe(supportsDisplayP3());
  });

  it("createPlaygroundWebGLContext returns null or a context without throwing", () => {
    const canvas = document.createElement("canvas");
    const gl = createPlaygroundWebGLContext(canvas);
    expect(gl === null || typeof gl === "object").toBe(true);
  });
});
