import type { BlockGrid } from "./computeBlockGrid";
import type { StripeOrientation } from "./playgroundGridConfig";
import { isPlaygroundSparkleCellVisible, type PlaygroundSparkleOptions } from "./playgroundSparkle";
import { resolveWidthShuffleStripeWidth, type PlaygroundWidthShuffleOptions } from "./playgroundWidthShuffle";
import { stripeAtIndex, type StripeColors } from "./stripeColors";
import { STRIPE_CELL_SIZE, STRIPE_INDEX_NONE } from "./stripeGridConstants";
import { computeStripeLetterPlacements } from "./stripeLetterPlacements";
import { buildStripeLetterSvgGlyphs, type StripeLetterSvgGlyph } from "./stripeLetterFont";

const ROW_WIDTH_GAP = 1;

export type StripeGridSvgLayout = {
  cellPitchWidth: number;
  cellPitchHeight: number;
  gapX: number;
  gapY: number;
  orientation: StripeOrientation;
};

const DEFAULT_SVG_LAYOUT: StripeGridSvgLayout = {
  cellPitchWidth: STRIPE_CELL_SIZE,
  cellPitchHeight: STRIPE_CELL_SIZE,
  gapX: 0,
  gapY: 0,
  orientation: "vertical",
};

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

function stripeSvgLetterElements(
  grid: BlockGrid,
  glyphs: Map<string, StripeLetterSvgGlyph>,
  layout: StripeGridSvgLayout,
): string {
  const placements = computeStripeLetterPlacements(grid);
  if (placements.length === 0) {
    return "";
  }

  const useNodes = placements.flatMap((placement) => {
    const glyph = glyphs.get(placement.char);
    if (!glyph) {
      return [];
    }

    const centerX = placement.col * layout.cellPitchWidth + layout.cellPitchWidth * 0.5;
    const centerY = placement.row * layout.cellPitchHeight + layout.cellPitchHeight * 0.5;
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

function resolveAlongBandBounds(
  layout: StripeGridSvgLayout,
  chainBreaksAbove: boolean,
  chainBreaksBelow: boolean,
): { bandStart: number; bandEnd: number } {
  const alongCell = layout.orientation === "horizontal" ? layout.cellPitchWidth : layout.cellPitchHeight;
  const alongGap = layout.orientation === "horizontal" ? layout.gapX : layout.gapY;
  let bandStart = alongGap * 0.5;
  let bandEnd = alongCell - alongGap * 0.5;
  if (chainBreaksAbove) {
    bandStart = Math.max(bandStart, ROW_WIDTH_GAP * 0.5);
  }
  if (chainBreaksBelow) {
    bandEnd = Math.min(bandEnd, alongCell - ROW_WIDTH_GAP * 0.5);
  }
  if (bandEnd - bandStart < 1) {
    bandStart = 0;
    bandEnd = alongCell;
  }
  return { bandStart, bandEnd };
}

function stripeSegmentPath(
  col: number,
  row: number,
  layout: StripeGridSvgLayout,
  bandStart: number,
  bandEnd: number,
  stripeWidth: number,
): string {
  if (layout.orientation === "horizontal") {
    const halfW = stripeWidth * 0.5;
    const rowCenter = row * layout.cellPitchHeight + layout.cellPitchHeight * 0.5;
    const y = rowCenter - halfW;
    const x = col * layout.cellPitchWidth + bandStart;
    const rectW = bandEnd - bandStart;
    const rectH = stripeWidth;
    return `M${x} ${y}h${rectW}v${rectH}h-${rectW}Z`;
  }

  const halfW = stripeWidth * 0.5;
  const colCenter = col * layout.cellPitchWidth + layout.cellPitchWidth * 0.5;
  const x = colCenter - halfW;
  const y = row * layout.cellPitchHeight + bandStart;
  const rectW = stripeWidth;
  const rectH = bandEnd - bandStart;
  return `M${x} ${y}h${rectW}v${rectH}h-${rectW}Z`;
}

export type StripeGridSvgOptions = {
  useCellColors?: boolean;
  /** Full-frame raster placed beneath stripe paths (matches video/image underlay in the canvas). */
  underlayDataUrl?: string;
  /** Grid pitch used by the live canvas (cell size + gap). Defaults to 7×7. */
  layout?: StripeGridSvgLayout;
  widthShuffle?: PlaygroundWidthShuffleOptions;
  sparkleGaps?: PlaygroundSparkleOptions;
  timeSec?: number;
};

function stripeSvgUnderlayElement(dataUrl: string, width: number, height: number): string {
  return `  <image class="stripe-underlay" width="${width}" height="${height}" href="${dataUrl}" />`;
}

export function stripeGridToSvg(
  grid: BlockGrid,
  colors: StripeColors,
  width: number,
  height: number,
  options: StripeGridSvgOptions = {},
): string {
  const layout = options.layout ?? DEFAULT_SVG_LAYOUT;
  const timeSec = options.timeSec ?? 0;
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

      if (options.sparkleGaps && !isPlaygroundSparkleCellVisible(col, row, timeSec, options.sparkleGaps)) {
        continue;
      }

      const bandAbove = row > 0 ? (grid.indices[index - grid.cols] ?? 0) : 0;
      const bandBelow = row < grid.rows - 1 ? (grid.indices[index + grid.cols] ?? 0) : 0;
      const chainBreaksAbove = !sameStripeBand(stripeBand, bandAbove);
      const chainBreaksBelow = !sameStripeBand(stripeBand, bandBelow);
      const { bandStart, bandEnd } = resolveAlongBandBounds(layout, chainBreaksAbove, chainBreaksBelow);

      const coverageScale = options.useCellColors ? Math.max((grid.colorCoverage?.[index] ?? 255) / 255, 1 / 255) : 1;
      const defaultWidth = stripe.width * coverageScale;
      const acrossCell = layout.orientation === "horizontal" ? layout.cellPitchHeight : layout.cellPitchWidth;
      const animatedWidth = options.widthShuffle
        ? resolveWidthShuffleStripeWidth(col, row, defaultWidth, timeSec, options.widthShuffle)
        : defaultWidth;
      const stripeWidth = Math.max(1, Math.min(animatedWidth, acrossCell));

      const segment = stripeSegmentPath(col, row, layout, bandStart, bandEnd, stripeWidth);
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
  const letterElements = stripeSvgLetterElements(grid, svgGlyphs, layout);

  const underlay =
    options.underlayDataUrl && options.underlayDataUrl.length > 0
      ? stripeSvgUnderlayElement(options.underlayDataUrl, width, height)
      : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="visible">`,
    stripeSvgStyleBlock(colors, usedIndices),
    letterDefs,
    underlay,
    options.useCellColors ? cellColorPaths.join("\n") : pathElements,
    letterElements,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}
