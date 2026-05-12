import { STROKE_COLOR, type GeneratedGrid, type GridCell } from "./types";

export const getRenderedCellProps = (cell: GridCell, strokeColor = STROKE_COLOR) => ({
  x: cell.x + 0.5,
  y: cell.y + 0.5,
  width: cell.width,
  height: cell.height,
  fill: "none",
  stroke: strokeColor,
  strokeWidth: 1,
});

export const gridToSvg = (grid: GeneratedGrid): string => {
  const { logicalWidth, logicalHeight } = grid.config;
  const strokeColor = grid.config.strokeColor || STROKE_COLOR;
  const pathData = grid.cells
    .map((cell) => `M${cell.x} ${cell.y}h${cell.width}v${cell.height}h-${cell.width}Z`)
    .join(" ");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${logicalWidth}" height="${logicalHeight}" viewBox="0 0 ${logicalWidth} ${logicalHeight}" overflow="visible">`,
    pathData
      ? `  <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="1" />`
      : "",
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
};
