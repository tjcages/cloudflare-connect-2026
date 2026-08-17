import type { EngineConfig } from "../config/types";
import { fract, sparkleHash } from "../stripeFx/sparkleMath";
import type { FrameGroup } from "./frameGroups";

/** One frame, in CSS pixels of the instance it belongs to. */
export type FrameBox = {
  /** Stroke rect, already on a half-pixel so a 1px line lands on one device row. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Unrounded top-left of the group, where the coordinate chip anchors. */
  labelX: number;
  labelY: number;
  label: string;
};

function randomColumnMotionTarget(col: number, cycleIndex: number, staggerPx: number): number {
  const patternSeed = staggerPx * 0.61803398875;
  return sparkleHash(col + patternSeed + 307, cycleIndex + patternSeed + 401) * 2 - 1;
}

/**
 * The vertical offset sparkle motion has applied to one column at `timeSec`.
 *
 * A CPU copy of the same walk the stripe shader does, so a frame drawn on the
 * host tracks the column it rings instead of sliding off it. Any change to the
 * shader's motion has to land here too.
 */
function frameColumnMotionOffset(col: number, timeSec: number, motion: EngineConfig["sparkle"]["motion"]): number {
  if (!motion.enabled || motion.amplitudePx <= 0 || motion.maxOffsetPx <= 0) return 0;
  const patternSeed = motion.staggerPx * 0.61803398875;
  const columnRate = 0.65 + sparkleHash(col + patternSeed + 89, patternSeed + 113) * 0.7;
  const columnPhase = sparkleHash(col + patternSeed + 179, patternSeed + 233) * 7;
  const randomTime = timeSec * Math.max(motion.speed, 0.05) * columnRate + columnPhase;
  const cycleIndex = Math.floor(randomTime);
  const cycleT = fract(randomTime);
  const easedT = cycleT * cycleT * (3 - 2 * cycleT);
  const from = randomColumnMotionTarget(col, cycleIndex, motion.staggerPx);
  const to = randomColumnMotionTarget(col, cycleIndex + 1, motion.staggerPx);
  const wave = from + (to - from) * easedT;
  return wave * Math.min(Math.max(motion.amplitudePx, 0), Math.max(motion.maxOffsetPx, 0));
}

function resolveFrameBox(
  group: FrameGroup,
  grid: Pick<EngineConfig["grid"], "cellWidth" | "cellHeight">,
  motion: EngineConfig["sparkle"]["motion"],
  width: number,
  height: number,
  timeSec: number,
): FrameBox | null {
  if (group.columns.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const column of group.columns) {
    const motionY = frameColumnMotionOffset(column.col, timeSec, motion);
    minX = Math.min(minX, column.col * grid.cellWidth);
    maxX = Math.max(maxX, (column.col + 1) * grid.cellWidth);
    minY = Math.min(minY, column.minRow * grid.cellHeight + motionY);
    maxY = Math.max(maxY, (column.maxRow + 1) * grid.cellHeight + motionY);
  }

  minX = Math.max(0, Math.min(width, minX));
  minY = Math.max(0, Math.min(height, minY));
  maxX = Math.max(0, Math.min(width, maxX));
  maxY = Math.max(0, Math.min(height, maxY));
  if (maxX - minX < 1 || maxY - minY < 1) return null;

  return {
    x: Math.round(minX) + 0.5,
    y: Math.round(minY) + 0.5,
    width: Math.max(1, Math.round(maxX - minX) - 1),
    height: Math.max(1, Math.round(maxY - minY) - 1),
    labelX: minX,
    labelY: minY,
    label: `${Math.round(minX)}, ${Math.round(minY)}`,
  };
}

export function resolveFrameBoxes(
  groups: readonly FrameGroup[],
  grid: Pick<EngineConfig["grid"], "cellWidth" | "cellHeight">,
  motion: EngineConfig["sparkle"]["motion"],
  width: number,
  height: number,
  timeSec: number,
): FrameBox[] {
  const boxes: FrameBox[] = [];
  for (const group of groups) {
    const box = resolveFrameBox(group, grid, motion, width, height, timeSec);
    if (box) boxes.push(box);
  }
  return boxes;
}
