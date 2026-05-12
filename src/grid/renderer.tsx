import { STROKE_COLOR, type GeneratedGrid, type GridCell } from "./types";

export const getRenderedCellProps = (cell: GridCell) => ({
  x: cell.x + 0.5,
  y: cell.y + 0.5,
  width: cell.width,
  height: cell.height,
  fill: "none",
  stroke: STROKE_COLOR,
  strokeWidth: 1,
});

export const gridToSvg = (grid: GeneratedGrid): string => {
  const rects = grid.cells
    .map((cell) => {
      const props = getRenderedCellProps(cell);

      return `  <rect x="${props.x}" y="${props.y}" width="${props.width}" height="${props.height}" fill="${props.fill}" stroke="${props.stroke}" stroke-width="${props.strokeWidth}" />`;
    })
    .join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${grid.config.renderWidth}" height="${grid.config.renderHeight}" viewBox="0 0 ${grid.config.renderWidth} ${grid.config.renderHeight}">`,
    `  <rect width="100%" height="100%" fill="#FFFFFF" />`,
    rects,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
};
