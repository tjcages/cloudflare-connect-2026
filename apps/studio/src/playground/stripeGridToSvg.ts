import type { BlockGrid } from "./computeBlockGrid";
import { stripeAtIndex, type StripeColors } from "./stripeColors";
import { STRIPE_CELL_SIZE, STRIPE_INDEX_NONE } from "./stripeGridConstants";
import { computeStripeLetterPlacements } from "./stripeLetterPlacements";
import { buildStripeLetterSvgGlyphs, type StripeLetterSvgGlyph } from "./stripeLetterFont";

const ROW_WIDTH_GAP = 1;

function svgStripeClass(index: number): string {
  return `fill-stripe-${index}`;
}

function sameStripeBand(a: number, b: number): boolean {
  if (a < 1 || b < 1) {
    return false;
  }
  return a === b;
}

function stripeSvgStyleBlock(colors: StripeColors, usedIndices: readonly number[]): string {
  const rules = usedIndices.flatMap((index) => {
    const stripe = stripeAtIndex(colors, index);
    if (!stripe) {
      return [];
    }
    const className = svgStripeClass(index);
    return [
      `  .${className} { fill: ${stripe.hex}; }`,
      `  @supports (fill: color(display-p3 1 1 1)) {`,
      `    .${className} { fill: ${stripe.p3Css}; }`,
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

function cellColorHex(grid: BlockGrid, cellIndex: number): string {
  const offset = cellIndex * 3;
  const r = grid.colors?.[offset] ?? 0;
  const g = grid.colors?.[offset + 1] ?? 0;
  const b = grid.colors?.[offset + 2] ?? 0;
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function stripeGridToSvg(
  grid: BlockGrid,
  colors: StripeColors,
  width: number,
  height: number,
  options: { useCellColors?: boolean } = {},
): string {
  const pathsByIndex = new Map<number, string[]>();
  const cellColorPaths: string[] = [];

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const index = row * grid.cols + col;
      const stripeBand = grid.indices[index] ?? STRIPE_INDEX_NONE;
      const stripe = stripeAtIndex(colors, stripeBand);
      if (stripeBand <= STRIPE_INDEX_NONE || !stripe) {
        continue;
      }

      const bandAbove = row > 0 ? (grid.indices[index - grid.cols] ?? 0) : 0;
      const bandBelow = row < grid.rows - 1 ? (grid.indices[index + grid.cols] ?? 0) : 0;
      const chainBreaksAbove = !sameStripeBand(stripeBand, bandAbove);
      const chainBreaksBelow = !sameStripeBand(stripeBand, bandBelow);

      let bandTop = chainBreaksAbove ? ROW_WIDTH_GAP * 0.5 : 0;
      let bandBottom = STRIPE_CELL_SIZE - (chainBreaksBelow ? ROW_WIDTH_GAP * 0.5 : 0);
      if (bandBottom - bandTop < STRIPE_CELL_SIZE) {
        bandTop = 0;
        bandBottom = STRIPE_CELL_SIZE;
      }

      const coverageScale = options.useCellColors ? Math.max((grid.colorCoverage?.[index] ?? 255) / 255, 1 / 255) : 1;
      const stripeWidth = Math.max(1, stripe.width * coverageScale);
      const halfW = stripeWidth * 0.5;
      const columnCenter = col * STRIPE_CELL_SIZE + STRIPE_CELL_SIZE * 0.5;
      const x = columnCenter - halfW;
      const y = row * STRIPE_CELL_SIZE + bandTop;
      const rectW = stripeWidth;
      const rectH = bandBottom - bandTop;

      const segment = `M${x} ${y}h${rectW}v${rectH}h-${rectW}Z`;
      if (options.useCellColors) {
        cellColorPaths.push(`  <path fill="${cellColorHex(grid, index)}" d="${segment}" />`);
        continue;
      }
      const list = pathsByIndex.get(stripeBand) ?? [];
      list.push(segment);
      pathsByIndex.set(stripeBand, list);
    }
  }

  const usedIndices = [...pathsByIndex.keys()].sort((a, b) => a - b);
  const pathElements = usedIndices
    .map((index) => `  <path class="${svgStripeClass(index)}" d="${(pathsByIndex.get(index) ?? []).join(" ")}" />`)
    .join("\n");

  const svgGlyphs = buildStripeLetterSvgGlyphs();
  const letterDefs = stripeSvgLetterDefs(svgGlyphs);
  const letterElements = stripeSvgLetterElements(grid, svgGlyphs);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="visible">`,
    stripeSvgStyleBlock(colors, usedIndices),
    letterDefs,
    options.useCellColors ? cellColorPaths.join("\n") : pathElements,
    letterElements,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}
