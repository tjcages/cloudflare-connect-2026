import type { CursorTrailPixelBounds } from "./cursorTrail";
import type { PlaygroundFlame } from "./playgroundFlames";
import { buildStripeIndexLut } from "./stripeColors";
import type { Stripe } from "./stripeColors";

export type GridCellRegion = {
  colMin: number;
  rowMin: number;
  colMax: number;
  rowMax: number;
};

export function clampGridCellRegion(region: GridCellRegion, cols: number, rows: number): GridCellRegion {
  return {
    colMin: Math.max(0, Math.min(cols - 1, region.colMin)),
    rowMin: Math.max(0, Math.min(rows - 1, region.rowMin)),
    colMax: Math.max(0, Math.min(cols - 1, region.colMax)),
    rowMax: Math.max(0, Math.min(rows - 1, region.rowMax)),
  };
}

export function regionCellCount(region: GridCellRegion): number {
  if (region.colMax < region.colMin || region.rowMax < region.rowMin) {
    return 0;
  }
  return (region.colMax - region.colMin + 1) * (region.rowMax - region.rowMin + 1);
}

export function expandPixelBounds(
  bounds: CursorTrailPixelBounds,
  padPixels: number,
  displayWidth: number,
  displayHeight: number,
): CursorTrailPixelBounds {
  return {
    dirtyMinX: Math.max(0, Math.floor(bounds.dirtyMinX) - padPixels),
    dirtyMinY: Math.max(0, Math.floor(bounds.dirtyMinY) - padPixels),
    dirtyMaxX: Math.min(displayWidth - 1, Math.ceil(bounds.dirtyMaxX) + padPixels),
    dirtyMaxY: Math.min(displayHeight - 1, Math.ceil(bounds.dirtyMaxY) + padPixels),
  };
}

export function mergeGridCellRegions(a: GridCellRegion | null, b: GridCellRegion | null): GridCellRegion | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return {
    colMin: Math.min(a.colMin, b.colMin),
    rowMin: Math.min(a.rowMin, b.rowMin),
    colMax: Math.max(a.colMax, b.colMax),
    rowMax: Math.max(a.rowMax, b.rowMax),
  };
}

export function pixelBoundsToCellRegion(
  bounds: CursorTrailPixelBounds | null,
  cellWidth: number,
  cellHeight: number,
  displayWidth: number,
  displayHeight: number,
  padCells = 1,
): GridCellRegion | null {
  if (!bounds || bounds.dirtyMaxX < 0) {
    return null;
  }

  const safeCellWidth = Math.max(1, Math.round(cellWidth));
  const safeCellHeight = Math.max(1, Math.round(cellHeight));
  const cols = Math.ceil(displayWidth / safeCellWidth);
  const rows = Math.ceil(displayHeight / safeCellHeight);

  const minX = Math.max(0, Math.floor(bounds.dirtyMinX));
  const minY = Math.max(0, Math.floor(bounds.dirtyMinY));
  const maxX = Math.min(displayWidth - 1, Math.ceil(bounds.dirtyMaxX));
  const maxY = Math.min(displayHeight - 1, Math.ceil(bounds.dirtyMaxY));

  const region = clampGridCellRegion(
    {
      colMin: Math.floor(minX / safeCellWidth) - padCells,
      rowMin: Math.floor(minY / safeCellHeight) - padCells,
      colMax: Math.floor(maxX / safeCellWidth) + padCells,
      rowMax: Math.floor(maxY / safeCellHeight) + padCells,
    },
    cols,
    rows,
  );

  return regionCellCount(region) > 0 ? region : null;
}

export function flamesToPixelBounds(flames: readonly PlaygroundFlame[]): CursorTrailPixelBounds | null {
  if (flames.length === 0) {
    return null;
  }

  let dirtyMinX = Number.POSITIVE_INFINITY;
  let dirtyMinY = Number.POSITIVE_INFINITY;
  let dirtyMaxX = -1;
  let dirtyMaxY = -1;

  for (const flame of flames) {
    dirtyMinX = Math.min(dirtyMinX, flame.x);
    dirtyMinY = Math.min(dirtyMinY, flame.y);
    dirtyMaxX = Math.max(dirtyMaxX, flame.x + flame.width);
    dirtyMaxY = Math.max(dirtyMaxY, flame.y + flame.height);
  }

  if (dirtyMaxX < 0) {
    return null;
  }

  return { dirtyMinX, dirtyMinY, dirtyMaxX, dirtyMaxY };
}

/** Limit stripe-index changes inside a dirty region; cells outside keep previous values. */
export function smoothBlockGridIndicesInRegion(
  next: Uint8Array,
  previous: Uint8Array | undefined,
  region: GridCellRegion,
  cols: number,
  maxStep = 1,
): Uint8Array {
  if (!previous || previous.length !== next.length || maxStep <= 0) {
    return new Uint8Array(next);
  }

  const out = new Uint8Array(previous);
  for (let row = region.rowMin; row <= region.rowMax; row++) {
    for (let col = region.colMin; col <= region.colMax; col++) {
      const i = row * cols + col;
      const prev = previous[i] ?? 0;
      const target = next[i] ?? 0;
      const delta = target - prev;
      if (delta > 0) {
        out[i] = prev + Math.min(delta, maxStep);
      } else if (delta < 0) {
        out[i] = prev - Math.min(-delta, maxStep);
      } else {
        out[i] = prev;
      }
    }
  }

  return out;
}

export function resolveStripeIndicesInRegion(
  luma: Uint8Array,
  stripes: readonly Stripe[],
  region: GridCellRegion,
  cols: number,
  out: Uint8Array,
): void {
  const lut = buildStripeIndexLut(stripes);
  for (let row = region.rowMin; row <= region.rowMax; row++) {
    for (let col = region.colMin; col <= region.colMax; col++) {
      const i = row * cols + col;
      out[i] = lut[luma[i] ?? 0] ?? 0;
    }
  }
}

export function promoteColorsModeIndicesInRegion(
  rawIndices: Uint8Array,
  colorCoverage: Uint8Array | undefined,
  region: GridCellRegion,
  cols: number,
): void {
  if (!colorCoverage) {
    return;
  }
  for (let row = region.rowMin; row <= region.rowMax; row++) {
    for (let col = region.colMin; col <= region.colMax; col++) {
      const index = row * cols + col;
      if ((rawIndices[index] ?? 0) === 0 && (colorCoverage[index] ?? 0) > 0) {
        rawIndices[index] = 1;
      }
    }
  }
}
