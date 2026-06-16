import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeBlockGrid } from "./computeBlockGrid";
import { buildStripeColors, resolveStripeIndices, resolveStripesForLuminanceMode } from "./stripeColors";
const ROOT = process.cwd();

function activeBandCount(indices: Uint8Array): number {
  return new Set([...indices].filter((index) => index > 0)).size;
}

describe("export parity: example10 vs example5", () => {
  it("maps example10 to many stripe bands while example5 frames stay sparse", () => {
    const colors = buildStripeColors();
    const stripes = resolveStripesForLuminanceMode(colors, "luminance");

    const ex10Path = join(ROOT, ".tmp/ex10.raw");
    expect(existsSync(ex10Path), "run ffmpeg to create .tmp/ex10.raw first").toBe(true);
    const ex10Buf = readFileSync(ex10Path);
    const ex10Pixels = new Uint8ClampedArray(ex10Buf.buffer, ex10Buf.byteOffset, ex10Buf.byteLength);
    const ex10Grid = computeBlockGrid(ex10Pixels, 1024, 512);
    const ex10Indices = resolveStripeIndices(ex10Grid.luma, stripes);
    const ex5Path = join(ROOT, ".tmp/example5-t5.raw");
    expect(existsSync(ex5Path)).toBe(true);
    const ex5Buf = readFileSync(ex5Path);
    const ex5Pixels = new Uint8ClampedArray(ex5Buf.buffer, ex5Buf.byteOffset, ex5Buf.byteLength);
    const ex5Grid = computeBlockGrid(ex5Pixels, 848, 480);
    const ex5Indices = resolveStripeIndices(ex5Grid.luma, stripes);
    expect(activeBandCount(ex10Indices)).toBeGreaterThan(3);
    expect(activeBandCount(ex5Indices)).toBeLessThanOrEqual(2);
    expect(Math.max(...ex5Indices)).toBeLessThanOrEqual(2);
  });

  it("uses brighter example5 seconds for upper palette bands but most cells stay background", () => {
    const colors = buildStripeColors();
    const stripes = resolveStripesForLuminanceMode(colors, "luminance");
    let richestSecond = -1;
    let richestBands = 0;

    for (let second = 0; second < 20; second += 1) {
      const rawPath = join(ROOT, `.tmp/example5-t${second}.raw`);
      if (!existsSync(rawPath)) {
        continue;
      }
      const buf = readFileSync(rawPath);
      const pixels = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength);
      const lumaGrid = computeBlockGrid(pixels, 848, 480);
      const indices = resolveStripeIndices(lumaGrid.luma, stripes);
      const bandCount = activeBandCount(indices);
      if (bandCount > richestBands) {
        richestBands = bandCount;
        richestSecond = second;
      }
    }

    expect(richestSecond).toBeGreaterThanOrEqual(0);
    expect(richestBands).toBeGreaterThan(3);

    const richestPath = join(ROOT, `.tmp/example5-t${richestSecond}.raw`);
    const richestBuf = readFileSync(richestPath);
    const richestPixels = new Uint8ClampedArray(richestBuf.buffer, richestBuf.byteOffset, richestBuf.byteLength);
    const richestGrid = computeBlockGrid(richestPixels, 848, 480);
    const richestIndices = resolveStripeIndices(richestGrid.luma, stripes);
    const activeCells = richestIndices.filter((index) => index > 0).length;
    const totalCells = richestIndices.length;

    expect(activeCells / totalCells).toBeLessThan(0.2);
  });
});
