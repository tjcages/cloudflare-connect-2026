import { describe, expect, it } from "vitest";
import { getRenderedCellProps, gridToSvg } from "./renderer";
import { STROKE_COLOR, type GridCell } from "./types";

describe("getRenderedCellProps", () => {
  it("applies centered-stroke rendering math", () => {
    const cell: GridCell = {
      id: "small-0",
      kind: "small",
      x: 40,
      y: 80,
      width: 40,
      height: 40,
    };

    expect(getRenderedCellProps(cell)).toMatchObject({
      x: 40.5,
      y: 80.5,
      fill: "none",
      stroke: STROKE_COLOR,
      strokeWidth: 1,
    });
  });
});

describe("gridToSvg", () => {
  it("exports the rendered grid as centered-stroke SVG markup", () => {
    const cell: GridCell = {
      id: "large-0",
      kind: "large",
      x: 0,
      y: 40,
      width: 80,
      height: 80,
    };

    expect(
      gridToSvg({
        config: {
          seed: "test",
          width: 80,
          height: 120,
          density: 0.5,
          logicalWidth: 80,
          logicalHeight: 120,
          renderWidth: 81,
          renderHeight: 121,
          columns: 2,
          rows: 3,
          smallCellRatio: 0.2,
          largeCellRatio: 0.8,
          gapMask: [],
        },
        cells: [cell],
      }),
    ).toContain(
      '<rect x="0.5" y="40.5" width="80" height="80" fill="none" stroke="#F3F3F3" stroke-width="1" />',
    );
  });
});
