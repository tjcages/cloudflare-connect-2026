import {
  constrainReferenceColor,
  isIgnoredBgPixel,
  resolveReferenceColor,
  sampleReferenceColorFromFrame,
} from "./colorWhiteness";
import { DEFAULT_STRIPE_DENSITY, type Rgb01, type StripeDuotoneOptions } from "./stripeFilterOptions";
import {
  STRIPE_BLOCK_SAMPLE_COUNT,
  STRIPE_BLOCK_SAMPLES,
  STRIPE_CELL_SIZE,
  STRIPE_DIST_MID_MAX,
  STRIPE_DIST_NARROW_MAX,
  STRIPE_WIDTH_NONE,
  STRIPE_WIDTH_MID,
  STRIPE_WIDTH_NARROW,
  STRIPE_WIDTH_WIDE,
} from "./stripeGridConstants";

export type BlockGrid = {
  cols: number;
  rows: number;
  /** Stripe width per cell: 0, 1, 3, or 5. */
  widths: Uint8Array;
};

function blockIsMostlyBg(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  col: number,
  row: number,
  reference: Rgb01,
  tolerance: number,
  gamma: number,
  threshold: number,
): boolean {
  const originX = col * STRIPE_CELL_SIZE;
  const originY = row * STRIPE_CELL_SIZE;

  let fgCount = 0;
  let bgCount = 0;

  for (let j = 0; j < STRIPE_BLOCK_SAMPLES; j++) {
    for (let i = 0; i < STRIPE_BLOCK_SAMPLES; i++) {
      const x = originX + i;
      const y = originY + j;
      if (x >= imageWidth || y >= imageHeight) {
        bgCount++;
        continue;
      }

      const idx = (y * imageWidth + x) * 4;
      const r = pixels[idx] ?? 0;
      const g = pixels[idx + 1] ?? 0;
      const b = pixels[idx + 2] ?? 0;

      if (isIgnoredBgPixel(r, g, b, reference, tolerance, gamma)) {
        bgCount++;
      } else {
        fgCount++;
      }
    }
  }

  return bgCount / STRIPE_BLOCK_SAMPLE_COUNT >= threshold || fgCount < 1;
}

/** Orthogonal distance in 7×7 cells from the nearest mostly-bg cell. */
function distanceToNearestBg(isBg: Uint8Array, cols: number, rows: number): Int32Array {
  const size = cols * rows;
  const distance = new Int32Array(size);
  distance.fill(-1);

  const queue: number[] = [];
  for (let i = 0; i < size; i++) {
    if (isBg[i]) {
      distance[i] = 0;
      queue.push(i);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const index = queue[head++] ?? 0;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const nextDist = (distance[index] ?? 0) + 1;

    if (col > 0) {
      const left = index - 1;
      if (distance[left] === -1) {
        distance[left] = nextDist;
        queue.push(left);
      }
    }
    if (col < cols - 1) {
      const right = index + 1;
      if (distance[right] === -1) {
        distance[right] = nextDist;
        queue.push(right);
      }
    }
    if (row > 0) {
      const up = index - cols;
      if (distance[up] === -1) {
        distance[up] = nextDist;
        queue.push(up);
      }
    }
    if (row < rows - 1) {
      const down = index + cols;
      if (distance[down] === -1) {
        distance[down] = nextDist;
        queue.push(down);
      }
    }
  }

  return distance;
}

/** 1px if < narrow band from bg; 3px if < mid band; else 5px (bands scaled by density). */
export function stripeWidthFromBgDistance(distance: number, isBg: boolean, density = DEFAULT_STRIPE_DENSITY): number {
  if (isBg || distance < 1) {
    return STRIPE_WIDTH_NONE;
  }
  const narrowMax = STRIPE_DIST_NARROW_MAX * density;
  const midMax = STRIPE_DIST_MID_MAX * density;
  if (distance < narrowMax) {
    return STRIPE_WIDTH_NARROW;
  }
  if (distance < midMax) {
    return STRIPE_WIDTH_MID;
  }
  return STRIPE_WIDTH_WIDE;
}

/** Marks which ends of a same-width vertical run need rounded caps. */
export function computeChainCaps(widths: Uint8Array, cols: number, rows: number): Uint8Array {
  const caps = new Uint8Array(widths.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const width = widths[index] ?? 0;
      if (width === 0) {
        continue;
      }

      const widthAbove = row > 0 ? (widths[index - cols] ?? 0) : 0;
      const widthBelow = row < rows - 1 ? (widths[index + cols] ?? 0) : 0;
      let flags = 0;
      if (width !== widthAbove) {
        flags |= 1;
      }
      if (width !== widthBelow) {
        flags |= 2;
      }
      caps[index] = flags;
    }
  }
  return caps;
}

export function computeBlockGrid(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  options: StripeDuotoneOptions,
): BlockGrid {
  const gamma = options.gamma;
  const sampled = resolveReferenceColor(
    options.referenceColorRgb ??
      sampleReferenceColorFromFrame(pixels, imageWidth, imageHeight, options.ignoreColorRgb, gamma),
    options.ignoreColorRgb,
  );
  const reference = constrainReferenceColor(sampled, options.ignoreColorRgb, options.ignoreTolerance);

  const cols = Math.ceil(imageWidth / STRIPE_CELL_SIZE);
  const rows = Math.ceil(imageHeight / STRIPE_CELL_SIZE);
  const size = cols * rows;
  const isBg = new Uint8Array(size);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      isBg[index] = blockIsMostlyBg(
        pixels,
        imageWidth,
        imageHeight,
        col,
        row,
        reference,
        options.ignoreTolerance,
        gamma,
        options.threshold,
      )
        ? 1
        : 0;
    }
  }

  const distance = distanceToNearestBg(isBg, cols, rows);
  const widths = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    widths[i] = stripeWidthFromBgDistance(distance[i] ?? -1, isBg[i] === 1, options.density);
  }

  return { cols, rows, widths };
}
