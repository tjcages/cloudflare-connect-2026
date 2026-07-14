import { describe, it, expect } from "vitest";
import { buildTextGlyphMap, glyphIndexForChar, textGlyphMapKey } from "./textGlyphMap";
import { LETTER_CHARSET } from "./charset";

function placedGlyphs(bytes: Uint8Array, cols: number, rows: number) {
  const out: { col: number; row: number; glyphIndex: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const o = (r * cols + c) * 4;
      if (bytes[o] > 0) out.push({ col: c, row: r, glyphIndex: bytes[o] - 1 });
    }
  }
  return out;
}

describe("glyphIndexForChar", () => {
  it("maps charset chars directly and unknown chars to -1", () => {
    expect(glyphIndexForChar("A")).toBe(LETTER_CHARSET.indexOf("A"));
    expect(glyphIndexForChar("~")).toBe(LETTER_CHARSET.indexOf("~"));
    expect(glyphIndexForChar("€")).toBe(-1);
  });
  it("falls back for Turkish characters", () => {
    expect(glyphIndexForChar("ç")).toBe(LETTER_CHARSET.indexOf("c"));
    expect(glyphIndexForChar("İ")).toBe(LETTER_CHARSET.indexOf("I"));
    expect(glyphIndexForChar("ş")).toBe(LETTER_CHARSET.indexOf("s"));
  });
});

describe("buildTextGlyphMap", () => {
  it("is deterministic for the same key", () => {
    const a = buildTextGlyphMap(24, 18, "vertical", "CF", 3);
    const b = buildTextGlyphMap(24, 18, "vertical", "CF", 3);
    expect(a).toEqual(b);
  });
  it("stamps R=glyphIndex+1 with A=255 and places the requested copies", () => {
    const cols = 30;
    const rows = 20;
    const bytes = buildTextGlyphMap(cols, rows, "horizontal", "CF", 2);
    const placed = placedGlyphs(bytes, cols, rows);
    expect(placed.length).toBe(4);
    const cCount = placed.filter((p) => p.glyphIndex === LETTER_CHARSET.indexOf("C")).length;
    const fCount = placed.filter((p) => p.glyphIndex === LETTER_CHARSET.indexOf("F")).length;
    expect(cCount).toBe(2);
    expect(fCount).toBe(2);
    for (const p of placed) {
      const o = (p.row * cols + p.col) * 4;
      expect(bytes[o + 3]).toBe(255);
    }
  });
  it("keeps horizontal glyphs adjacent on one row", () => {
    const cols = 30;
    const rows = 20;
    const bytes = buildTextGlyphMap(cols, rows, "horizontal", "CF", 1);
    const placed = placedGlyphs(bytes, cols, rows);
    expect(placed.length).toBe(2);
    const c = placed.find((p) => p.glyphIndex === LETTER_CHARSET.indexOf("C"))!;
    const f = placed.find((p) => p.glyphIndex === LETTER_CHARSET.indexOf("F"))!;
    expect(f.row).toBe(c.row);
    expect(f.col).toBe(c.col + 1);
  });
  it("rotates vertical text bottom-up in one column", () => {
    const cols = 30;
    const rows = 20;
    const bytes = buildTextGlyphMap(cols, rows, "vertical", "CF", 1);
    const placed = placedGlyphs(bytes, cols, rows);
    expect(placed.length).toBe(2);
    const c = placed.find((p) => p.glyphIndex === LETTER_CHARSET.indexOf("C"))!;
    const f = placed.find((p) => p.glyphIndex === LETTER_CHARSET.indexOf("F"))!;
    expect(f.col).toBe(c.col);
    expect(c.row).toBe(f.row + 1);
  });
  it("skips spaces but reserves their footprint", () => {
    const cols = 30;
    const rows = 20;
    const bytes = buildTextGlyphMap(cols, rows, "horizontal", "A B", 1);
    const placed = placedGlyphs(bytes, cols, rows);
    expect(placed.length).toBe(2);
    const a = placed.find((p) => p.glyphIndex === LETTER_CHARSET.indexOf("A"))!;
    const b = placed.find((p) => p.glyphIndex === LETTER_CHARSET.indexOf("B"))!;
    expect(b.col).toBe(a.col + 2);
  });
  it("returns an empty map when the footprint does not fit", () => {
    const bytes = buildTextGlyphMap(3, 3, "horizontal", "TOOLONG", 1);
    expect(placedGlyphs(bytes, 3, 3).length).toBe(0);
  });
  it("key includes every placement-relevant input", () => {
    expect(textGlyphMapKey(10, 5, "vertical", 2, "hi")).toBe("10|5|vertical|2|hi");
  });
});
