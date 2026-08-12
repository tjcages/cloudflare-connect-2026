import { afterEach, describe, expect, it, vi } from "vitest";
import { createLabExportCompositor } from "./videoCompositor";

describe("createLabExportCompositor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws underlays, then the engine canvas, then overlays", async () => {
    const drawImage = vi.fn();
    const context = {
      clearRect: vi.fn(),
      drawImage,
      fillRect: vi.fn(),
      fillStyle: "",
    };
    const exportCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    };
    vi.stubGlobal("document", {
      createElement: vi.fn(() => exportCanvas),
    });

    const sourceCanvas = { width: 320, height: 180 } as HTMLCanvasElement;
    const twizzlerCanvas = { width: 320, height: 180 } as HTMLCanvasElement;
    const framesCanvas = { width: 320, height: 180 } as HTMLCanvasElement;
    const compositor = await createLabExportCompositor(sourceCanvas, {
      underlayCanvases: [twizzlerCanvas],
      overlayCanvases: [framesCanvas],
    });

    compositor.compositeFrame();

    expect(drawImage.mock.calls).toEqual([
      [twizzlerCanvas, 0, 0, 320, 180],
      [sourceCanvas, 0, 0, 320, 180],
      [framesCanvas, 0, 0, 320, 180],
    ]);
  });
});
