import { getRenderedCellProps } from "../grid/renderer";
import type { GeneratedGrid } from "../grid/types";

type GridCanvasProps = {
  grid: GeneratedGrid;
};

export const GridCanvas = ({ grid }: GridCanvasProps) => (
  <div className="canvas-shell">
    <svg
      className="grid-canvas"
      width={grid.config.renderWidth}
      height={grid.config.renderHeight}
      viewBox={`0 0 ${grid.config.renderWidth} ${grid.config.renderHeight}`}
      role="img"
      aria-label="Generated seeded grid"
    >
      <rect width="100%" height="100%" fill="#FFFFFF" />
      {grid.cells.map((cell) => (
        <rect key={cell.id} {...getRenderedCellProps(cell, grid.config.strokeColor)} />
      ))}
    </svg>
  </div>
);
