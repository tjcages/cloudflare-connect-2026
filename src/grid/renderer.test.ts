import { describe, expect, it } from "vitest";
import { getRenderedCellProps, gridToSvg } from "./renderer";
import { STROKE_COLOR, type GridCell } from "./types";

const createClipboardGrid = (cells: GridCell[]) => ({
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
    strokeColor: STROKE_COLOR,
    gapMask: [],
  },
  cells,
});

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

  it("uses a configured stroke color", () => {
    const cell: GridCell = {
      id: "small-0",
      kind: "small",
      x: 40,
      y: 80,
      width: 40,
      height: 40,
    };

    expect(getRenderedCellProps(cell, "#123456")).toMatchObject({
      stroke: "#123456",
    });
  });
});

describe("gridToSvg", () => {
  it("uses the logical grid size for Figma clipboard SVG dimensions", () => {
    const svg = gridToSvg(createClipboardGrid([]));

    expect(svg).toContain('width="80" height="120" viewBox="0 0 80 120"');
    expect(svg).not.toContain('width="81" height="121"');
  });

  it("marks the SVG viewport as non-clipping for Figma paste", () => {
    const svg = gridToSvg(createClipboardGrid([]));

    expect(svg).toContain('overflow="visible"');
    expect(svg).not.toContain("<clipPath");
    expect(svg).not.toContain("clip-path");
    expect(svg).not.toContain("<defs");
  });

  it("exports the clipboard grid as one vector path instead of per-cell rects", () => {
    const svg = gridToSvg(
      createClipboardGrid([
        {
          id: "small-0",
          kind: "small",
          x: 0,
          y: 0,
          width: 40,
          height: 40,
        },
        {
          id: "large-0",
          kind: "large",
          x: 0,
          y: 40,
          width: 80,
          height: 80,
        },
      ]),
    );

    expect(svg.match(/<path\b/g) ?? []).toHaveLength(1);
    expect(svg).not.toContain("<rect");
  });

  it("does not export a clipboard background color", () => {
    const svg = gridToSvg(createClipboardGrid([]));

    expect(svg).not.toContain('fill="#FFFFFF"');
    expect(svg).not.toContain('width="100%" height="100%"');
  });

  it("uses unoffset path strokes so Figma can import centered strokes", () => {
    const svg = gridToSvg(
      createClipboardGrid([
        {
          id: "large-0",
          kind: "large",
          x: 0,
          y: 40,
          width: 80,
          height: 80,
        },
      ]),
    );

    expect(svg).toContain('<path d="M0 40h80v80h-80Z" fill="none" stroke="#F3F3F3" stroke-width="1" />');
    expect(svg).not.toContain("0.5");
  });

  it("exports path strokes with the configured stroke color", () => {
    const svg = gridToSvg({
      ...createClipboardGrid([
        {
          id: "large-0",
          kind: "large",
          x: 0,
          y: 40,
          width: 80,
          height: 80,
        },
      ]),
      config: {
        ...createClipboardGrid([]).config,
        strokeColor: "#123456",
      },
    });

    expect(svg).toContain('stroke="#123456"');
  });
});
