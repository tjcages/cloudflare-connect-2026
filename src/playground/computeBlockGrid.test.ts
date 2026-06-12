import { describe, expect, it } from "vitest";
import { computeBlockGrid } from "./computeBlockGrid";
import { DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS } from "./playgroundTextureAdjustments";

/** Build an RGBA buffer where a left/right split is white/black. */
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

function pixelRow(colors: Array<[number, number, number]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(colors.length * 4);
  colors.forEach(([r, g, b], index) => {
    const offset = index * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  });
  return data;
}

describe("computeBlockGrid cell sizing", () => {
  it("defaults to 7px cells", () => {
    const data = splitImage(14, 7, 14);
    const grid = computeBlockGrid(data, 14, 7);
    expect(grid.cols).toBe(2);
    expect(grid.rows).toBe(1);
  });

  it("derives cols/rows from custom cell dimensions", () => {
    const data = splitImage(10, 8, 10);
    const grid = computeBlockGrid(data, 10, 8, 1, 5, 4);
    expect(grid.cols).toBe(2);
    expect(grid.rows).toBe(2);
  });

  it("averages luminance per cell at a custom cell size", () => {
    const data = splitImage(4, 2, 2);
    const grid = computeBlockGrid(data, 4, 2, 1, 2, 2);
    expect(grid.cols).toBe(2);
    expect(grid.rows).toBe(1);
    expect(grid.luma[0]).toBe(255);
    expect(grid.luma[1]).toBe(0);
  });

  it("inverts per-cell luma for overlay stripe bucketing", () => {
    const data = splitImage(4, 2, 2);
    const grid = computeBlockGrid(data, 4, 2, 1, 2, 2, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, undefined, {
      mode: "overlay",
      backgroundColor: 0xffffff,
    });
    expect(grid.luma[0]).toBe(0);
    expect(grid.luma[1]).toBe(255);
  });

  it("produces a finer grid as the cell shrinks", () => {
    const data = splitImage(12, 12, 6);
    const coarse = computeBlockGrid(data, 12, 12, 1, 12, 12);
    const fine = computeBlockGrid(data, 12, 12, 1, 3, 3);
    expect(coarse.cols).toBe(1);
    expect(fine.cols).toBe(4);
    expect(fine.rows).toBe(4);
  });

  it("applies texture adjustments before luma values are stored", () => {
    const data = splitImage(1, 1, 1);
    const grid = computeBlockGrid(data, 1, 1, 1, 1, 1, {
      ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      invert: true,
    });

    expect(grid.luma[0]).toBe(0);
  });

  it("derives colors-mode cell luma from saturated pixels on the texture background", () => {
    const data = pixelRow([
      [0, 0, 128],
      [255, 255, 255],
    ]);
    const grid = computeBlockGrid(data, 2, 1, 1, 1, 1, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, undefined, {
      mode: "colors",
      backgroundColor: 0xffffff,
    });

    expect(grid.luma[0]).toBeGreaterThan(0);
    expect(grid.luma[1]).toBe(0);
    expect(grid.colors[0]).toBe(0);
    expect(grid.colors[1]).toBe(0);
    expect(grid.colors[2]).toBe(128);
  });

  it("detects black foreground on a white background in colors mode", () => {
    const data = pixelRow([
      [0, 0, 0],
      [255, 255, 255],
    ]);
    const grid = computeBlockGrid(data, 2, 1, 1, 1, 1, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, undefined, {
      mode: "colors",
      backgroundColor: 0xffffff,
    });

    expect(grid.luma[0]).toBeGreaterThan(0);
    expect(grid.luma[1]).toBe(0);
    expect(Array.from(grid.colors.slice(0, 3))).toEqual([0, 0, 0]);
    expect(grid.colorCoverage?.[0] ?? 0).toBeGreaterThan(0);
  });

  it("stores presence-weighted non-background color for each sampled cell", () => {
    const data = pixelRow([
      [255, 0, 0],
      [0, 0, 255],
    ]);
    const grid = computeBlockGrid(data, 2, 1, 1, 1, 1, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, undefined, {
      mode: "colors",
      backgroundColor: 0x000000,
    });

    expect(Array.from(grid.colors)).toEqual([255, 0, 0, 0, 0, 255]);
  });

  it("tints sparse foreground color toward the texture background", () => {
    const data = pixelRow([
      [255, 0, 0],
      [0, 0, 0],
    ]);
    const grid = computeBlockGrid(data, 2, 1, 1, 2, 1, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, undefined, {
      mode: "colors",
      backgroundColor: 0x000000,
    });

    expect(grid.cols).toBe(1);
    expect(Array.from(grid.colors.slice(0, 3))).toEqual([128, 0, 0]);
    expect(grid.colorCoverage?.[0]).toBeGreaterThan(0);
    expect(grid.colorCoverage?.[0]).toBeLessThan(255);
  });

  it("applies texture tone adjustments to colors-mode cell fill", () => {
    const data = pixelRow([[200, 100, 50]]);
    const raw = computeBlockGrid(data, 1, 1, 1, 1, 1, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, undefined, {
      mode: "colors",
      backgroundColor: 0xffffff,
    });
    const adjusted = computeBlockGrid(
      data,
      1,
      1,
      1,
      1,
      1,
      { ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, contrast: 2 },
      undefined,
      {
        mode: "colors",
        backgroundColor: 0xffffff,
      },
    );

    expect(Array.from(raw.colors)).not.toEqual(Array.from(adjusted.colors));
  });

  it("keeps sparse red on a white background light instead of saturated", () => {
    const sparse = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < sparse.length; i += 4) {
      sparse[i] = 255;
      sparse[i + 1] = 255;
      sparse[i + 2] = 255;
      sparse[i + 3] = 255;
    }
    sparse[0] = 255;
    sparse[1] = 0;
    sparse[2] = 0;

    const grid = computeBlockGrid(sparse, 4, 4, 1, 4, 4, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, undefined, {
      mode: "colors",
      backgroundColor: 0xffffff,
    });

    expect(grid.colors[0]).toBe(255);
    expect(grid.colors[1]).toBeGreaterThan(235);
    expect(grid.colors[2]).toBeGreaterThan(235);
  });

  it("stores lower color coverage when only a small part of the cell has color", () => {
    const sparse = new Uint8ClampedArray(4 * 4);
    sparse[0] = 255;
    sparse[3] = 255;
    const sparseGrid = computeBlockGrid(
      sparse,
      4,
      4,
      1,
      4,
      4,
      DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      undefined,
      {
        mode: "colors",
        backgroundColor: 0x000000,
      },
    );

    const dense = new Uint8ClampedArray(4);
    dense[0] = 255;
    dense[3] = 255;
    const denseGrid = computeBlockGrid(
      dense,
      1,
      1,
      1,
      1,
      1,
      DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      undefined,
      {
        mode: "colors",
        backgroundColor: 0x000000,
      },
    );

    expect(sparseGrid.colorCoverage?.[0] ?? 0).toBeLessThan(denseGrid.colorCoverage?.[0] ?? 0);
  });

  it("bleeds blurred color into neighboring cells in colors mode", () => {
    const data = new Uint8ClampedArray(3 * 3 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
    data[(1 * 3 + 1) * 4] = 255;
    data[(1 * 3 + 1) * 4 + 1] = 0;
    data[(1 * 3 + 1) * 4 + 2] = 0;

    const grid = computeBlockGrid(
      data,
      3,
      3,
      1,
      1,
      1,
      { ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, blurRadius: 1 },
      undefined,
      {
        mode: "colors",
        backgroundColor: 0xffffff,
      },
    );

    expect(grid.colors?.[1 * 3]).toBeGreaterThan(200);
    expect(grid.colors?.[1 * 3 + 1]).toBeLessThan(255);
    expect(grid.colors?.[1 * 3 + 2]).toBeLessThan(255);
  });

  it("applies pixel blur to colors-mode cell fill", () => {
    const data = splitImage(3, 1, 1);
    const sharp = computeBlockGrid(data, 3, 1, 1, 1, 1, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, undefined, {
      mode: "colors",
      backgroundColor: 0x000000,
    });
    const blurred = computeBlockGrid(
      data,
      3,
      1,
      1,
      1,
      1,
      { ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, blurRadius: 1 },
      undefined,
      {
        mode: "colors",
        backgroundColor: 0x000000,
      },
    );

    expect(Array.from(sharp.colors)).not.toEqual(Array.from(blurred.colors));
  });

  it("applies grid-level blur to luma cells", () => {
    const data = splitImage(3, 1, 1);
    const grid = computeBlockGrid(data, 3, 1, 1, 1, 1, {
      ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      blurRadius: 1,
    });

    expect(Array.from(grid.luma)).toEqual([128, 85, 0]);
  });

  it("adds masked flame luminance without changing source pixels", () => {
    const data = splitImage(2, 1, 0);
    const flames = new Uint8ClampedArray(2 * 1 * 4);
    flames[0] = 255;
    flames[1] = 255;
    flames[2] = 255;
    flames[3] = 255;

    const unmasked = computeBlockGrid(data, 2, 1, 1, 1, 1, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, {
      pixels: flames,
      imageWidth: 2,
      imageHeight: 1,
      mask: { edgeMaskEnabled: false, edgeMaskStart: 0, edgeMaskEnd: 0.1, edgeMaskPower: 1 },
    });
    const masked = computeBlockGrid(data, 2, 1, 1, 1, 1, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS, {
      pixels: flames,
      imageWidth: 2,
      imageHeight: 1,
      mask: { edgeMaskEnabled: true, edgeMaskStart: 0, edgeMaskEnd: 0.5, edgeMaskPower: 1 },
    });

    expect(unmasked.luma[0]).toBe(255);
    expect(masked.luma[0]).toBe(0);
    expect(unmasked.luma[1]).toBe(0);
    expect(masked.luma[1]).toBe(0);
  });

  it("composites flame rgb into cell colors in colors mode on background pixels", () => {
    const data = splitImage(2, 1, 0);
    const flames = new Uint8ClampedArray(2 * 1 * 4);
    flames[0] = 255;
    flames[1] = 40;
    flames[2] = 20;
    flames[3] = 255;

    const grid = computeBlockGrid(
      data,
      2,
      1,
      1,
      1,
      1,
      DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      {
        pixels: flames,
        imageWidth: 2,
        imageHeight: 1,
        mask: { edgeMaskEnabled: false, edgeMaskStart: 0, edgeMaskEnd: 0.1, edgeMaskPower: 1 },
      },
      {
        mode: "colors",
        backgroundColor: 0x000000,
      },
    );

    expect(grid.luma[0]).toBeGreaterThan(0);
    expect(grid.colors[0]).toBe(255);
    expect(grid.colors[1]).toBe(40);
    expect(grid.colors[2]).toBe(20);
  });

  it("blends flames over white background pixels in colors mode", () => {
    const data = splitImage(1, 1, 1);
    const flames = new Uint8ClampedArray(4);
    flames[0] = 255;
    flames[1] = 40;
    flames[2] = 20;

    const grid = computeBlockGrid(
      data,
      1,
      1,
      1,
      1,
      1,
      DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      {
        pixels: flames,
        imageWidth: 1,
        imageHeight: 1,
        mask: { edgeMaskEnabled: false, edgeMaskStart: 0, edgeMaskEnd: 0.1, edgeMaskPower: 1 },
      },
      {
        mode: "colors",
        backgroundColor: 0xffffff,
      },
    );

    expect(grid.luma[0]).toBeGreaterThan(0);
    expect(grid.colors[0]).toBe(255);
    expect(grid.colors[1]).toBe(40);
    expect(grid.colors[2]).toBe(20);
  });

  it("uses peak cell luma when flames touch a background cell so thin streaks stay visible", () => {
    const size = 7;
    const data = new Uint8ClampedArray(size * size * 4);
    const flames = new Uint8ClampedArray(size * size * 4);
    const centerOffset = (3 * size + 3) * 4;
    flames[centerOffset] = 255;
    flames[centerOffset + 1] = 40;
    flames[centerOffset + 2] = 20;

    const grid = computeBlockGrid(
      data,
      size,
      size,
      1,
      size,
      size,
      DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      {
        pixels: flames,
        imageWidth: size,
        imageHeight: size,
        mask: { edgeMaskEnabled: false, edgeMaskStart: 0, edgeMaskEnd: 0.1, edgeMaskPower: 1 },
      },
      {
        mode: "colors",
        backgroundColor: 0x000000,
      },
    );

    expect(grid.luma[0]).toBeGreaterThan(31);
    expect(grid.colors[0]).toBe(255);
    expect(grid.colors[1]).toBe(40);
    expect(grid.colors[2]).toBe(20);
  });
});
