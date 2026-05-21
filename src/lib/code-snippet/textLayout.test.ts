import { describe, expect, it } from "vitest";
import type { CodeSnippetToken } from "./highlight";
import { layoutCodeSnippetTokens, measureTokenWidth, splitTokensBySourceLines } from "./textLayout";

describe("textLayout", () => {
  it("measures token width with Pretext", () => {
    const w = measureTokenWidth("IMPORT");
    expect(w).toBeGreaterThan(0);
  });

  it("justifies tokens on a single line when they fit", () => {
    expect(measureTokenWidth("AB")).toBeGreaterThan(0);
    const tokens: CodeSnippetToken[] = [
      { text: "AA", colorHex: "#000" },
      { text: "BB", colorHex: "#000" },
    ];
    const spans = layoutCodeSnippetTokens({ tokens, innerWidth: 200, innerHeight: 40 });
    expect(spans).toHaveLength(2);
    const xs = spans.map((s) => s.x);
    expect(Math.max(...xs)).toBeGreaterThan(Math.min(...xs));
  });

  it("justifies each wrapped row to the inner width", () => {
    const tokens: CodeSnippetToken[] = [
      { text: "import", colorHex: "#000" },
      { text: " { ", colorHex: "#000" },
      { text: "DurableObject", colorHex: "#000" },
      { text: " } ", colorHex: "#000" },
      { text: "from", colorHex: "#000" },
      { text: '"cloudflare:workers"', colorHex: "#111" },
      { text: ";", colorHex: "#000" },
    ];
    const innerWidth = 280;
    const spans = layoutCodeSnippetTokens({ tokens, innerWidth, innerHeight: 40 });
    const rowYs = [...new Set(spans.map((s) => s.y))].sort((a, b) => a - b);
    expect(rowYs.length).toBeGreaterThan(1);
    for (const y of rowYs) {
      const rowSpans = spans.filter((s) => s.y === y);
      const isAttachedSuffixLine = rowSpans.length === 2 && rowSpans[1]?.text === ";";
      if (isAttachedSuffixLine) {
        continue;
      }
      const last = rowSpans[rowSpans.length - 1]!;
      const rowEnd = last.x + measureTokenWidth(last.text, innerWidth);
      expect(rowEnd).toBeGreaterThan(innerWidth - 2);
      expect(rowEnd).toBeLessThanOrEqual(innerWidth + 2);
    }
    expect(spans[0]?.y).toBe(0);
  });

  it("keeps trailing semicolon attached to the preceding token when justifying", () => {
    const tokens: CodeSnippetToken[] = [
      { text: '"cloudflare:workers"', colorHex: "#111" },
      { text: ";", colorHex: "#000" },
    ];
    const innerWidth = 280;
    const spans = layoutCodeSnippetTokens({ tokens, innerWidth, innerHeight: 40 });
    expect(spans).toHaveLength(2);
    const stringSpan = spans.find((s) => s.text.includes("CLOUDFLARE"))!;
    const semiSpan = spans.find((s) => s.text === ";")!;
    expect(semiSpan.x - (stringSpan.x + measureTokenWidth(stringSpan.text, innerWidth))).toBeLessThan(4);
  });

  it("lays out each source line on its own row", () => {
    const tokens = [{ text: "wrangler deploy\n\n--outdir bundled/", colorHex: "#000" }];
    const lines = splitTokensBySourceLines(tokens);
    expect(lines).toHaveLength(3);
    expect(lines[0]?.[0]?.text).toBe("wrangler deploy");
    expect(lines[1]).toEqual([]);
    expect(lines[2]?.[0]?.text).toBe("--outdir bundled/");

    const spans = layoutCodeSnippetTokens({ tokens, innerWidth: 280, innerHeight: 80 });
    const deployY = spans.find((s) => s.text.includes("WRANGLER"))?.y;
    const flagY = spans.find((s) => s.text.includes("OUTDIR"))?.y;
    expect(deployY).toBe(0);
    expect(flagY).toBe(40);
  });

  it("wraps long shell lines instead of clipping a single justified row", () => {
    const tokens = [{ text: "--outdir bundled/ --dry-run --very-long-flag-name", colorHex: "#000" }];
    const spans = layoutCodeSnippetTokens({ tokens, innerWidth: 120, innerHeight: 60 });
    const ys = new Set(spans.map((s) => s.y));
    expect(ys.size).toBeGreaterThan(1);
    const maxRight = Math.max(...spans.map((s) => s.x + measureTokenWidth(s.text, 120)));
    expect(maxRight).toBeLessThanOrEqual(125);
  });

  it("wraps to multiple rows when tokens do not fit", () => {
    const tokens: CodeSnippetToken[] = Array.from({ length: 12 }, (_, i) => ({
      text: `TOKEN${i}`,
      colorHex: "#000",
    }));
    const spans = layoutCodeSnippetTokens({ tokens, innerWidth: 80, innerHeight: 80 });
    const ys = new Set(spans.map((s) => s.y));
    expect(ys.size).toBeGreaterThan(1);
  });
});
