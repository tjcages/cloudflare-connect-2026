import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlockGrid } from "./computeBlockGrid";
import { buildStripeColors } from "./stripeColors";
import { stripeGridToSvg } from "./stripeGridToSvg";
import { computeStripeLetterPlacements, STRIPE_LETTER_BAND } from "./stripeLetterPlacements";
import { stripeLetterSvgGlyphId, STRIPE_LETTER_CHARSET } from "./stripeLetterFont";

describe("stripeGridToSvg", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,test-glyph");
  });

  it("emits display-p3 fills with sRGB fallbacks in a style block", () => {
    const grid: BlockGrid = {
      cols: 1,
      rows: 1,
      bands: new Uint8Array([5]),
    };
    const svg = stripeGridToSvg(grid, buildStripeColors(), 7, 7);

    expect(svg).toContain("display-p3");
    expect(svg).toContain("#FF2C00");
    expect(svg).toContain("#FF7E00");
    expect(svg).toContain("fill-band-5");
    expect(svg).toContain("@supports");
  });

  it("embeds rasterized Berkeley glyphs as reusable SVG symbols", () => {
    const cols = 20;
    const rows = 15;
    const grid: BlockGrid = {
      cols,
      rows,
      bands: new Uint8Array(cols * rows).fill(STRIPE_LETTER_BAND),
    };
    const placements = computeStripeLetterPlacements(grid);
    const svg = stripeGridToSvg(grid, buildStripeColors(), cols * 7, rows * 7);

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
