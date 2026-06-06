import { describe, expect, it, vi } from "vitest";
import * as playgroundFlames from "./playgroundFlames";
import { createPlaygroundFlamesState } from "./playgroundFlames";
import { DEFAULT_PLAYGROUND_FLAMES_CONFIG } from "./playgroundFlamesConfig";
import { buildPlaygroundBlockGrid, sampleTextureFrame } from "./samplePlaygroundFrame";
import { buildStripeColors } from "./stripeColors";

function createBlackSourceCanvas(): HTMLCanvasElement {
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = 1;
  sourceCanvas.height = 1;
  const sourceCtx = sourceCanvas.getContext("2d");
  expect(sourceCtx).not.toBeNull();
  sourceCtx!.fillStyle = "#000000";
  sourceCtx!.fillRect(0, 0, 1, 1);
  return sourceCanvas;
}

function createSolidImageData(width: number, height: number, rgb: [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    data[offset] = rgb[0];
    data[offset + 1] = rgb[1];
    data[offset + 2] = rgb[2];
    data[offset + 3] = 255;
  }
  return { data, width, height } as ImageData;
}

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

  it("applies flames during block-grid luminance, not during source sampling", () => {
    const displayWidth = 28;
    const displayHeight = 28;
    const sourceCanvas = createBlackSourceCanvas();
    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    expect(sampleCtx).not.toBeNull();

    const flamesState = createPlaygroundFlamesState();
    const flamesConfig = { ...DEFAULT_PLAYGROUND_FLAMES_CONFIG, enabled: true };
    const flameRaster = createSolidImageData(displayWidth, displayHeight, [0, 0, 0]);
    for (let row = 0; row < displayHeight; row++) {
      for (let col = 10; col < 18; col++) {
        const offset = (row * displayWidth + col) * 4;
        flameRaster.data[offset] = 255;
        flameRaster.data[offset + 1] = 255;
        flameRaster.data[offset + 2] = 255;
      }
    }

    const rasterSpy = vi.spyOn(playgroundFlames, "rasterizePlaygroundFlames").mockReturnValue(flameRaster);

    const frame = sampleTextureFrame(sourceCanvas, displayWidth, displayHeight, sampleCanvas, sampleCtx!);
    expect(frame).not.toBeNull();

    const colors = buildStripeColors();
    const withoutFlames = buildPlaygroundBlockGrid(frame!, displayWidth, displayHeight, colors, {});
    const withFlames = buildPlaygroundBlockGrid(frame!, displayWidth, displayHeight, colors, {}, 1, {
      flamesState,
      flamesConfig,
    });

    expect(rasterSpy).toHaveBeenCalledWith(flamesState, flamesConfig, displayWidth, displayHeight);
    expect([...withFlames.grid.indices]).not.toEqual([...withoutFlames.grid.indices]);

    rasterSpy.mockRestore();
  });

  it("shifts stripe indices when the sampled frame is brighter in flame-covered cells", () => {
    const displayWidth = 28;
    const displayHeight = 28;
    const colors = buildStripeColors();
    const darkFrame = createSolidImageData(displayWidth, displayHeight, [0, 0, 0]);
    const brightFrame = createSolidImageData(displayWidth, displayHeight, [0, 0, 0]);

    for (let row = 0; row < displayHeight; row++) {
      for (let col = 10; col < 18; col++) {
        const offset = (row * displayWidth + col) * 4;
        brightFrame.data[offset] = 255;
        brightFrame.data[offset + 1] = 255;
        brightFrame.data[offset + 2] = 255;
      }
    }

    const baselineGrid = buildPlaygroundBlockGrid(darkFrame, displayWidth, displayHeight, colors, {});
    const brightGrid = buildPlaygroundBlockGrid(brightFrame, displayWidth, displayHeight, colors, {});

    expect([...brightGrid.grid.indices]).not.toEqual([...baselineGrid.grid.indices]);
  });
});
