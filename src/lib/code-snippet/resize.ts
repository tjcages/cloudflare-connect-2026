import { SMALL_CELL_SIZE } from "../../grid/types";
import type { IconBoxContainerReticleCorner } from "../icon-box/layout";
import { oppositeIconBoxCorner } from "../icon-box/resize";
import { getCodeSnippetMetrics, normalizeCodeSnippetCells } from "./layout";

export const oppositeCodeSnippetCorner = oppositeIconBoxCorner;

export const fixedCodeSnippetCornerForDrag = (
  draggedCorner: IconBoxContainerReticleCorner,
): IconBoxContainerReticleCorner => oppositeCodeSnippetCorner(draggedCorner);

export type CodeSnippetResizeResolution = {
  widthCells: number;
  heightCells: number;
  rootX: number;
  rootY: number;
};

const cellsFromSpan = (spanPx: number): number => normalizeCodeSnippetCells(Math.round(spanPx / SMALL_CELL_SIZE));

export const getCodeSnippetHighlightCornerInCanvasSpace = (
  instanceRoot: { x: number; y: number },
  width: number,
  height: number,
  corner: IconBoxContainerReticleCorner,
): { x: number; y: number } => {
  switch (corner) {
    case "tl":
      return { x: instanceRoot.x, y: instanceRoot.y };
    case "tr":
      return { x: instanceRoot.x + width, y: instanceRoot.y };
    case "bl":
      return { x: instanceRoot.x, y: instanceRoot.y + height };
    case "br":
      return { x: instanceRoot.x + width, y: instanceRoot.y + height };
  }
};

export const resolveCodeSnippetResizeFromPointer = (input: {
  fixedCornerCanvas: { x: number; y: number };
  fixedCorner: IconBoxContainerReticleCorner;
  pointerCanvas: { x: number; y: number };
}): CodeSnippetResizeResolution => {
  const dx = input.pointerCanvas.x - input.fixedCornerCanvas.x;
  const dy = input.pointerCanvas.y - input.fixedCornerCanvas.y;
  const widthCells = cellsFromSpan(Math.abs(dx));
  const heightCells = cellsFromSpan(Math.abs(dy));

  const width = widthCells * SMALL_CELL_SIZE;
  const height = heightCells * SMALL_CELL_SIZE;

  let rootX = input.fixedCornerCanvas.x;
  let rootY = input.fixedCornerCanvas.y;

  if (input.fixedCorner === "tr" || input.fixedCorner === "br") {
    rootX = input.fixedCornerCanvas.x - width;
  }
  if (input.fixedCorner === "bl" || input.fixedCorner === "br") {
    rootY = input.fixedCornerCanvas.y - height;
  }

  return { widthCells, heightCells, rootX, rootY };
};

export const getCodeSnippetMetricsFromProps = getCodeSnippetMetrics;

export const codeSnippetResizeCursorForCorner = (corner: IconBoxContainerReticleCorner): string => {
  switch (corner) {
    case "tl":
    case "br":
      return "nwse-resize";
    case "tr":
    case "bl":
      return "nesw-resize";
  }
};
