import type { BlockGrid } from "./computeBlockGrid";
import { isStripeBandEnabled, type StripeColors } from "./stripeColors";
import { STRIPE_BAND_NONE, STRIPE_CELL_SIZE, widthPxFromBand } from "./stripeGridConstants";
import { computeStripeLetterPlacements } from "./stripeLetterPlacements";
import { buildStripeLetterSvgGlyphs, type StripeLetterSvgGlyph } from "./stripeLetterFont";

const ROW_WIDTH_GAP = 1;

const SVG_BAND_CLASS = ["fill-band-1", "fill-band-2", "fill-band-3", "fill-band-4", "fill-band-5"] as const;

function sameStripeBand(a: number, b: number): boolean {
  if (a < 1 || b < 1) {
    return false;
  }
  return a === b;
}

function stripeSvgStyleBlock(colors: StripeColors): string {
  const rules = colors.bands.flatMap((fill, index) => {
    const className = SVG_BAND_CLASS[index];
    return [
      `  .${className} { fill: ${fill.hex}; }`,
      `  @supports (fill: color(display-p3 1 1 1)) {`,
      `    .${className} { fill: ${fill.displayP3Css}; }`,
      `  }`,
    ];
  });
  return ["<style>", ...rules, "</style>"].join("\n");
}

function stripeSvgLetterDefs(glyphs: Map<string, StripeLetterSvgGlyph>): string {
  if (glyphs.size === 0) {
    return "";
  }

  const symbols = [...glyphs.values()].map(
    (glyph) =>
      `    <symbol id="${glyph.id}" viewBox="0 0 ${glyph.width} ${glyph.height}" overflow="visible">` +
      `<image width="${glyph.width}" height="${glyph.height}" href="${glyph.dataUrl}" />` +
      `</symbol>`,
  );

  return ["  <defs>", ...symbols, "  </defs>"].join("\n");
}

function stripeSvgLetterElements(grid: BlockGrid, glyphs: Map<string, StripeLetterSvgGlyph>): string {
  const placements = computeStripeLetterPlacements(grid);
  if (placements.length === 0) {
    return "";
  }

  const useNodes = placements.flatMap((placement) => {
    const glyph = glyphs.get(placement.char);
    if (!glyph) {
      return [];
    }

    const centerX = placement.col * STRIPE_CELL_SIZE + STRIPE_CELL_SIZE * 0.5;
    const centerY = placement.row * STRIPE_CELL_SIZE + STRIPE_CELL_SIZE * 0.5;
    const x = centerX - glyph.width * 0.5;
    const y = centerY - glyph.height * 0.5;
    return [`  <use href="#${glyph.id}" x="${x}" y="${y}" width="${glyph.width}" height="${glyph.height}" />`];
  });

  if (useNodes.length === 0) {
    return "";
  }

  return ['  <g class="stripe-letters" aria-hidden="true">', ...useNodes, "  </g>"].join("\n");
}

export function stripeGridToSvg(grid: BlockGrid, colors: StripeColors, width: number, height: number): string {
  const pathsByClass = new Map<string, string[]>();

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const index = row * grid.cols + col;
      const stripeBand = grid.bands[index] ?? STRIPE_BAND_NONE;
      if (stripeBand <= STRIPE_BAND_NONE || !isStripeBandEnabled(colors, stripeBand)) {
        continue;
      }

      const bandAbove = row > 0 ? (grid.bands[index - grid.cols] ?? 0) : 0;
      const bandBelow = row < grid.rows - 1 ? (grid.bands[index + grid.cols] ?? 0) : 0;
      const chainBreaksAbove = !sameStripeBand(stripeBand, bandAbove);
      const chainBreaksBelow = !sameStripeBand(stripeBand, bandBelow);

      let bandTop = chainBreaksAbove ? ROW_WIDTH_GAP * 0.5 : 0;
      let bandBottom = STRIPE_CELL_SIZE - (chainBreaksBelow ? ROW_WIDTH_GAP * 0.5 : 0);
      if (bandBottom - bandTop < STRIPE_CELL_SIZE) {
        bandTop = 0;
        bandBottom = STRIPE_CELL_SIZE;
      }

      const stripeWidth = widthPxFromBand(stripeBand);
      const halfW = stripeWidth * 0.5;
      const columnCenter = col * STRIPE_CELL_SIZE + STRIPE_CELL_SIZE * 0.5;
      const x = columnCenter - halfW;
      const y = row * STRIPE_CELL_SIZE + bandTop;
      const rectW = stripeWidth;
      const rectH = bandBottom - bandTop;

      const fillClass = SVG_BAND_CLASS[stripeBand - 1] ?? SVG_BAND_CLASS[0];
      const segment = `M${x} ${y}h${rectW}v${rectH}h-${rectW}Z`;
      const list = pathsByClass.get(fillClass) ?? [];
      list.push(segment);
      pathsByClass.set(fillClass, list);
    }
  }

  const pathElements = [...pathsByClass.entries()]
    .map(([className, segments]) => `  <path class="${className}" d="${segments.join(" ")}" />`)
    .join("\n");

  const svgGlyphs = buildStripeLetterSvgGlyphs();
  const letterDefs = stripeSvgLetterDefs(svgGlyphs);
  const letterElements = stripeSvgLetterElements(grid, svgGlyphs);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="visible">`,
    stripeSvgStyleBlock(colors),
    letterDefs,
    pathElements,
    letterElements,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}
