import { describe, expect, it, vi } from "vitest";
import type { Application } from "pixi.js";
import { playgroundCanvasToExportSvg } from "./playgroundCanvasExportSvg";

describe("playgroundCanvasToExportSvg", () => {
  it("embeds the canvas PNG as a full-frame SVG image", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,canvas-test");

    const canvas = document.createElement("canvas");
    canvas.width = 1696;
    canvas.height = 960;

    const svg = await playgroundCanvasToExportSvg(canvas, 848, 480);
    expect(svg).toContain('width="848"');
    expect(svg).toContain('height="480"');
    expect(svg).toContain('href="data:image/png;base64,canvas-test"');
  });

  it("uses Pixi extract for stable WebGL frame capture", async () => {
    const toDataUrlSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/png;base64,from-extract");
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(performance.now());
      return 1;
    });

    const extractedCanvas = document.createElement("canvas");
    extractedCanvas.width = 320;
    extractedCanvas.height = 180;
    const render = vi.fn();
    const image = vi.fn(async () => extractedCanvas);
    const app = {
      stage: {},
      renderer: {
        render,
        extract: { image },
      },
    } as unknown as Application;

    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;

    const svg = await playgroundCanvasToExportSvg(canvas, 320, 180, app);
    expect(render).toHaveBeenCalledWith(app.stage);
    expect(image).toHaveBeenCalledWith(
      expect.objectContaining({
        target: app.stage,
        format: "png",
        resolution: 1,
      }),
    );
    expect(toDataUrlSpy).toHaveBeenCalled();
    expect(svg).toContain('href="data:image/png;base64,from-extract"');

    rafSpy.mockRestore();
  });
});
