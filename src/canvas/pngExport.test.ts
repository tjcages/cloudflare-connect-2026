import { afterEach, describe, expect, it, vi } from "vitest";
import { copyDocumentPng, createDocumentPngBlob } from "./pngExport";
import { STROKE_COLOR, type GeneratedGrid } from "../grid/types";

const grid: GeneratedGrid = {
  config: {
    seed: "test",
    width: 80,
    height: 80,
    density: 0.5,
    smallCellRatio: 0.5,
    largeCellRatio: 0.5,
    strokeColor: STROKE_COLOR,
    gapMask: [],
    logicalWidth: 80,
    logicalHeight: 80,
    renderWidth: 81,
    renderHeight: 81,
    columns: 2,
    rows: 2,
  },
  cells: [],
};

const context = {
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  roundRect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
} as unknown as CanvasRenderingContext2D;

describe("pngExport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates PNG blobs at the requested export scale", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function toBlob(
      this: HTMLCanvasElement,
      callback,
    ) {
      expect(this.width).toBe(160);
      expect(this.height).toBe(160);
      callback(blob);
    });

    await expect(createDocumentPngBlob({ grid, instances: [], scale: 2 })).resolves.toBe(blob);
  });

  it("writes PNG blobs to the clipboard when image clipboard support exists", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const write = vi.fn().mockResolvedValue(undefined);
    const ClipboardItemMock = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(blob));
    vi.stubGlobal("navigator", {
      clipboard: {
        write,
      },
    });
    vi.stubGlobal("ClipboardItem", ClipboardItemMock);

    await copyDocumentPng({ grid, instances: [], scale: 1 });

    expect(ClipboardItemMock).toHaveBeenCalledWith({
      "image/png": blob,
    });
    expect(write).toHaveBeenCalledWith([expect.any(ClipboardItemMock)]);
  });
});
