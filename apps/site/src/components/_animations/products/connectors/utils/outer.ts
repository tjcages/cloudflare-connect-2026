import { PLATE_INSET } from "../../../constants";
import { type BoxGeom, boxRect } from "./geometry";

// Must match the max-w-1200 hero grid — edges a box can connect to sit at x=0 and x=CANVAS_WIDTH.
export const CANVAS_WIDTH = 1200;

type OuterSpan = {
  side: "left" | "right";
  cy: number;
  xMin: number;
  xMax: number;
};

export function resolveOuterSpan(
  box: BoxGeom,
  canvasWidth = CANVAS_WIDTH
): OuterSpan {
  const r = boxRect(box);
  const distRight = canvasWidth - r.right;
  const distLeft = r.left;

  if (distRight <= distLeft) {
    const xMin = Math.min(Math.max(r.right - PLATE_INSET, 0), canvasWidth);
    return { side: "right", cy: r.cy, xMin, xMax: canvasWidth };
  }
  const xMax = Math.max(Math.min(r.left + PLATE_INSET, canvasWidth), 0);
  return { side: "left", cy: r.cy, xMin: 0, xMax };
}
