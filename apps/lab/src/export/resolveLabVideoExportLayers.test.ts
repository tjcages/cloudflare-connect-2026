import { describe, expect, it } from "vitest";
import { resolveLabVideoExportLayers } from "./resolveLabVideoExportLayers";

function fakeCanvas(width = 100, height = 50): HTMLCanvasElement {
  return { width, height } as HTMLCanvasElement;
}

describe("resolveLabVideoExportLayers", () => {
  const engine = fakeCanvas();
  const twizzler = fakeCanvas();
  const frames = fakeCanvas();

  it("uses Twizzler as the record source when Rain is hidden", () => {
    expect(
      resolveLabVideoExportLayers({
        engineCanvas: engine,
        twizzlerCanvas: twizzler,
        framesCanvas: frames,
        twizzlerVisible: true,
        rainVisible: false,
        framesEnabled: true,
      }),
    ).toEqual({
      canvas: twizzler,
      overlayCanvases: [frames],
    });
  });

  it("places Twizzler under the engine canvas when Rain is visible", () => {
    expect(
      resolveLabVideoExportLayers({
        engineCanvas: engine,
        twizzlerCanvas: twizzler,
        framesCanvas: frames,
        twizzlerVisible: true,
        rainVisible: true,
        framesEnabled: false,
      }),
    ).toEqual({
      canvas: engine,
      underlayCanvases: [twizzler],
    });
  });

  it("falls back to the engine canvas without Twizzler", () => {
    expect(
      resolveLabVideoExportLayers({
        engineCanvas: engine,
        twizzlerCanvas: twizzler,
        twizzlerVisible: false,
        rainVisible: false,
        framesEnabled: false,
      }),
    ).toEqual({
      canvas: engine,
    });
  });

  it("records the engine canvas for Rain-only (Twizzler off)", () => {
    expect(
      resolveLabVideoExportLayers({
        engineCanvas: engine,
        twizzlerCanvas: twizzler,
        twizzlerVisible: false,
        rainVisible: true,
        framesEnabled: false,
      }),
    ).toEqual({
      canvas: engine,
    });
  });
});
