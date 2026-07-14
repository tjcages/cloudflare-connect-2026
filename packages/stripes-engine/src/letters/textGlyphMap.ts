import { LETTER_CHARSET } from "./charset";
import { mulberry32 } from "../core/rng";

const GLYPH_INDEX = new Map(LETTER_CHARSET.map((ch, i) => [ch, i]));
const CHAR_FALLBACK: Record<string, string> = {
  ç: "c",
  Ç: "C",
  ğ: "g",
  Ğ: "G",
  ı: "i",
  İ: "I",
  ö: "o",
  Ö: "O",
  ş: "s",
  Ş: "S",
  ü: "u",
  Ü: "U",
};

export function glyphIndexForChar(ch: string): number {
  const direct = GLYPH_INDEX.get(ch);
  if (direct !== undefined) return direct;
  const fallback = CHAR_FALLBACK[ch];
  return fallback ? (GLYPH_INDEX.get(fallback) ?? -1) : -1;
}

export function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function textGlyphMapKey(
  cols: number,
  rows: number,
  orientation: "vertical" | "horizontal",
  textCopies: number,
  text: string,
): string {
  return [cols, rows, orientation, textCopies, text].join("|");
}

export function buildTextGlyphMap(
  cols: number,
  rows: number,
  orientation: "vertical" | "horizontal",
  text: string,
  textCopies: number,
): Uint8Array {
  const bytes = new Uint8Array(cols * rows * 4);
  const occupied = new Uint8Array(cols * rows);
  const lines = text.replace(/\r/g, "").split("\n");
  const maxLen = lines.reduce((m, line) => Math.max(m, [...line].length), 0);
  const stamps: { col: number; row: number; glyphIndex: number }[] = [];
  let footW = 0;
  let footH = 0;
  lines.forEach((line, lineIdx) => {
    let charIdx = 0;
    for (const ch of line) {
      const gi = ch === " " ? -1 : glyphIndexForChar(ch);
      const col = orientation === "horizontal" ? charIdx : lineIdx;
      const row = orientation === "horizontal" ? lineIdx : maxLen - 1 - charIdx;
      footW = Math.max(footW, col + 1);
      footH = Math.max(footH, row + 1);
      if (gi >= 0) stamps.push({ col, row, glyphIndex: gi });
      charIdx++;
    }
    if (line.length === 0) {
      footW = Math.max(footW, orientation === "horizontal" ? 0 : lineIdx + 1);
      footH = Math.max(footH, orientation === "horizontal" ? lineIdx + 1 : 0);
    }
  });
  if (stamps.length > 0 && footW > 0 && footH > 0 && footW <= cols && footH <= rows) {
    const origins: { col: number; row: number }[] = [];
    for (let r = 0; r <= rows - footH; r++) for (let c = 0; c <= cols - footW; c++) origins.push({ col: c, row: r });
    const rnd = mulberry32(fnv1a(textGlyphMapKey(cols, rows, orientation, textCopies, text)));
    for (let i = origins.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = origins[i];
      origins[i] = origins[j];
      origins[j] = tmp;
    }
    let placed = 0;
    for (const origin of origins) {
      if (placed >= textCopies) break;
      let free = true;
      for (const s of stamps) {
        if (occupied[(origin.row + s.row) * cols + origin.col + s.col]) {
          free = false;
          break;
        }
      }
      if (!free) continue;
      for (const s of stamps) {
        const col = origin.col + s.col;
        const idx = (origin.row + s.row) * cols + col;
        const o = idx * 4;
        bytes[o] = s.glyphIndex + 1;
        bytes[o + 3] = 255;
        occupied[idx] = 1;
      }
      placed++;
    }
  }
  return bytes;
}
