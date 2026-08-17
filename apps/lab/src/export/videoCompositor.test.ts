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

  it("reads the current background on every frame", async () => {
    const fillStyles: string[] = [];
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      set fillStyle(value: string) {
        fillStyles.push(value);
      },
    };
    const exportCanvas = { width: 0, height: 0, getContext: vi.fn(() => context) };
    vi.stubGlobal("document", { createElement: vi.fn(() => exportCanvas) });
    const sourceCanvas = { width: 320, height: 180 } as HTMLCanvasElement;
    let background = { transparent: false, color: 0xff0000 };
    const compositor = await createLabExportCompositor(sourceCanvas, {
      getBackground: () => background,
    });

    compositor.compositeFrame();
    background = { transparent: false, color: 0x0000ff };
    compositor.compositeFrame();

    expect(fillStyles).toEqual(["#ff0000", "#0000ff"]);
    expect(context.fillRect).toHaveBeenCalledTimes(2);
  });

  it("evaluates layer visibility on every frame", async () => {
    const drawImage = vi.fn();
    const context = {
      clearRect: vi.fn(),
      drawImage,
      fillRect: vi.fn(),
      fillStyle: "",
      save: vi.fn(),
      restore: vi.fn(),
    };
    const exportCanvas = { width: 0, height: 0, getContext: vi.fn(() => context) };
    vi.stubGlobal("document", { createElement: vi.fn(() => exportCanvas) });
    const sourceCanvas = { width: 320, height: 180 } as HTMLCanvasElement;
    const twizzlerCanvas = { width: 320, height: 180 } as HTMLCanvasElement;
    let rainVisible = false;
    const compositor = await createLabExportCompositor(sourceCanvas, {
      isSourceVisible: () => rainVisible,
      underlayLayers: [{ source: twizzlerCanvas }],
    });

    compositor.compositeFrame();
    rainVisible = true;
    compositor.compositeFrame();

    expect(drawImage.mock.calls).toEqual([
      [twizzlerCanvas, 0, 0, 320, 180],
      [twizzlerCanvas, 0, 0, 320, 180],
      [sourceCanvas, 0, 0, 320, 180],
    ]);
  });

  it("renders timeline-driven background gradients", async () => {
    const addColorStop = vi.fn();
    const gradient = { addColorStop };
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: "" as string | CanvasGradient,
      createLinearGradient: vi.fn(() => gradient),
    };
    const exportCanvas = { width: 0, height: 0, getContext: vi.fn(() => context) };
    vi.stubGlobal("document", { createElement: vi.fn(() => exportCanvas) });
    const sourceCanvas = { width: 320, height: 180 } as HTMLCanvasElement;
    const compositor = await createLabExportCompositor(sourceCanvas, {
      getBackground: () => ({
        transparent: false,
        color: 0,
        gradient: {
          enabled: true,
          direction: "leftToRight",
          stopCount: 3,
          stops: [0xff0000, 0x00ff00, 0x0000ff],
        },
      }),
    });

    compositor.compositeFrame();

    expect(context.createLinearGradient).toHaveBeenCalledWith(0, 0, 320, 0);
    expect(addColorStop.mock.calls).toEqual([
      [0, "#ff0000"],
      [0.5, "#00ff00"],
      [1, "#0000ff"],
    ]);
  });
});
