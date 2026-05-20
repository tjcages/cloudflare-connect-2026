import type { BlockGrid } from "./computeBlockGrid";
import type { StripeColors } from "./stripeColors";
import { rgb01ToHex } from "./stripeFilterOptions";
import {
  STRIPE_CELL_SIZE,
  STRIPE_WIDTH_MID,
  STRIPE_WIDTH_NARROW,
  STRIPE_WIDTH_NONE,
  STRIPE_WIDTH_WIDE,
} from "./stripeGridConstants";

const ROW_WIDTH_GAP = 1;

function stripeCapRadius(width: number): number {
  if (width >= STRIPE_WIDTH_WIDE) {
    return 1.5;
  }
  if (width >= STRIPE_WIDTH_MID) {
    return 0.75;
  }
  if (width >= STRIPE_WIDTH_NARROW) {
    return 0.5;
  }
  return 0;
}

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

function roundedRectPath(x: number, y: number, w: number, h: number, rx: number, ry: number): string {
  const r = Math.min(rx, ry, w / 2, h / 2);
  if (r <= 0) {
    return `M${x} ${y}h${w}v${h}h-${w}Z`;
  }
  return [
    `M${x + r} ${y}`,
    `h${w - 2 * r}`,
    `a${r} ${r} 0 0 1 ${r} ${r}`,
    `v${h - 2 * r}`,
    `a${r} ${r} 0 0 1 ${-r} ${r}`,
    `h${-(w - 2 * r)}`,
    `a${r} ${r} 0 0 1 ${-r} ${-r}`,
    `v${-(h - 2 * r)}`,
    `a${r} ${r} 0 0 1 ${r} ${-r}`,
    "Z",
  ].join("");
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
      const capR = Math.min(stripeCapRadius(stripeWidth), halfW, rectH * 0.5);
      const rx = chainBreaksAbove || chainBreaksBelow ? capR : 0;
      const ry = chainBreaksAbove || chainBreaksBelow ? capR : 0;

      const fill = stripeFillHex(stripeWidth, colors);
      const segment = roundedRectPath(x, y, rectW, rectH, rx, ry);
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
