import { isDarkPixelByLuminance, pixelLuminance01 } from "./colorWhiteness";
import { DEFAULT_STRIPE_DUOTONE_OPTIONS, type StripeDuotoneOptions } from "./stripeFilterOptions";
import { bandFromDistance, STRIPE_BAND_BREAKPOINT_LIMIT } from "./stripeBandThresholds";
import { STRIPE_BLOCK_SAMPLE_COUNT, STRIPE_BLOCK_SAMPLES, STRIPE_CELL_SIZE } from "./stripeGridConstants";

export type BlockGrid = {
  cols: number;
  rows: number;
  /** Stripe band per cell: 0 = none, 1…5 = foreground luminance band. */
  bands: Uint8Array;
};

function blockIsMostlyBg(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  col: number,
  row: number,
  maxLuminance: number,
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

      if (isDarkPixelByLuminance(r, g, b, maxLuminance, gamma)) {
        bgCount++;
      } else {
        fgCount++;
      }
    }
  }

  return bgCount / STRIPE_BLOCK_SAMPLE_COUNT >= threshold || fgCount < 1;
}

function blockMeanLuminance(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  col: number,
  row: number,
  gamma: number,
): number {
  const originX = col * STRIPE_CELL_SIZE;
  const originY = row * STRIPE_CELL_SIZE;

  let sum = 0;
  let count = 0;

  for (let j = 0; j < STRIPE_BLOCK_SAMPLES; j++) {
    for (let i = 0; i < STRIPE_BLOCK_SAMPLES; i++) {
      const x = originX + i;
      const y = originY + j;
      if (x >= imageWidth || y >= imageHeight) {
        continue;
      }

      const idx = (y * imageWidth + x) * 4;
      sum += pixelLuminance01(pixels[idx] ?? 0, pixels[idx + 1] ?? 0, pixels[idx + 2] ?? 0, gamma);
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}

/** Maps mean cell luminance (0–1) into stripe bands; breakpoints stay on the 1…16 distance scale. */
export function stripeBandFromLuminance(
  luminance01: number,
  isBg: boolean,
  options: Pick<StripeDuotoneOptions, "density" | "bandBreakpoints"> = DEFAULT_STRIPE_DUOTONE_OPTIONS,
): number {
  if (isBg || luminance01 <= 0) {
    return 0;
  }
  return bandFromDistance(
    luminance01 * STRIPE_BAND_BREAKPOINT_LIMIT,
    false,
    options.density,
    options.bandBreakpoints,
  );
}

/** @deprecated Use {@link stripeBandFromLuminance}; kept for existing tests and export call sites. */
export function stripeBandFromBgDistance(
  luminanceOrLegacyDistance: number,
  isBg: boolean,
  options: Pick<StripeDuotoneOptions, "density" | "bandBreakpoints"> = DEFAULT_STRIPE_DUOTONE_OPTIONS,
): number {
  return stripeBandFromLuminance(luminanceOrLegacyDistance, isBg, options);
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
  const gamma = options.gamma;
  const cols = Math.ceil(imageWidth / STRIPE_CELL_SIZE);
  const rows = Math.ceil(imageHeight / STRIPE_CELL_SIZE);
  const size = cols * rows;
  const bands = new Uint8Array(size);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const isBg = blockIsMostlyBg(
        pixels,
        imageWidth,
        imageHeight,
        col,
        row,
        options.ignoreTolerance,
        gamma,
        options.threshold,
      );
      const luminance = blockMeanLuminance(pixels, imageWidth, imageHeight, col, row, gamma);
      bands[index] = stripeBandFromLuminance(luminance, isBg, options);
    }
  }

  return { cols, rows, bands };
}
