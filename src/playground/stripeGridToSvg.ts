import type { BlockGrid } from "./computeBlockGrid";
import type { StripeColors } from "./stripeColors";
import { rgb01ToHex } from "./stripeFilterOptions";
import { STRIPE_CELL_SIZE, STRIPE_WIDTH_MID, STRIPE_WIDTH_NONE, STRIPE_WIDTH_WIDE } from "./stripeGridConstants";

const ROW_WIDTH_GAP = 1;

function sameStripeWidth(a: number, b: number): boolean {
  if (a < 0.001 || b < 0.001) {
    return false;
  }
  return Math.abs(a - b) < 0.001;
}

function stripeFillHex(width: number, colors: StripeColors): string {
  if (width >= STRIPE_WIDTH_WIDE) {
    return rgb01ToHex(colors.wide);
  }
  if (width >= STRIPE_WIDTH_MID) {
    return rgb01ToHex(colors.mid);
  }
  return rgb01ToHex(colors.narrow);
}

function rectPath(x: number, y: number, w: number, h: number): string {
  return `M${x} ${y}h${w}v${h}h-${w}Z`;
}

export function stripeGridToSvg(grid: BlockGrid, colors: StripeColors, width: number, height: number): string {
  const pathsByColor = new Map<string, string[]>();

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const index = row * grid.cols + col;
      const stripeWidth = grid.widths[index] ?? STRIPE_WIDTH_NONE;
      if (stripeWidth <= 0) {
        continue;
      }

      const widthAbove = row > 0 ? (grid.widths[index - grid.cols] ?? 0) : 0;
      const widthBelow = row < grid.rows - 1 ? (grid.widths[index + grid.cols] ?? 0) : 0;
      const chainBreaksAbove = !sameStripeWidth(stripeWidth, widthAbove);
      const chainBreaksBelow = !sameStripeWidth(stripeWidth, widthBelow);

      let bandTop = chainBreaksAbove ? ROW_WIDTH_GAP * 0.5 : 0;
      let bandBottom = STRIPE_CELL_SIZE - (chainBreaksBelow ? ROW_WIDTH_GAP * 0.5 : 0);
      if (bandBottom - bandTop < STRIPE_CELL_SIZE) {
        bandTop = 0;
        bandBottom = STRIPE_CELL_SIZE;
      }

      const halfW = stripeWidth * 0.5;
      const columnCenter = col * STRIPE_CELL_SIZE + STRIPE_CELL_SIZE * 0.5;
      const x = columnCenter - halfW;
      const y = row * STRIPE_CELL_SIZE + bandTop;
      const rectW = stripeWidth;
      const rectH = bandBottom - bandTop;

      const fill = stripeFillHex(stripeWidth, colors);
      const segment = rectPath(x, y, rectW, rectH);
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
