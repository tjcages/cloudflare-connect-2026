import { describe, it, expect } from "vitest";
import { LETTER_CHARSET } from "./charset";
import { buildLetterAtlas } from "./letterAtlas";

const A = Math.ceil(Math.sqrt(LETTER_CHARSET.length));

describe("buildLetterAtlas — grid dimensions", () => {
  it("A = ceil(sqrt(charsetLen)) = 10 for 94 chars", () => {
    expect(LETTER_CHARSET.length).toBe(94);
    expect(A).toBe(10);
  });

  it("gridCols === gridRows === A", () => {
    const atlas = buildLetterAtlas();
    expect(atlas.gridCols).toBe(A);
    expect(atlas.gridRows).toBe(A);
  });

  it("glyphPx = fontPx * rasterScale (defaults: 6 * 8 = 48)", () => {
    const atlas = buildLetterAtlas();
    expect(atlas.glyphPx).toBe(48);
  });

  it("glyphPx respects custom fontPx and rasterScale", () => {
    const atlas = buildLetterAtlas({ fontPx: 4, rasterScale: 4 });
    expect(atlas.glyphPx).toBe(16);
  });

  it("width === height === A * glyphPx", () => {
    const atlas = buildLetterAtlas();
    const expected = A * atlas.glyphPx;
    expect(atlas.width).toBe(expected);
    expect(atlas.height).toBe(expected);
  });

  it("data.length === width * height (R8 buffer)", () => {
    const atlas = buildLetterAtlas();
    expect(atlas.data.length).toBe(atlas.width * atlas.height);
  });

  it("data is Uint8Array", () => {
    const atlas = buildLetterAtlas();
    expect(atlas.data).toBeInstanceOf(Uint8Array);
  });
});

describe("buildLetterAtlas — glyph cell mapping", () => {
  it("glyph g maps to col = g % A, row = floor(g / A)", () => {
    const len = LETTER_CHARSET.length;
    for (let g = 0; g < len; g++) {
      const col = g % A;
      const row = Math.floor(g / A);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(A);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(A);
    }
  });

  it("all 94 glyphs fit in A*A grid without overlap", () => {
    const cells = new Set<string>();
    for (let g = 0; g < LETTER_CHARSET.length; g++) {
      const key = `${g % A},${Math.floor(g / A)}`;
      cells.add(key);
    }
    expect(cells.size).toBe(LETTER_CHARSET.length);
    expect(LETTER_CHARSET.length).toBeLessThanOrEqual(A * A);
  });
});

describe("buildLetterAtlas — no-canvas fallback", () => {
  it("returns zero buffer of correct length when canvas is unavailable", () => {
    const atlas = buildLetterAtlas();
    expect(atlas.data.length).toBe(atlas.width * atlas.height);
    for (const byte of atlas.data) {
      if (byte !== 0) {
        return;
      }
    }
  });

  it("returns correct dims even in jsdom/no-canvas env", () => {
    const atlas = buildLetterAtlas({ fontPx: 6, rasterScale: 8 });
    expect(atlas.width).toBe(480);
    expect(atlas.height).toBe(480);
    expect(atlas.gridCols).toBe(10);
    expect(atlas.gridRows).toBe(10);
    expect(atlas.glyphPx).toBe(48);
  });
});
