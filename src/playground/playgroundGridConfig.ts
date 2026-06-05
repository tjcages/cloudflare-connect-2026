/** Designer-tunable grid geometry, letter, and animation-range config for the playground. */

import { SPARKLE_GAPS_BASE_PERIOD_MAX_SEC, SPARKLE_GAPS_BASE_PERIOD_MIN_SEC } from "./playgroundSparkle";
import {
  WIDTH_SHUFFLE_BASE_PERIOD_MAX_SEC,
  WIDTH_SHUFFLE_BASE_PERIOD_MIN_SEC,
  WIDTH_SHUFFLE_MIN_SWING_PX,
} from "./playgroundWidthShuffle";
import { STRIPE_CELL_SIZE, STRIPE_GRID_UPDATE_INTERVAL_MS } from "./stripeGridConstants";
import { STRIPE_LETTER_CHARSET, STRIPE_LETTER_FONT_SIZE_PX } from "./stripeLetterConstants";

export type StripeOrientation = "vertical" | "horizontal";

/** Full runtime grid config. Defaults reproduce the original fixed 7px / vertical look. */
export type PlaygroundGridConfig = {
  /** Cell footprint in px (also the source area each cell averages). */
  cellWidth: number;
  cellHeight: number;
  /** Uniform inset between adjacent columns / rows in px. */
  gapX: number;
  gapY: number;
  /** Gap carved between stacked same-axis runs of different bands (px). */
  chainBreakGap: number;
  /** Band collapses to the full cell when it would shrink below this height (px). */
  minStripeHeight: number;
  /** Rounded-corner radius applied to stripe rectangles in px (0 = square). */
  cornerRadius: number;
  /** Stripe direction: vertical bars (default) or horizontal bars. */
  orientation: StripeOrientation;
  /** Baked glyph font size in px. */
  letterSize: number;
  /** Fraction (0–1) of eligible cells that receive a letter. */
  letterRatio: number;
  /** Glyph pool; empty falls back to the default charset. */
  letterCharset: string;
  /** Letter tint as a 0xRRGGBB integer. */
  letterColor: number;
  /** Scales the letter shuffle cadence (1 = baseline; higher = faster). */
  letterShuffleSpeed: number;
  /** Sparkle-gap pulse period range in seconds. */
  sparkleGapsPeriodMinSec: number;
  sparkleGapsPeriodMaxSec: number;
  /** Width-shuffle pulse period range in seconds. */
  sparkleWidthPeriodMinSec: number;
  sparkleWidthPeriodMaxSec: number;
  /** Width-shuffle swing in px: the max +/- change applied to a stripe's width during a pulse. */
  widthShuffleSwing: number;
  /** Max stripe-index change per grid update (0 = snap instantly). */
  smoothingMaxStep: number;
  /** Minimum ms between block-grid rebuilds. */
  gridUpdateIntervalMs: number;
};

export const DEFAULT_LETTER_CHARSET = STRIPE_LETTER_CHARSET.join("");
export const DEFAULT_LETTER_COLOR = 0xffffff;
export const DEFAULT_LETTER_RATIO = 0.1;
export const DEFAULT_LETTER_SHUFFLE_SPEED = 1;
export const DEFAULT_SMOOTHING_MAX_STEP = 1;

export const DEFAULT_PLAYGROUND_GRID_CONFIG: PlaygroundGridConfig = {
  cellWidth: STRIPE_CELL_SIZE,
  cellHeight: STRIPE_CELL_SIZE,
  gapX: 0,
  gapY: 0,
  chainBreakGap: 1,
  minStripeHeight: STRIPE_CELL_SIZE,
  cornerRadius: 0,
  orientation: "vertical",
  letterSize: STRIPE_LETTER_FONT_SIZE_PX,
  letterRatio: DEFAULT_LETTER_RATIO,
  letterCharset: DEFAULT_LETTER_CHARSET,
  letterColor: DEFAULT_LETTER_COLOR,
  letterShuffleSpeed: DEFAULT_LETTER_SHUFFLE_SPEED,
  sparkleGapsPeriodMinSec: SPARKLE_GAPS_BASE_PERIOD_MIN_SEC,
  sparkleGapsPeriodMaxSec: SPARKLE_GAPS_BASE_PERIOD_MAX_SEC,
  sparkleWidthPeriodMinSec: WIDTH_SHUFFLE_BASE_PERIOD_MIN_SEC,
  sparkleWidthPeriodMaxSec: WIDTH_SHUFFLE_BASE_PERIOD_MAX_SEC,
  widthShuffleSwing: WIDTH_SHUFFLE_MIN_SWING_PX,
  smoothingMaxStep: DEFAULT_SMOOTHING_MAX_STEP,
  gridUpdateIntervalMs: STRIPE_GRID_UPDATE_INTERVAL_MS,
};

export const PLAYGROUND_CELL_SIZE_MIN = 1;
export const PLAYGROUND_CELL_SIZE_MAX = 64;
export const PLAYGROUND_LETTER_SIZE_MIN = 1;
export const PLAYGROUND_LETTER_SIZE_MAX = 64;

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

