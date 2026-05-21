import { LARGE_CELL_SIZE, type IconBoxDirection } from "../../grid/types";
import {
  getIconBoxCardFrameHeight,
  getIconBoxCardFrameWidth,
  getIconBoxHighlightCornerInRootSpace,
  getIconBoxShadowCardBoundsInRootSpace,
  ICON_BOX_LENGTH_MAX,
  ICON_BOX_LENGTH_MIN,
  ICON_BOX_STROKE_ALIGN_NUDGE,
  normalizeIconBoxLength,
  resolveIconBoxLayout,
  type IconBoxContainerReticleCorner,
  type IconBoxLayoutSpec,
} from "./layout";

export const oppositeIconBoxCorner = (corner: IconBoxContainerReticleCorner): IconBoxContainerReticleCorner => {
  switch (corner) {
    case "tl":
      return "br";
    case "tr":
      return "bl";
    case "bl":
      return "tr";
    case "br":
      return "tl";
  }
};

/** Which highlight corner stays fixed for a given dragged handle. */
export const fixedIconBoxCornerForDrag = (
  draggedCorner: IconBoxContainerReticleCorner,
): IconBoxContainerReticleCorner => oppositeIconBoxCorner(draggedCorner);

export const getIconBoxShadowCardCornerInRootSpace = (
  corner: IconBoxContainerReticleCorner,
  spec: IconBoxLayoutSpec,
): { x: number; y: number } => {
  const { x, y, width, height } = getIconBoxShadowCardBoundsInRootSpace(spec);
  switch (corner) {
    case "tl":
      return { x, y };
    case "tr":
      return { x: x + width, y };
    case "bl":
      return { x, y: y + height };
    case "br":
      return { x: x + width, y: y + height };
  }
};

export const getIconBoxHighlightCornerInCanvasSpace = (
  instanceRoot: { x: number; y: number },
  title: string,
  corner: IconBoxContainerReticleCorner,
  spec: IconBoxLayoutSpec,
): { x: number; y: number } => {
  const rootCorner = getIconBoxHighlightCornerInRootSpace(title, corner, spec);
  return { x: instanceRoot.x + rootCorner.x, y: instanceRoot.y + rootCorner.y };
};

/** @deprecated Use getIconBoxHighlightCornerInCanvasSpace for selection-frame resize. */
export const getIconBoxShadowCardCornerInCanvasSpace = (
  instanceRoot: { x: number; y: number },
  corner: IconBoxContainerReticleCorner,
  spec: IconBoxLayoutSpec,
): { x: number; y: number } => {
  const rootCorner = getIconBoxShadowCardCornerInRootSpace(corner, spec);
  return { x: instanceRoot.x + rootCorner.x, y: instanceRoot.y + rootCorner.y };
};

/** Highlight outline extends past the shadow card (title strip, accent, overflow title). */
const getHighlightShadowSpanDelta = (
  title: string,
  fixedCorner: IconBoxContainerReticleCorner,
  draggedCorner: IconBoxContainerReticleCorner,
  direction: IconBoxDirection,
  spec: IconBoxLayoutSpec,
): number => {
  const hFix = getIconBoxHighlightCornerInRootSpace(title, fixedCorner, spec);
  const hDrag = getIconBoxHighlightCornerInRootSpace(title, draggedCorner, spec);
  const sFix = getIconBoxShadowCardCornerInRootSpace(fixedCorner, spec);
  const sDrag = getIconBoxShadowCardCornerInRootSpace(draggedCorner, spec);
  const highlightSpan = direction === "horizontal" ? Math.abs(hDrag.x - hFix.x) : Math.abs(hDrag.y - hFix.y);
  const shadowSpan = direction === "horizontal" ? Math.abs(sDrag.x - sFix.x) : Math.abs(sDrag.y - sFix.y);
  return highlightSpan - shadowSpan;
};

/** Map pointer span (on highlight corners) to grid-aligned shadow-card length. */
const lengthFromPointerSpan = (
  title: string,
  direction: IconBoxDirection,
  fixedCorner: IconBoxContainerReticleCorner,
  rawSpan: number,
): number => {
  const minSpec = resolveIconBoxLayout({ length: 1, direction });
  const draggedCorner = oppositeIconBoxCorner(fixedCorner);
  const chromeDelta = getHighlightShadowSpanDelta(title, fixedCorner, draggedCorner, direction, minSpec);
  const minShadowSpan =
    direction === "horizontal" ? getIconBoxCardFrameWidth(minSpec) : getIconBoxCardFrameHeight(minSpec);
  const shadowSpan = Math.max(minShadowSpan, rawSpan - chromeDelta);
  const extraCells = Math.round((shadowSpan - minShadowSpan) / LARGE_CELL_SIZE);
  return normalizeIconBoxLength(1 + Math.max(0, extraCells));
};

export type IconBoxResizeResolution = {
  length: number;
  direction: IconBoxDirection;
  rootX: number;
  rootY: number;
};

export const resolveIconBoxResizeFromPointer = (input: {
  title: string;
  fixedCornerCanvas: { x: number; y: number };
  fixedCorner: IconBoxContainerReticleCorner;
  pointerCanvas: { x: number; y: number };
  lockedDirection: IconBoxDirection;
  startRootX: number;
  startRootY: number;
}): IconBoxResizeResolution => {
  const dx = input.pointerCanvas.x - input.fixedCornerCanvas.x;
  const dy = input.pointerCanvas.y - input.fixedCornerCanvas.y;

  const direction = input.lockedDirection;
  const span = direction === "horizontal" ? Math.abs(dx) : Math.abs(dy);
  const length = lengthFromPointerSpan(input.title, direction, input.fixedCorner, span);

  const spec = resolveIconBoxLayout({ length, direction });
  const fixedRoot = getIconBoxHighlightCornerInRootSpace(input.title, input.fixedCorner, spec);
  const n = ICON_BOX_STROKE_ALIGN_NUDGE;
  let rootX = input.fixedCornerCanvas.x - (fixedRoot.x + n);
  let rootY = input.fixedCornerCanvas.y - (fixedRoot.y + n);

  if (direction === "horizontal") {
    rootY = input.startRootY;
  } else {
    rootX = input.startRootX;
  }

  return {
    length,
    direction,
    rootX,
    rootY,
  };
};

export const clampIconBoxLength = (value: number): number =>
  Math.min(ICON_BOX_LENGTH_MAX, Math.max(ICON_BOX_LENGTH_MIN, Math.floor(value)));

export const iconBoxResizeCursorForCorner = (corner: IconBoxContainerReticleCorner): string => {
  switch (corner) {
    case "tl":
    case "br":
      return "nwse-resize";
    case "tr":
    case "bl":
      return "nesw-resize";
  }
};

/** Top-left of a handle square centered on a highlight corner (canvas space). */
export const getIconBoxResizeHandleTopLeft = (
  cornerCanvas: { x: number; y: number },
  handlePx: number,
): { x: number; y: number } => ({
  x: cornerCanvas.x - handlePx / 2,
  y: cornerCanvas.y - handlePx / 2,
});
