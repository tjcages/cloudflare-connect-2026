import { pixelLuminance } from "./colorWhiteness";
import { DEFAULT_STRIPE_DUOTONE_OPTIONS, type StripeDuotoneOptions } from "./stripeFilterOptions";
import { bandFromDistance } from "./stripeBandThresholds";
import { STRIPE_BLOCK_SAMPLE_COUNT, STRIPE_BLOCK_SAMPLES, STRIPE_CELL_SIZE } from "./stripeGridConstants";

export type BlockGrid = {
  cols: number;
  rows: number;
  /** Stripe band per cell: 0 = none, 1…5 = foreground distance band. */
  bands: Uint8Array;
};

function blockIsMostlyBg(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  col: number,
  row: number,
  luminanceCutoff: number,
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

      if (pixelLuminance(r, g, b) <= luminanceCutoff) {
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

export function stripeBandFromBgDistance(
  distance: number,
  isBg: boolean,
  options: Pick<StripeDuotoneOptions, "density" | "bandBreakpoints"> = DEFAULT_STRIPE_DUOTONE_OPTIONS,
): number {
  return bandFromDistance(distance, isBg, options.density, options.bandBreakpoints);
}

/** Marks which ends of a same-band vertical run need rounded caps. */
export function computeChainCaps(bands: Uint8Array, cols: number, rows: number): Uint8Array {
  const caps = new Uint8Array(bands.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const band = bands[index] ?? 0;
      if (band === 0) {
        continue;
      }

      const bandAbove = row > 0 ? (bands[index - cols] ?? 0) : 0;
      const bandBelow = row < rows - 1 ? (bands[index + cols] ?? 0) : 0;
      let flags = 0;
      if (band !== bandAbove) {
        flags |= 1;
      }
      if (band !== bandBelow) {
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
        options.ignoreTolerance,
        options.threshold,
      )
        ? 1
        : 0;
    }
  }

  const distance = distanceToNearestBg(isBg, cols, rows);
  const bands = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    bands[i] = stripeBandFromBgDistance(distance[i] ?? -1, isBg[i] === 1, options);
  }

  return { cols, rows, bands };
}
