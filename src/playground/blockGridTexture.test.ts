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
});
