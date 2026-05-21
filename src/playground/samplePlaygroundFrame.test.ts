import { describe, expect, it } from "vitest";
import { sampleTextureFrame } from "./samplePlaygroundFrame";

describe("sampleTextureFrame", () => {
  it("samples a 1×1 canvas image source into display dimensions", () => {
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = 1;
    sourceCanvas.height = 1;
    const sourceCtx = sourceCanvas.getContext("2d");
    expect(sourceCtx).not.toBeNull();
    sourceCtx!.fillStyle = "#ff0000";
    sourceCtx!.fillRect(0, 0, 1, 1);

    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    expect(sampleCtx).not.toBeNull();

    const frame = sampleTextureFrame(sourceCanvas, 4, 4, sampleCanvas, sampleCtx!);
    expect(frame).not.toBeNull();
    expect(sampleCanvas.width).toBe(4);
    expect(sampleCanvas.height).toBe(4);
    expect(frame!.data.length).toBeGreaterThan(0);
  });
});
