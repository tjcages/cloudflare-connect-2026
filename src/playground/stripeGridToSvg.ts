import type { BlockGrid } from "./computeBlockGrid";
import { isStripeBandEnabled, stripeColorForBand, type StripeColors } from "./stripeColors";
import { rgb01ToHex } from "./stripeFilterOptions";
import { STRIPE_BAND_NONE, STRIPE_CELL_SIZE, widthPxFromBand } from "./stripeGridConstants";

const ROW_WIDTH_GAP = 1;

function sameStripeBand(a: number, b: number): boolean {
  if (a < 1 || b < 1) {
    return false;
  }
  return a === b;
}

export function stripeGridToSvg(grid: BlockGrid, colors: StripeColors, width: number, height: number): string {
  const pathsByColor = new Map<string, string[]>();

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

      const fill = rgb01ToHex(stripeColorForBand(colors, stripeBand));
      const segment = `M${x} ${y}h${rectW}v${rectH}h-${rectW}Z`;
      const list = pathsByColor.get(fill) ?? [];
      list.push(segment);
      pathsByColor.set(fill, list);
    }
  }

  const pathElements = [...pathsByColor.entries()]
    .map(([stroke, segments]) => `  <path d="${segments.join(" ")}" fill="${stroke}" />`)
    .join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="visible">`,
    pathElements,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}
