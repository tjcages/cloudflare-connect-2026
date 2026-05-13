import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ICON_ID, getIconDefinition } from "../../../components/iconRegistry";
import { ICON_RASTER_SCALE, rasterizeIcon } from "./iconRaster";

describe("rasterizeIcon", () => {
  const originalCreateElement = document.createElement.bind(document);
  const originalPath2D = globalThis.Path2D;

  afterEach(() => {
    document.createElement = originalCreateElement;
    globalThis.Path2D = originalPath2D;
    vi.restoreAllMocks();
  });

  it("draws icon paths into a supersampled canvas for smoother downsampling", () => {
    const scale = vi.fn();
    const translate = vi.fn();
    const fill = vi.fn();
    const ctx = {
      scale,
      translate,
      fill,
      fillStyle: "",
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
    };
    const pathCtor = vi.fn();
    class MockPath2D {
      constructor(public readonly d: string) {
        pathCtor(d);
      }
    }

    document.createElement = vi.fn(() => canvas as unknown as HTMLCanvasElement) as typeof document.createElement;
    globalThis.Path2D = MockPath2D as unknown as typeof Path2D;

    const icon = getIconDefinition(DEFAULT_ICON_ID);
    const result = rasterizeIcon(icon, "#9C37FF");

    expect(result).toBe(canvas);
    expect(canvas.width).toBe(24 * ICON_RASTER_SCALE);
    expect(canvas.height).toBe(24 * ICON_RASTER_SCALE);
    expect(scale).toHaveBeenCalledWith(ICON_RASTER_SCALE, ICON_RASTER_SCALE);
    expect(translate).toHaveBeenCalledWith(0, 0);
    expect(ctx.fillStyle).toBe("#9C37FF");
    expect(pathCtor).toHaveBeenCalledTimes(icon.paths.length);
    expect(fill).toHaveBeenCalledTimes(icon.paths.length);
  });
});
