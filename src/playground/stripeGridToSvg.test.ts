import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlockGrid } from "./computeBlockGrid";
import { buildStripeColors } from "./stripeColors";
import { stripeGridToSvg } from "./stripeGridToSvg";
import { computeStripeLetterPlacements } from "./stripeLetterPlacements";
import { stripeLetterSvgGlyphId, STRIPE_LETTER_CHARSET } from "./stripeLetterFont";

describe("stripeGridToSvg", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,test-glyph");
  });

  it("emits display-p3 fills with sRGB fallbacks per stripe index", () => {
    const colors = buildStripeColors();
    const topIndex = colors.stripes.length;
    const grid: BlockGrid = {
      cols: 1,
      rows: 1,
      indices: new Uint8Array([topIndex]),
    };
    const svg = stripeGridToSvg(grid, colors, 7, 7);

    expect(svg).toContain("display-p3");
    expect(svg).toContain(colors.stripes[topIndex - 1]!.hex);
    expect(svg).toContain(`fill-stripe-${topIndex}`);
    expect(svg).toContain("@supports");
  });

  it("embeds rasterized Berkeley glyphs as reusable SVG symbols", () => {
    const cols = 20;
    const rows = 15;
    const colors = buildStripeColors();
    const grid: BlockGrid = {
      cols,
      rows,
      indices: new Uint8Array(cols * rows).fill(colors.stripes.length),
    };
    const placements = computeStripeLetterPlacements(grid);
    const svg = stripeGridToSvg(grid, colors, cols * 7, rows * 7);

    expect(placements.length).toBeGreaterThan(0);
    expect(svg).toContain('class="stripe-letters"');
    expect(svg).toContain("<defs>");
    expect(svg).toContain("data:image/png;base64,test-glyph");
    expect(STRIPE_LETTER_CHARSET.length).toBeGreaterThan(10);

    for (const char of ["A", "z", "7", "@"]) {
      expect(svg).toContain(`id="${stripeLetterSvgGlyphId(char)}"`);
    }

    for (const placement of placements.slice(0, 5)) {
      const glyphId = stripeLetterSvgGlyphId(placement.char);
      expect(svg).toContain(`href="#${glyphId}"`);
    }
  });
});