/** Coerces a partial/untrusted config into a complete, range-checked config. */
export function normalizePlaygroundGridConfig(input: Partial<PlaygroundGridConfig> | undefined): PlaygroundGridConfig {
  const base = DEFAULT_PLAYGROUND_GRID_CONFIG;
  if (!input) {
    return { ...base };
  }

  const cellWidth = clampInt(
    input.cellWidth ?? base.cellWidth,
    PLAYGROUND_CELL_SIZE_MIN,
    PLAYGROUND_CELL_SIZE_MAX,
    base.cellWidth,
  );
  const cellHeight = clampInt(
    input.cellHeight ?? base.cellHeight,
    PLAYGROUND_CELL_SIZE_MIN,
    PLAYGROUND_CELL_SIZE_MAX,
    base.cellHeight,
  );
  const orientation: StripeOrientation = input.orientation === "horizontal" ? "horizontal" : "vertical";

  return {
    cellWidth,
    cellHeight,
    gapX: clampNumber(input.gapX ?? base.gapX, 0, cellWidth, base.gapX),
    gapY: clampNumber(input.gapY ?? base.gapY, 0, cellHeight, base.gapY),
    chainBreakGap: clampNumber(
      input.chainBreakGap ?? base.chainBreakGap,
      0,
      Math.max(cellWidth, cellHeight),
      base.chainBreakGap,
    ),
    minStripeHeight: clampNumber(input.minStripeHeight ?? cellHeight, 0, Math.max(cellWidth, cellHeight), cellHeight),
    cornerRadius: clampNumber(
      input.cornerRadius ?? base.cornerRadius,
      0,
      Math.max(cellWidth, cellHeight),
      base.cornerRadius,
    ),
    orientation,
    letterSize: clampNumber(
      input.letterSize ?? base.letterSize,
      PLAYGROUND_LETTER_SIZE_MIN,
      PLAYGROUND_LETTER_SIZE_MAX,
      base.letterSize,
    ),
    letterRatio: clampNumber(input.letterRatio ?? base.letterRatio, 0, 1, base.letterRatio),
    letterCharset:
      typeof input.letterCharset === "string" && input.letterCharset.length > 0
        ? input.letterCharset
        : base.letterCharset,
    letterColor: Number.isFinite(input.letterColor) ? (input.letterColor as number) & 0xffffff : base.letterColor,
    letterShuffleSpeed: clampNumber(
      input.letterShuffleSpeed ?? base.letterShuffleSpeed,
      0.05,
      20,
      base.letterShuffleSpeed,
    ),
    sparkleGapsPeriodMinSec: clampNumber(
      input.sparkleGapsPeriodMinSec ?? base.sparkleGapsPeriodMinSec,
      0.01,
      10,
      base.sparkleGapsPeriodMinSec,
    ),
    sparkleGapsPeriodMaxSec: clampNumber(
      input.sparkleGapsPeriodMaxSec ?? base.sparkleGapsPeriodMaxSec,
      0.01,
      10,
      base.sparkleGapsPeriodMaxSec,
    ),
    sparkleWidthPeriodMinSec: clampNumber(
      input.sparkleWidthPeriodMinSec ?? base.sparkleWidthPeriodMinSec,
      0.01,
      10,
      base.sparkleWidthPeriodMinSec,
    ),
    sparkleWidthPeriodMaxSec: clampNumber(
      input.sparkleWidthPeriodMaxSec ?? base.sparkleWidthPeriodMaxSec,
      0.01,
      10,
      base.sparkleWidthPeriodMaxSec,
    ),
    widthShuffleSwing: clampNumber(input.widthShuffleSwing ?? base.widthShuffleSwing, 0, 32, base.widthShuffleSwing),
    smoothingMaxStep: clampInt(input.smoothingMaxStep ?? base.smoothingMaxStep, 0, 255, base.smoothingMaxStep),
    gridUpdateIntervalMs: clampNumber(
      input.gridUpdateIntervalMs ?? base.gridUpdateIntervalMs,
      0,
      1000,
      base.gridUpdateIntervalMs,
    ),
  };
}

/**
 * Effective cell pitch = configured bar size + gap. The gap is added on top of the bar size
 * (rather than subtracted from it) so the stripe renders at its full configured size and the
 * gap becomes real spacing carved between cells.
 */
export function effectivePlaygroundCellSize(config: PlaygroundGridConfig): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(config.cellWidth + config.gapX)),
    height: Math.max(1, Math.round(config.cellHeight + config.gapY)),
  };
}

/** True when the config matches the defaults (used for the reset affordance). */
export function isDefaultPlaygroundGridConfig(config: PlaygroundGridConfig): boolean {
  const base = DEFAULT_PLAYGROUND_GRID_CONFIG;
  return (
    config.cellWidth === base.cellWidth &&
    config.cellHeight === base.cellHeight &&
    config.gapX === base.gapX &&
    config.gapY === base.gapY &&
    config.chainBreakGap === base.chainBreakGap &&
    config.minStripeHeight === base.minStripeHeight &&
    config.cornerRadius === base.cornerRadius &&
    config.orientation === base.orientation &&
    config.letterSize === base.letterSize &&
    config.letterRatio === base.letterRatio &&
    config.letterCharset === base.letterCharset &&
    config.letterColor === base.letterColor &&
    config.letterShuffleSpeed === base.letterShuffleSpeed &&
    config.sparkleGapsPeriodMinSec === base.sparkleGapsPeriodMinSec &&
    config.sparkleGapsPeriodMaxSec === base.sparkleGapsPeriodMaxSec &&
    config.sparkleWidthPeriodMinSec === base.sparkleWidthPeriodMinSec &&
    config.sparkleWidthPeriodMaxSec === base.sparkleWidthPeriodMaxSec &&
    config.widthShuffleSwing === base.widthShuffleSwing &&
    config.smoothingMaxStep === base.smoothingMaxStep &&
    config.gridUpdateIntervalMs === base.gridUpdateIntervalMs
  );
}
