import { describe, expect, it } from "vitest";
import {
  computeBlockGrid,
  computeBlockGridRegion,
  createGridPreprocessCache,
  patchGridPreprocessRegion,
} from "./computeBlockGrid";
import { pixelBoundsToCellRegion } from "./playgroundGridDirty";
import { DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS } from "./playgroundTextureAdjustments";

function splitImage(width: number, height: number, whiteCols: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const value = x < whiteCols ? 255 : 0;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return data;
}

describe("computeBlockGridRegion", () => {
  it("matches full-grid output inside the dirty region", () => {
    const width = 14;
    const height = 14;
    const pixels = splitImage(width, height, 7);
    const full = computeBlockGrid(pixels, width, height, 1, 7, 7, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS);
    const region = pixelBoundsToCellRegion(
      { dirtyMinX: 0, dirtyMinY: 0, dirtyMaxX: 6, dirtyMaxY: 6 },
      7,
      7,
      width,
      height,
      0,
    )!;

    const partial = computeBlockGridRegion(
      pixels,
      width,
      height,
      region,
      full,
      1,
      7,
      7,
      DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
    );

    for (let row = region.rowMin; row <= region.rowMax; row++) {
      for (let col = region.colMin; col <= region.colMax; col++) {
        const index = row * full.cols + col;
        expect(partial.luma[index]).toBe(full.luma[index]);
        expect(partial.colors[index * 3]).toBe(full.colors[index * 3]);
        expect(partial.colors[index * 3 + 1]).toBe(full.colors[index * 3 + 1]);
        expect(partial.colors[index * 3 + 2]).toBe(full.colors[index * 3 + 2]);
      }
    }
  });

  it("preserves untouched cells outside the dirty region", () => {
    const width = 14;
    const height = 14;
    const dark = splitImage(width, height, 0);
    const bright = splitImage(width, height, 14);
    const previous = computeBlockGrid(dark, width, height, 1, 7, 7, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS);
    const region = pixelBoundsToCellRegion(
      { dirtyMinX: 7, dirtyMinY: 0, dirtyMaxX: 13, dirtyMaxY: 13 },
      7,
      7,
      width,
      height,
      0,
    )!;

    const partial = computeBlockGridRegion(
      bright,
      width,
      height,
      region,
      previous,
      1,
      7,
      7,
      DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
    );

    expect(partial.luma[0]).toBe(previous.luma[0]);
    expect(partial.luma[1]).not.toBe(previous.luma[1]);
  });

  it("matches full-grid output when reusing a patched preprocess cache", () => {
    const width = 14;
    const height = 14;
    const dark = splitImage(width, height, 0);
    const bright = splitImage(width, height, 14);
    const full = computeBlockGrid(bright, width, height, 1, 7, 7, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS);
    const region = pixelBoundsToCellRegion(
      { dirtyMinX: 7, dirtyMinY: 0, dirtyMaxX: 13, dirtyMaxY: 13 },
      7,
      7,
      width,
      height,
      0,
    )!;
    const cache = createGridPreprocessCache(dark, width, height, 1, 7, 7, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS);
    patchGridPreprocessRegion(cache, bright, width, height, {
      dirtyMinX: 7,
      dirtyMinY: 0,
      dirtyMaxX: 13,
      dirtyMaxY: 13,
    });

    const partial = computeBlockGridRegion(
      bright,
      width,
      height,
      region,
      computeBlockGrid(dark, width, height, 1, 7, 7, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS),
      1,
      7,
      7,
      DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      undefined,
      undefined,
      undefined,
      cache,
      { dirtyMinX: 7, dirtyMinY: 0, dirtyMaxX: 13, dirtyMaxY: 13 },
    );

    for (let row = region.rowMin; row <= region.rowMax; row++) {
      for (let col = region.colMin; col <= region.colMax; col++) {
        const index = row * full.cols + col;
        expect(partial.luma[index]).toBe(full.luma[index]);
      }
    }
  });
});
