import { describe, expect, it } from "vitest";
import { BlockGridTexture } from "./blockGridTexture";

describe("BlockGridTexture", () => {
  it("resize updates cols and rows without replacing texture instance", () => {
    const texture = new BlockGridTexture(100, 100, 10, 10);
    const original = texture.texture;
    expect(texture.cols).toBe(10);
    expect(texture.rows).toBe(10);

    const changed = texture.resize(100, 100, 20, 20);
    expect(changed).toBe(true);
    expect(texture.cols).toBe(5);
    expect(texture.rows).toBe(5);
    expect(texture.texture).toBe(original);

    const unchanged = texture.resize(100, 100, 20, 20);
    expect(unchanged).toBe(false);
  });

  it("update writes indices when dimensions match", () => {
    const texture = new BlockGridTexture(20, 20, 10, 10);
    texture.update({
      cols: 2,
      rows: 2,
      indices: new Uint8Array([0, 1, 2, 3]),
    });
    expect(texture.cols).toBe(2);
    expect(texture.rows).toBe(2);
  });

  it("stores coverage in the block map alpha and keeps cell RGB alpha at 255", () => {
    const texture = new BlockGridTexture(10, 10, 10, 10);
    texture.update({
      cols: 1,
      rows: 1,
      indices: new Uint8Array([1]),
      colors: new Uint8Array([255, 0, 0]),
      colorCoverage: new Uint8Array([64]),
    });

    const blockImageData = (texture as unknown as { imageData: ImageData }).imageData;
    const colorImageData = (texture as unknown as { colorImageData: ImageData }).colorImageData;
    expect(blockImageData.data[3]).toBe(64);
    expect(colorImageData.data[3]).toBe(255);
  });

  it("stores luma in the G channel of the block grid texture", () => {
    const texture = new BlockGridTexture(10, 10, 10, 10);
    texture.update({
      cols: 1,
      rows: 1,
      indices: new Uint8Array([1]),
      colors: new Uint8Array([255, 0, 0]),
      colorCoverage: new Uint8Array([64]),
      luma: new Uint8Array([192]),
    });

    const blockImageData = (texture as unknown as { imageData: ImageData }).imageData;
    expect(blockImageData.data[1]).toBe(192);
  });

  it("falls back to 0 in the G channel when grid lacks luma", () => {
    const texture = new BlockGridTexture(10, 10, 10, 10);
    texture.update({
      cols: 1,
      rows: 1,
      indices: new Uint8Array([1]),
      colors: new Uint8Array([255, 0, 0]),
    });

    const blockImageData = (texture as unknown as { imageData: ImageData }).imageData;
    expect(blockImageData.data[1]).toBe(0);
  });

  it("applies the bottom-up row flip to luma values in the G channel", () => {
    const texture = new BlockGridTexture(10, 20, 10, 10);
    texture.update({
      cols: 1,
      rows: 2,
      indices: new Uint8Array([1, 2]),
      colors: new Uint8Array([255, 0, 0, 0, 255, 0]),
      luma: new Uint8Array([100, 200]),
    });

    const blockImageData = (texture as unknown as { imageData: ImageData }).imageData;
    // Row 0 in source (bottom in texture due to flip) is at destIndex (grid.rows - 1 - 0) * grid.cols + 0 = 1
    const bottomRowOffset = 1 * 4;
    expect(blockImageData.data[bottomRowOffset + 1]).toBe(100);
    // Row 1 in source (top in texture due to flip) is at destIndex (grid.rows - 1 - 1) * grid.cols + 0 = 0
    const topRowOffset = 0;
    expect(blockImageData.data[topRowOffset + 1]).toBe(200);
  });
});
